#!/bin/bash
set -eo pipefail

# Trap errors with line info
trap 'log ">>> FATAL: entrypoint.sh failed at line $LINENO (exit code $?)"' ERR

log() { echo "[entrypoint] $1" >&2; }

log "=== HIA Entrypoint Starting ==="

# 0. Validate INSTANCE_SECRET
if [ -z "$INSTANCE_SECRET" ]; then
  log "WARNING: INSTANCE_SECRET not set, generating a random one (not persistent across restarts!)"
  INSTANCE_SECRET=$(head -c 32 /dev/urandom | od -A n -t x1 | tr -d ' \n')
  export INSTANCE_SECRET
fi

# 1. Start Convex backend in background (from same dir as supervisord will use)
log "Starting Convex backend..."
cd /app/convex_data
/app/convex-local-backend --instance-secret "$INSTANCE_SECRET" --instance-name "convex-self-hosted" --port 3210 2>&1 &
CONVEX_PID=$!
log "Convex PID: $CONVEX_PID"

# 2. Wait for Convex to be healthy
log "Waiting for health check on http://127.0.0.1:3210/version ..."
n=0
until curl -sf http://127.0.0.1:3210/version > /dev/null 2>&1; do
  if ! kill -0 $CONVEX_PID 2>/dev/null; then
    log "ERROR: Convex backend process (PID $CONVEX_PID) died during startup"
    exit 1
  fi
  n=$((n + 1))
  if [ $n -ge 60 ]; then
    log "ERROR: Convex backend failed health check after 60 seconds"
    exit 1
  fi
  sleep 1
done
log "Convex backend is healthy (took ${n}s)."

# 3. Generate admin key
if [ -z "$CONVEX_ADMIN_KEY" ]; then
  log "Generating Convex admin key..."
  cd /app
  KEY_OUTPUT=$(./generate_admin_key.sh 2>&1) || {
    log "WARNING: generate_admin_key.sh failed: $KEY_OUTPUT"
    KEY_OUTPUT=""
  }
  if [ -n "$KEY_OUTPUT" ]; then
    # Extract just the key line (starts with "convex-self-hosted|" or similar)
    CONVEX_ADMIN_KEY=$(echo "$KEY_OUTPUT" | grep -o 'convex-self-hosted|[^ ]*' | head -1)
    if [ -z "$CONVEX_ADMIN_KEY" ]; then
      # Fallback: take the last non-empty line
      CONVEX_ADMIN_KEY=$(echo "$KEY_OUTPUT" | tail -1 | tr -d '[:space:]')
    fi
  fi
  if [ -z "$CONVEX_ADMIN_KEY" ]; then
    log "ERROR: Could not extract admin key"
    exit 1
  fi
  export CONVEX_ADMIN_KEY
  log "Admin key generated (length: ${#CONVEX_ADMIN_KEY})."
else
  log "CONVEX_ADMIN_KEY already set from environment."
fi

# 4. Deploy Convex functions to local backend
log "Deploying Convex functions to local backend..."
log "Using convex CLI at: $(which convex 2>&1 || echo 'NOT FOUND')"
CONVEX_SELF_HOSTED_URL="http://127.0.0.1:3210" \
CONVEX_SELF_HOSTED_ADMIN_KEY="$CONVEX_ADMIN_KEY" \
CONVEX_TMPDIR="/app/tmp" \
convex deploy --yes --typecheck disable 2>&1 | while IFS= read -r line; do log "[deploy] $line"; done
if [ "${PIPESTATUS[0]}" != "0" ]; then
  log "ERROR: Local convex deploy failed"
  exit 1
fi
log "Local deployment complete."

# 5. Deploy Convex functions to cloud backup (if configured)
if [ -n "$CONVEX_CLOUD_URL" ] && [ -n "$CONVEX_CLOUD_DEPLOY_KEY" ]; then
  log "Deploying Convex functions to cloud backup..."
  CONVEX_URL="$CONVEX_CLOUD_URL" \
  CONVEX_DEPLOY_KEY="$CONVEX_CLOUD_DEPLOY_KEY" \
  convex deploy --yes --typecheck disable 2>&1 | while IFS= read -r line; do log "[cloud-deploy] $line"; done
  log "Cloud deployment attempted."
# 5a. Bootstrap local DB from cloud (if local is empty and cloud is configured)
if [ -n "$CONVEX_CLOUD_URL" ] && [ -n "$CONVEX_CLOUD_DEPLOY_KEY" ]; then
  log "Checking if local DB needs bootstrap from cloud..."
  CONVEX_ADMIN_KEY="$CONVEX_ADMIN_KEY" \
  CONVEX_URL="http://127.0.0.1:3210" \
  CONVEX_CLOUD_URL="$CONVEX_CLOUD_URL" \
  CONVEX_CLOUD_DEPLOY_KEY="$CONVEX_CLOUD_DEPLOY_KEY" \
  node -e "
    const { bootstrapFromCloud } = require('./lib/backend/sync');
    bootstrapFromCloud()
      .then(() => { console.log('[entrypoint] Bootstrap check complete.'); process.exit(0); })
      .catch(e => { console.error('[entrypoint] Bootstrap error:', e.message); process.exit(0); });
  " 2>&1 | while IFS= read -r line; do log "$line"; done
  log "Bootstrap step done."
fi

# 6. Stop the temporary Convex backend (supervisord will manage it)
log "Stopping temporary Convex backend (PID $CONVEX_PID)..."
kill $CONVEX_PID 2>/dev/null || true
wait $CONVEX_PID 2>/dev/null || true
log "Temporary backend stopped."

# 7. Write runtime env vars for supervisord child processes
log "Writing runtime env to /app/.env.runtime..."
cat > /app/.env.runtime << EOF
export CONVEX_ADMIN_KEY="$CONVEX_ADMIN_KEY"
export CONVEX_URL="http://127.0.0.1:3210"
export CONVEX_CLOUD_URL="${CONVEX_CLOUD_URL:-}"
export CONVEX_CLOUD_DEPLOY_KEY="${CONVEX_CLOUD_DEPLOY_KEY:-}"
EOF
log "Runtime env written."

# 8. Hand off to supervisord
log "=== HIA Entrypoint Complete, starting supervisord ==="
exec "$@"
