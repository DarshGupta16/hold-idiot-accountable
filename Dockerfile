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

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV CONVEX_ADMIN_KEY="dummy_key_for_build"
ENV CONVEX_URL="http://127.0.0.1:3210"
RUN npm run build

# Bundle worker.ts
RUN npx esbuild worker.ts --bundle --platform=node --outfile=worker.js --alias:@=.

# Stage 3: Runner
FROM node:20-slim AS runner
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
    && rm -rf /var/lib/apt/lists/*

# Copy Convex backend and setup scripts
COPY --from=convex /convex/convex-backend /app/convex-backend
COPY --from=convex /convex/generate_admin_key.sh /app/generate_admin_key.sh
RUN chmod +x /app/convex-backend /app/generate_admin_key.sh
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

# Install convex globally for deployment script
RUN npm install -g convex

# Set up non-root user (node is already created in base image)
RUN chown -R node:node /app
USER node

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
