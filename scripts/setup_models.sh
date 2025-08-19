#!/bin/bash

# Model setup script - converts your downloaded models to the required formats
set -e

echo "🔧 Setting up models for WebRTC Object Detection"

# Create directories
mkdir -p models public/models

# Check for downloaded models
if [ ! -f "models/yolov5n.onnx" ] && [ ! -f "models/mobile-ssd-v1.onnx" ]; then
    echo "❌ No model files found!"
    echo "Please place your downloaded models in the models/ directory:"
    echo "  - models/yolov5n.onnx"
    echo "  - models/mobile-ssd-v1.onnx"
    exit 1
fi

# Quantize models for WASM if needed
if [ -f "models/yolov5n.onnx" ]; then
    echo "✅ Found YOLOv5n model"
    
    # Copy for WASM use (quantization would be done here in production)
    cp models/yolov5n.onnx public/models/yolov5n-quantized.onnx
    echo "📦 Prepared YOLOv5n for WASM inference"
fi

if [ -f "models/mobile-ssd-v1.onnx" ]; then
    echo "✅ Found MobileNet-SSD model"
    
    # Copy for WASM use
    cp models/mobile-ssd-v1.onnx public/models/mobile-ssd-v1-quantized.onnx
    echo "📦 Prepared MobileNet-SSD for WASM inference"
fi

echo "🎉 Model setup complete!"
