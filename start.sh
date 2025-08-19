#!/bin/bash

# Real-time WebRTC Object Detection Startup Script
set -e

MODE=${MODE:-wasm}
NGROK_FLAG=""

for arg in "$@"; do
    case $arg in
        --ngrok)
            NGROK_FLAG="--ngrok"
            shift
            ;;
    esac
done

echo "🚀 Starting Real-time WebRTC Object Detection System"
echo "Mode: $MODE"

if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "📦 Checking Socket.IO dependencies..."
if ! npm list socket.io &> /dev/null || ! npm list socket.io-client &> /dev/null; then
    echo "Installing Socket.IO dependencies..."
    npm install socket.io socket.io-client
fi

# Check if models exist
if [ ! -f "models/yolov5n.onnx" ] && [ ! -f "models/mobile-ssd-v1.onnx" ]; then
    echo "❌ No model files found in models/ directory"
    echo "Please ensure you have downloaded the model files:"
    echo "  - models/yolov5n.onnx"
    echo "  - models/mobile-ssd-v1.onnx"
    echo "💡 The system will work in demo mode without models"
fi

mkdir -p public/models

# Setup ONNX WASM files for client-side inference
if [ "$MODE" = "wasm" ]; then
    echo "📦 Setting up WASM inference files..."
    mkdir -p public/onnx-wasm
    
    # Download ONNX Runtime WASM files if not present
    if [ ! -f "public/onnx-wasm/ort-wasm.wasm" ]; then
        echo "⬇️  Downloading ONNX Runtime WASM files..."
        curl -L -o public/onnx-wasm/ort-wasm.wasm https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort-wasm.wasm
        curl -L -o public/onnx-wasm/ort-wasm-simd.wasm https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort-wasm-simd.wasm
        curl -L -o public/onnx-wasm/ort-wasm-threaded.wasm https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort-wasm-threaded.wasm
    fi
    
    # Copy model for WASM
    if [ -f "models/yolov5n.onnx" ]; then
        cp models/yolov5n.onnx public/models/yolov5n.onnx
    elif [ -f "models/mobile-ssd-v1.onnx" ]; then
        cp models/mobile-ssd-v1.onnx public/models/yolov5n.onnx
    fi
fi

echo "🔌 Starting Socket.IO server..."
if [ -f "server/socket-server.js" ]; then
    node server/socket-server.js &
    SOCKET_PID=$!
    echo "Socket.IO server started with PID: $SOCKET_PID"
    sleep 3
    
    # Check if Socket.IO server is running
    if ! kill -0 $SOCKET_PID 2>/dev/null; then
        echo "❌ Socket.IO server failed to start"
        exit 1
    fi
    echo "✅ Socket.IO server is running on port 3001"
else
    echo "❌ Socket.IO server file not found"
    exit 1
fi

if [ "$NGROK_FLAG" = "--ngrok" ]; then
    echo "🌐 Starting ngrok tunnel..."
    if command -v ngrok &> /dev/null; then
        # Start ngrok in background and capture output
        ngrok http 3000 --log=stdout > ngrok.log 2>&1 &
        NGROK_PID=$!
        
        echo "⏳ Waiting for ngrok tunnel to establish..."
        sleep 5
        
        # Extract ngrok URL
        NGROK_URL=""
        for i in {1..10}; do
            if curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.app' > /dev/null 2>&1; then
                NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.app' | head -1)
                break
            fi
            echo "Waiting for ngrok tunnel... ($i/10)"
            sleep 2
        done
        
        if [ ! -z "$NGROK_URL" ]; then
            echo "✅ Ngrok tunnel established: $NGROK_URL"
            echo "NGROK_URL=$NGROK_URL" > .env.local
            echo "📱 Use this URL on your phone: $NGROK_URL/phone"
        else
            echo "❌ Failed to get ngrok URL. Check ngrok.log for details."
            echo "💡 You can still use localhost if on same network"
        fi
    else
        echo "❌ ngrok not found. Please install ngrok:"
        echo "   npm install -g ngrok"
        echo "   or download from: https://ngrok.com/download"
        exit 1
    fi
else
    echo "NGROK_URL=" > .env.local
fi

# Start the application based on mode
if [ "$MODE" = "server" ]; then
    echo "🖥️  Starting server mode..."
    
    # Start Python inference server
    echo "Starting inference server..."
    cd server
    python main.py --model ../models/yolov5n.onnx --host 0.0.0.0 --port 8765 &
    SERVER_PID=$!
    cd ..
    
    # Start Next.js frontend
    echo "Starting frontend..."
    npm run dev &
    FRONTEND_PID=$!
    
    echo "✅ Server mode started!"
    echo "📱 Open http://localhost:3000 on your laptop"
    echo "📱 Scan QR code or visit the URL on your phone"
    
    # Wait for processes
    wait $SERVER_PID $FRONTEND_PID
    
else
    echo "🌐 Starting WASM mode..."
    
    # Start Next.js frontend only
    npm run dev &
    FRONTEND_PID=$!
    
    echo "✅ WASM mode started!"
    echo "📱 Open http://localhost:3000 on your laptop"
    echo "📱 Scan QR code or visit the URL on your phone"
    echo "💡 Processing will run in your browser"
    
    # Wait for process
    wait $FRONTEND_PID
fi

cleanup() {
    echo "🛑 Shutting down..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$SOCKET_PID" ]; then
        kill $SOCKET_PID 2>/dev/null || true
    fi
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT
