FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy additional files
COPY --chown=nextjs:nodejs server/ ./server/
COPY --chown=nextjs:nodejs models/ ./models/
COPY --chown=nextjs:nodejs start.sh ./start.sh
COPY --chown=nextjs:nodejs bench/ ./bench/

# Make scripts executable
RUN chmod +x start.sh
RUN chmod +x bench/run_bench.sh

# Create required directories
RUN mkdir -p public/models public/onnx-wasm

USER nextjs

EXPOSE 3000 8765

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Use start.sh as entrypoint to handle mode switching
CMD ["./start.sh"]