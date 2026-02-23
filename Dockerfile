# Stage 1: Convex Backend Binary
FROM ghcr.io/get-convex/convex-backend:latest AS convex

# Stage 2: Builder
FROM oven/bun:debian AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# Generate convex/_generated/api.ts inline
# (Render strips this directory from the build context despite it being in git)
RUN mkdir -p convex/_generated && \
    echo 'import { anyApi } from "convex/server"; export const api = anyApi;' > convex/_generated/api.ts

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV CONVEX_ADMIN_KEY="dummy_key_for_build"
ENV CONVEX_URL="http://127.0.0.1:3210"
RUN bun run build

# Bundle worker.ts and bootstrap.ts using Bun (Node target for compatibility)
RUN bun build worker.ts --target=node --outfile=worker.js
RUN bun build bootstrap.ts --target=node --outfile=bootstrap.js

# Stage 3: Runner
FROM debian:trixie-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install system dependencies + Bun (for runtime/CLI) + Node.js (for server.js)
RUN apt-get update && apt-get install -y \
    supervisor \
    ca-certificates \
    curl \
    bash \
    unzip \
    nodejs \
    npm \
    && curl -fsSL https://bun.sh/install | bash \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.bun/bin:${PATH}"

# Copy Convex backend binary and ALL helper files
COPY --from=convex /convex/ /app/convex-tools/
RUN cp /app/convex-tools/convex-local-backend /app/convex-local-backend && \
    cp /app/convex-tools/*.sh /app/ 2>/dev/null || true && \
    cp /app/convex-tools/generate_key /app/ 2>/dev/null || true && \
    rm -rf /app/convex-tools && \
    chmod +x /app/convex-local-backend /app/*.sh /app/generate_key 2>/dev/null || true
RUN mkdir -p /app/convex_data /app/tmp

# Copy Next.js standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy worker and convex source
COPY --from=builder /app/worker.js ./worker.js
COPY --from=builder /app/bootstrap.js ./bootstrap.js
COPY --from=builder /app/convex ./convex
COPY --from=builder /app/supervisord.conf /etc/supervisord.conf
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Install convex globally (for deployment)
RUN bun install -g convex && \
    mkdir -p /app/node_modules && \
    ln -s /root/.bun/install/global/node_modules/convex /app/node_modules/convex

# Set up non-root user (create 'node' user as in previous base image)
RUN useradd -m -u 1000 node && \
    mkdir -p /convex && \
    chown -R node:node /app /convex

USER node

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
