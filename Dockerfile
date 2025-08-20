# Multi-stage Docker build for WebRTC Object Detection
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    py3-pip \
    bash \
    curl \
    git

# Node.js dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm ci --only=production

# Python dependencies stage
FROM python:3.9-slim AS python-deps
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Fix ONNX build issues
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build Next.js application
RUN npm run build

# Production runtime stage
FROM base AS runner
WORKDIR /app

# Install Python runtime and dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    bash \
    netcat-openbsd

# Copy Python dependencies
COPY --from=python-deps /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Create system user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy application files
COPY --chown=nextjs:nodejs server/ ./server/
COPY --chown=nextjs:nodejs models/ ./models/
COPY --chown=nextjs:nodejs scripts/ ./scripts/
COPY --chown=nextjs:nodejs bench/ ./bench/
COPY --chown=nextjs:nodejs start.sh ./start.sh
COPY --chown=nextjs:nodejs package.json ./package.json

# Create necessary directories
RUN mkdir -p public/models public/onnx-wasm logs
RUN chown -R nextjs:nodejs public/models public/onnx-wasm logs

# Make scripts executable
RUN chmod +x start.sh
RUN chmod +x bench/run_bench.sh 2>/dev/null || true
RUN chmod +x scripts/setup_models.sh 2>/dev/null || true

# Setup Python symlinks for compatibility
RUN ln -sf /usr/bin/python3 /usr/bin/python

USER nextjs

# Expose ports
EXPOSE 3000 8765

# Environment variables
ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV PYTHONPATH /app/server
ENV MODE server

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["./start.sh"]