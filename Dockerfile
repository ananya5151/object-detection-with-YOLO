FROM node:18-alpine AS frontend-builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM python:3.9-slim AS server-builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopencv-dev \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY server/requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt

FROM python:3.9-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies
COPY --from=server-builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=server-builder /usr/local/bin /usr/local/bin

# Copy application
WORKDIR /app
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

# Copy server code
COPY server/ ./server/

# Create models directory
RUN mkdir -p models public/models public/onnx-wasm

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000 8765

CMD ["./start.sh"]
