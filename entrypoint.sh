#!/bin/sh
set -e

# 1. Start Convex backend in background for initial setup
/app/convex-backend &
CONVEX_PID=$!

# 2. Wait for Convex to be healthy
echo "Waiting for Convex backend to start..."
n=0
until curl -sf http://127.0.0.1:3210/version > /dev/null 2>&1; do
  n=$((n + 1))
  if [ $n -ge 60 ]; then
    echo "ERROR: Convex backend failed to start after 60 seconds"
    exit 1
  fi
  sleep 1
done
echo "Convex backend is healthy."

# 3. Generate admin key (if not already set)
if [ -z "$CONVEX_ADMIN_KEY" ]; then
  echo "Generating Convex admin key..."
  # Executing the script inside the container (already copied in Dockerfile)
  CONVEX_ADMIN_KEY=$(/app/generate_admin_key.sh)
  export CONVEX_ADMIN_KEY
  echo "Admin key generated."
fi

# 4. Deploy Convex functions to local backend
echo "Deploying Convex functions to local backend..."
CONVEX_SELF_HOSTED_URL="http://127.0.0.1:3210" \
CONVEX_SELF_HOSTED_ADMIN_KEY="$CONVEX_ADMIN_KEY" \
npx convex deploy --yes
echo "Local deployment complete."

# 5. Deploy Convex functions to cloud backup (if configured)
if [ -n "$CONVEX_CLOUD_URL" ] && [ -n "$CONVEX_CLOUD_DEPLOY_KEY" ]; then
  echo "Deploying Convex functions to cloud backup..."
  CONVEX_URL="$CONVEX_CLOUD_URL" \
  CONVEX_DEPLOY_KEY="$CONVEX_CLOUD_DEPLOY_KEY" \
  npx convex deploy --yes
  echo "Cloud deployment complete."
fi

# 6. Stop the temporary Convex backend (supervisord will manage it)
kill $CONVEX_PID 2>/dev/null || true
wait $CONVEX_PID 2>/dev/null || true

# 7. Hand off to supervisord
exec "$@"
