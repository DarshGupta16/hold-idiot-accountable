# Stage 1: Convex Backend Binary
FROM ghcr.io/get-convex/convex-backend:latest AS convex

# Stage 2: Builder
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Remove dotenv from worker.ts for production
RUN sed -i '/import dotenv from "dotenv";/d' worker.ts && \
    sed -i '/dotenv.config/d' worker.ts

# Generate convex/_generated/api.ts inline
# (Render strips this directory from the build context despite it being in git)
RUN mkdir -p convex/_generated && \
    echo 'import { anyApi } from "convex/server"; export const api = anyApi;' > convex/_generated/api.ts

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV CONVEX_ADMIN_KEY="dummy_key_for_build"
ENV CONVEX_URL="http://127.0.0.1:3210"
RUN npm run build

# Bundle worker.ts
RUN npx esbuild worker.ts --bundle --platform=node --outfile=worker.js --alias:@=.

# Stage 3: Runner
FROM node:20-trixie-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    supervisor \
    ca-certificates \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Copy Convex backend binary and ALL helper files (scripts + binaries like generate_key)
COPY --from=convex /convex/ /app/convex-tools/
RUN cp /app/convex-tools/convex-local-backend /app/convex-local-backend && \
    cp /app/convex-tools/*.sh /app/ 2>/dev/null || true && \
    cp /app/convex-tools/generate_key /app/ 2>/dev/null || true && \
    rm -rf /app/convex-tools && \
    chmod +x /app/convex-local-backend /app/*.sh /app/generate_key 2>/dev/null || true
RUN mkdir -p /app/convex_data

# Copy Next.js standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy worker and convex source (for deployment)
COPY --from=builder /app/worker.js ./worker.js
COPY --from=builder /app/convex ./convex
COPY --from=builder /app/supervisord.conf /etc/supervisord.conf
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Install convex globally (CLI) + symlink into project node_modules (for esbuild bundler)
RUN npm install -g convex && \
    mkdir -p /app/node_modules && \
    ln -s /usr/local/lib/node_modules/convex /app/node_modules/convex

# Set up non-root user (node is already created in base image)
# /convex is needed by generate_admin_key.sh
RUN mkdir -p /convex && chown -R node:node /app /convex
USER node

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
