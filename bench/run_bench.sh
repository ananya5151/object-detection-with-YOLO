#!/bin/bash

# Benchmarking script for WebRTC Object Detection
set -e

DURATION=${1:-30}
MODE=${2:-wasm}
OUTPUT_FILE="metrics.json"

echo "🔬 Running benchmark for $DURATION seconds in $MODE mode"

# Start the application in background
MODE=$MODE ./start.sh &
APP_PID=$!

# Wait for startup
echo "⏳ Waiting for application to start..."
sleep 10

# Check if application is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Application not responding"
    kill $APP_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Application started, beginning benchmark..."

# Run benchmark
python3 bench/benchmark.py --duration $DURATION --mode $MODE --output $OUTPUT_FILE

# Stop application
kill $APP_PID 2>/dev/null || true

echo "📊 Benchmark complete! Results saved to $OUTPUT_FILE"
cat $OUTPUT_FILE
