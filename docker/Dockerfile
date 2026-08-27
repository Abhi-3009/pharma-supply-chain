# ---- Phase 2: Dockerfile (Multi-stage build) ----
# Stage 1: Install production dependencies
FROM node:26-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source
COPY app/src ./src

# ---- Stage 2: Production image ----
FROM node:26-alpine

# Security: Add non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Security: Remove unnecessary packages
RUN apk --no-cache add wget && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appgroup /app ./

# Create logs directory with correct permissions
RUN mkdir -p logs && chown -R appuser:appgroup logs

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check for Docker / Kubernetes
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
