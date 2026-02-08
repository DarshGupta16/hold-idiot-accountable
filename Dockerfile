FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Remove dotenv import from worker.ts for production (environment variables are injected by Docker instead)
RUN sed -i '/import dotenv from "dotenv";/d' worker.ts && \
    sed -i '/dotenv.config/d' worker.ts

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
# Add dummy environment variables to pass build-time validation/static generation
ENV GROQ_API_KEY="dummy_key_for_build"
ENV POCKETBASE_ADMIN_EMAIL="dummy_email_for_build"
ENV POCKETBASE_ADMIN_PASSWORD="dummy_pass_for_build"
RUN npm run build

# Bundle worker.ts into a single file
# Use tsconfig-paths plugin to resolve @/* path aliases
RUN npx esbuild worker.ts --bundle --platform=node --outfile=worker.js --alias:@=.

# Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install system dependencies
RUN apk add --no-cache \
    supervisor \
    ca-certificates \
    unzip \
    wget \
    openssl

# Download and install PocketBase
# Using v0.36.2 based on research
ADD https://github.com/pocketbase/pocketbase/releases/download/v0.36.2/pocketbase_0.36.2_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /app/ \
    && chmod +x /app/pocketbase \
    && rm /tmp/pb.zip

# Create pb_data directory
RUN mkdir -p /app/pb_data

# Copy Next.js standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy worker and config
COPY --from=builder /app/worker.js ./worker.js
COPY --from=builder /app/pb_migrations ./pb_migrations
COPY --from=builder /app/supervisord.conf /etc/supervisord.conf
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

# Change ownership of /app to node user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose the Next.js port
EXPOSE 3000

# Start via entrypoint to handle setup
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
