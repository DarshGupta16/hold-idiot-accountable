#!/bin/sh
set -e

# Instantiate or update the PocketBase superuser using environment variables
if [ -n "$POCKETBASE_ADMIN_EMAIL" ] && [ -n "$POCKETBASE_ADMIN_PASSWORD" ]; then
    echo "Upserting PocketBase superuser: $POCKETBASE_ADMIN_EMAIL"
    /app/pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD"
else
    echo "PocketBase admin credentials not fully set. Skipping superuser upsert."
fi

# Hand off to supervisord
exec "$@"
