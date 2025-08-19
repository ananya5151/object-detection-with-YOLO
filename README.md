# Real-time WebRTC Multi-Object Detection

A complete system for real-time object detection on live video streamed from a phone via WebRTC, with bounding box overlays and performance metrics.

## 🚀 Quick Start (One Command)

\`\`\`bash
# Clone and start (WASM mode - works on any laptop)
git clone <repo-url>
cd webrtc-object-detection
./start.sh

# Or with Docker
docker-compose up --build
\`\`\`

**That's it!** Open http://localhost:3000 and scan the QR code with your phone.

## 📱 Phone Connection

1. **Same Network**: Scan QR code or visit the displayed URL
2. **External Access**: Use `./start.sh --ngrok` for public URL
3. **Allow camera** when prompted on your phone
4. **Start streaming** and view real-time detection overlays

## 🔧 Mode Switching

### WASM Mode (Default - Low Resource)
\`\`\`bash
MODE=wasm ./start.sh
\`\`\`
- Runs inference in browser using ONNX Runtime Web
- Works on modest laptops (Intel i5, 8GB RAM)
- ~10-15 FPS processing at 320×240 resolution
- No GPU required

### Server Mode (High Performance)
\`\`\`bash
MODE=server ./start.sh
\`\`\`
- Python backend with ONNX Runtime
- Higher FPS and accuracy
- Requires more system resources

## 📊 Benchmarking

Run a 30-second benchmark to collect metrics:

\`\`\`bash
# Benchmark WASM mode
./bench/run_bench.sh 30 wasm

# Benchmark server mode  
./bench/run_bench.sh 30 server
\`\`\`

Results saved to `metrics.json` with:
- Median & P95 end-to-end latency
- Processed FPS
- Uplink/downlink bandwidth (kbps)
- CPU/memory usage

## 🏗️ Architecture

### Frontend (Next.js + React)
- **WebRTC Manager**: Handles peer connections and signaling
- **Detection Overlay**: Real-time bounding box rendering
- **Metrics Display**: Live performance statistics
- **Phone Interface**: Mobile-optimized camera streaming

### Backend Options
- **WASM Mode**: Browser-based inference with onnxruntime-web
- **Server Mode**: Python WebRTC server with aiortc + OpenCV

### Models Supported
- YOLOv5n (quantized for WASM)
- MobileNet-SSD v1
- Custom ONNX models (320×320 input)

## 🔧 Setup Requirements

### Prerequisites
- Node.js 18+
- Python 3.9+ (server mode only)
- Docker & Docker Compose (optional)

### Model Files
Place your downloaded models in the `models/` directory:
\`\`\`
models/
├── yolov5n.onnx
└── mobile-ssd-v1.onnx
\`\`\`

### Dependencies
\`\`\`bash
# Frontend
npm install

# Server mode (optional)
pip install -r server/requirements.txt
\`\`\`

## 🌐 Network Configuration

### Local Network
- Ensure phone and laptop are on same WiFi
- Firewall may need port 3000 and 8765 open

### External Access
\`\`\`bash
# Install ngrok (free tier)
npm install -g ngrok

# Start with public URL
./start.sh --ngrok
\`\`\`

### Troubleshooting
- **Phone won't connect**: Check same network or use ngrok
- **No video**: Allow camera permissions in browser
- **High CPU**: Switch to WASM mode or reduce resolution
- **Misaligned overlays**: Check timestamp synchronization

## 📈 Performance Characteristics

### WASM Mode (Tested on Intel i5, 8GB RAM)
- **Latency**: ~150ms median, ~300ms P95
- **FPS**: 10-15 processed frames/second
- **CPU**: 40-60% single core usage
- **Memory**: ~200MB additional usage

### Server Mode (Same hardware)
- **Latency**: ~80ms median, ~150ms P95  
- **FPS**: 20-25 processed frames/second
- **CPU**: 60-80% usage
- **Memory**: ~400MB additional usage

## 🔄 Backpressure & Frame Management

### Frame Queue Strategy
- **Fixed-length queue** (5 frames max)
- **Drop old frames** when processing can't keep up
- **Latest frame priority** for real-time responsiveness

### Adaptive Sampling
- **WASM**: Process every 2nd frame (~10 FPS from 20 FPS input)
- **Server**: Process every frame up to 25 FPS
- **Auto-scaling** based on processing latency

## 🎯 Design Decisions

### WebRTC vs WebSocket
- **WebRTC**: Low-latency video streaming, P2P when possible
- **WebSocket**: Signaling and detection results only
- **Hybrid approach**: Best of both protocols

### Client vs Server Inference
- **WASM**: Better privacy, works offline, lower server costs
- **Server**: Higher accuracy, more model options, better performance
- **Mode switching**: Runtime selection based on requirements

### Frame Synchronization
- **Timestamp-based**: capture_ts for frame alignment
- **Frame ID tracking**: Ensures overlay matches correct frame
- **Latency calculation**: End-to-end timing measurement

## 🚧 Next Improvements

**One-line improvement**: Implement adaptive bitrate control to maintain consistent FPS under varying network conditions.

**Additional enhancements**:
- Multi-person tracking with ID persistence
- Custom model upload and switching
- WebRTC data channel for lower latency results
- Mobile app for better camera control
- Edge deployment with global CDN

## 📄 API Contract

Detection results follow this JSON format:
\`\`\`json
{
  "frame_id": "12345",
  "capture_ts": 1690000000000,
  "recv_ts": 1690000000100, 
  "inference_ts": 1690000000120,
  "detections": [
    {
      "label": "person",
      "score": 0.93,
      "xmin": 0.12,
      "ymin": 0.08, 
      "xmax": 0.34,
      "ymax": 0.67
    }
  ]
}
\`\`\`

Coordinates are normalized [0..1] for resolution independence.

## 📝 License

MIT License - see LICENSE file for details.
