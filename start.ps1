# PowerShell Startup Script for Real-Time Object Detection
# This script mimics the behavior of start.sh for Windows users

# Set default mode
if (-not $env:MODE) { $env:MODE = "wasm" }
$MODE = $env:MODE

Write-Host "🚀 Starting Real-time WebRTC Object Detection System"
Write-Host "Mode: $MODE"

# Install Node.js dependencies if node_modules does not exist
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..."
    npm install
}

# Ensure Socket.IO dependencies
$socketio = npm list socket.io 2>&1
$socketioc = npm list socket.io-client 2>&1
if ($socketio -like "*empty*" -or $socketioc -like "*empty*") {
    Write-Host "Installing Socket.IO dependencies..."
    npm install socket.io socket.io-client
}

# Check for model files
${defaultModel} = "models/yolov5n.onnx"
${altModel} = "models/ssd_mobilenet_v1_10.onnx"
if (-not (Test-Path $defaultModel) -and -not (Test-Path $altModel)) {
    Write-Host "❌ No model files found in models/ directory"
    Write-Host "Please ensure you have downloaded the model files:"
    Write-Host "  - models/yolov5n.onnx"
    Write-Host "  - models/ssd_mobilenet_v1_10.onnx"
    Write-Host "💡 The system will work in demo mode without models"
}

# Copy model to public/models for WASM mode
if (-not (Test-Path "public/models")) { New-Item -ItemType Directory -Path "public/models" | Out-Null }
if ($MODE -eq "wasm") {
    Write-Host "📦 Setting up WASM inference files..."
    if (-not (Test-Path "public/onnx-wasm")) { New-Item -ItemType Directory -Path "public/onnx-wasm" | Out-Null }
    if (-not (Test-Path "public/onnx-wasm/ort-wasm.wasm")) {
        Write-Host "⬇️  Downloading ONNX Runtime WASM files..."
        Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort-wasm.wasm" -OutFile "public/onnx-wasm/ort-wasm.wasm"
        Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort-wasm-simd.wasm" -OutFile "public/onnx-wasm/ort-wasm-simd.wasm"
        Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort-wasm-threaded.wasm" -OutFile "public/onnx-wasm/ort-wasm-threaded.wasm"
    }
    if (Test-Path $defaultModel) {
        Copy-Item $defaultModel public/models/yolov5n.onnx -Force
    } elseif (Test-Path $altModel) {
        Copy-Item $altModel public/models/yolov5n.onnx -Force
    }
}

# Start Socket.IO server
if (Test-Path "server/socket-server.js") {
    Write-Host "🔌 Starting Socket.IO server..."
    Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server/socket-server.js" -PassThru | Out-Null
    Start-Sleep -Seconds 3
    Write-Host "✅ Socket.IO server is running on port 3001"
}
else {
    Write-Host "❌ Socket.IO server file not found"
    exit 1
}

# Start Next.js frontend (WASM mode)
if ($MODE -eq "wasm") {
    Write-Host "🌐 Starting WASM mode..."
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev"
    Write-Host "✅ WASM mode started!"
    Write-Host "📱 Open http://localhost:3000 on your laptop"
    Write-Host "Scan QR code or visit the URL on your phone"
    Write-Host "💡 Processing will run in your browser"
}
elseif ($MODE -eq "server") {
    Write-Host "🖥️  Starting server mode..."
    Write-Host "Starting inference server..."
    Start-Process -NoNewWindow -FilePath "python" -ArgumentList "server/main.py --model models/yolov5n.onnx --host 0.0.0.0 --port 8765"
    Write-Host "Starting frontend..."
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev"
    Write-Host "✅ Server mode started!"
    Write-Host "📱 Open http://localhost:3000 on your laptop"
    Write-Host "Scan QR code or visit the URL on your phone"
}
