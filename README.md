# 🚀 Real-time WebRTC Object Detection System

> **Next.js + ONNX + Python WebRTC** - High-performance phone-to-laptop video streaming with dual-mode AI inference

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

A cutting-edge system that enables **real-time object detection** on live video streams from your phone to laptop using WebRTC technology. Features dual inference modes (WASM + Python server), comprehensive benchmarking, and production-ready Docker deployment.

---

## ⚡ Quick Demo (60 seconds)

```bash
# Clone and start immediately
git clone https://github.com/ananya5151/object-detection-with-YOLO.git
cd object-detection-with-YOLO

# One-command startup (auto-detects environment)
./start.sh

# Open laptop: http://localhost:3000
# Open phone: scan QR code or use same URL/phone
```

**What you'll see**: Real-time object detection overlays on your phone's video stream, displayed on your laptop with performance metrics.

---

## 🎯 Why This Architecture?

### **Hybrid Intelligence Design**

- **🌐 WebRTC Frontend**: Browser-based WASM inference for low-latency, client-side processing
- **🐍 Python Server**: High-performance ONNX Runtime inference with GPU acceleration support  
- **🔄 Intelligent Fallback**: Automatic mode switching based on performance and availability
- **📊 Real-time Metrics**: E2E latency tracking, FPS monitoring, and bandwidth analysis

### **Production-Ready Features**

- **🐳 Docker Deployment**: One-command containerized deployment
- **🔧 Auto-Configuration**: Intelligent dependency detection and model download
- **📱 Cross-Platform**: Works on any device with a modern browser
- **🌍 Network Flexibility**: Local WiFi or external ngrok tunneling
- **📈 Benchmarking Suite**: Comprehensive performance measurement tools

---

## 🏗️ System Architecture

<img width="691" height="700" alt="image" src="https://github.com/user-attachments/assets/e6928ff7-9eb0-4115-b15d-10fac9a5770a" />


### **Data Flow**

1. **📹 Capture**: Phone camera → WebRTC stream
2. **🌐 Transmission**: Real-time video frames via WebRTC peer connection
3. **🤖 Inference**: WASM (browser) or Python server AI processing
4. **📊 Visualization**: Live detection overlays + performance metrics
5. **💾 Collection**: Automated metrics export for analysis

---

## 🚀 Installation & Setup

### **Option 1: One-Command Start (Recommended)**

```bash
# Auto-mode: Detects your environment and starts optimally
./start.sh

# Specific modes
./start.sh --mode=wasm     # Browser-only inference
./start.sh --mode=server   # Python server inference
./start.sh --ngrok         # External access via ngrok
```

### **Option 2: Docker Deployment**

```bash
# Production deployment
docker-compose up --build

# With specific mode
MODE=server docker-compose up --build
```

### **Option 3: Manual Development**

```bash
# Install dependencies
npm install
cd server && pip install -r requirements.txt

# Start both services
npm run dev          # Terminal 1: Next.js + Socket.IO
cd server && python main.py  # Terminal 2: Python inference server
```

---

## 🎮 Usage Guide

### **Step 1: Launch System**

```bash
./start.sh --mode=wasm  # For low-resource/offline use
# OR
./start.sh --mode=server  # For high-performance inference
```

### **Step 2: Connect Devices**

| Device | URL | Role |
|--------|-----|------|
| 💻 **Laptop** | `http://localhost:3000` | Viewer/Receiver |
| 📱 **Phone** | `http://localhost:3000/phone` or scan QR | Camera/Sender |

### **Step 3: Configure & Connect**

1. **Laptop**: Select inference mode (WASM/Server), click "Start Receiving"
2. **Phone**: Allow camera access, click "Start Streaming"  
3. **Automatic**: WebRTC peer connection establishes
4. **Live Detection**: Object detection overlays appear in real-time

### **Step 4: Collect Metrics (Optional)**

```bash
# Automated 30s benchmark
./bench/run_bench.sh --duration 30 --mode wasm

# In-app metrics collection
# Click "Start 30s Collection" in the web interface
```

---

## 🔧 Inference Modes Explained

### **🌐 WASM Mode (Default)**

- **Engine**: ONNX.js in browser WebAssembly
- **Model**: YOLOv5n (optimized for browser)
- **Latency**: ~50-100ms end-to-end
- **CPU Usage**: Moderate (runs on laptop CPU)
- **Network**: Minimal server resources required
- **Best For**: Demos, privacy-sensitive use cases, offline operation

```typescript
// Browser-side inference pipeline
const results = await session.run(feeds, outputNames)
const detections = postprocessYOLO(results, inputSize, confidenceThreshold)
```

### **🐍 Server Mode (High Performance)**

- **Engine**: ONNX Runtime Python (CPU/GPU)
- **Model**: YOLOv5n with server-grade optimizations  
- **Latency**: ~20-50ms inference + network overhead
- **CPU Usage**: High (dedicated Python process)
- **Network**: Requires Python server + additional port (8765)
- **Best For**: Production, high-throughput, GPU acceleration

```python
# Server-side inference pipeline
outputs = session.run(output_names, {input_name: preprocessed_frame})
detections = postprocess_yolo_outputs(outputs, original_shape)
```

### **🔄 Auto Mode Selection**

The system intelligently selects the optimal mode:

```bash
# Auto-detection logic in start.sh
if python_available && models_exist && port_8765_free; then
    MODE="server"  # High performance
else
    MODE="wasm"    # Reliable fallback
fi
```

---

## 📊 Performance Benchmarking

### **Automated Benchmark Suite**

```bash
# Full 30-second benchmark with metrics export
./bench/run_bench.sh --duration 30 --mode server --output metrics.json

# Quick 10-second test
./bench/run_bench.sh --duration 10 --mode wasm
```

### **Metrics Collected**

| Metric | Description | Target |
|--------|-------------|---------|
| **E2E Latency** | Phone capture → Laptop display | <100ms |
| **Inference Time** | AI processing duration | <30ms |
| **Network Latency** | WebRTC transmission delay | <20ms |
| **FPS** | Frames processed per second | >10 FPS |
| **Bandwidth** | Upload/download usage | <1 Mbps |

### **Sample Output**

```json
{
  "benchmark_info": {
    "duration": 30,
    "samples_collected": 375,
    "total_frames": 375
  },
  "median_latency": 65,
  "p95_latency": 120,
  "processed_fps": 12.5,
  "server_latency": 25,
  "network_latency": 15,
  "uplink_kbps": 800,
  "downlink_kbps": 300
}
```

### **Real-time Metrics Dashboard**

- **📈 Live Graphs**: Latency trends, FPS monitoring
- **🎯 Performance Targets**: Visual indicators for optimal performance
- **💾 Export Options**: JSON download, automated collection
- **🔧 Diagnostics**: Connection quality, inference mode status

---

## 🔧 Configuration Options

### **Environment Variables**

```bash
# Mode selection
export MODE=wasm              # or 'server'

# Network configuration
export HOST=0.0.0.0           # Server bind address
export PORT=3000              # Frontend port
export INFERENCE_PORT=8765    # Python server port

# Model configuration
export MODEL_PATH=./models/yolov5n.onnx
export CONFIDENCE_THRESHOLD=0.6
export INPUT_SIZE=640
```

### **Model Support**

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| **YOLOv5n** | 1.9MB | Fastest | Good | Real-time demos |
| **YOLOv5s** | 14MB | Fast | Better | Balanced use cases |
| **YOLOv5m** | 42MB | Medium | High | High accuracy needs |

```bash
# Download additional models
curl -L "https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5s.onnx" \
     -o models/yolov5s.onnx
```

### **COCO Object Classes (80 supported)**

```typescript
const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", 
  "truck", "boat", "traffic light", "fire hydrant", "stop sign",
  // ... 68 more classes including animals, furniture, electronics
]
```

---

## 🌐 Network & Deployment

### **Local Network Setup**

```bash
# Find your local IP for phone connection
./start.sh --mode=wasm
# Displays: Phone URL: http://192.168.1.100:3000/phone
```

### **External Access via Ngrok**

```bash
# Enable public access for remote testing
./start.sh --ngrok
# Provides: https://abc123.ngrok.io/phone
```

### **Production Docker Deployment**

```dockerfile
# Multi-stage build for optimized production
FROM node:18-alpine AS builder
COPY . .
RUN npm ci && npm run build

FROM python:3.9-slim AS runtime
COPY --from=builder /app/.next ./
RUN pip install -r requirements.txt
EXPOSE 3000 8765
CMD ["./start.sh"]
```

### **Cloud Platform Support**

| Platform | Configuration | Scaling |
|----------|---------------|---------|
| **AWS ECS** | Task definition with dual containers | Auto-scaling groups |
| **Google Cloud Run** | Serverless with WebRTC support | Automatic |
| **Azure Container Apps** | Multi-container deployment | Built-in load balancing |
| **Railway/Render** | Direct Docker deployment | Vertical scaling |

---

## 🛠️ Development Guide

### **Project Structure**

```
├── 🎨 Frontend (Next.js + TypeScript)
│   ├── app/                 # Next.js 14 app router
│   │   ├── page.tsx        # Main detection interface
│   │   ├── phone/page.tsx  # Mobile camera interface
│   │   └── api/            # Backend API routes
│   ├── components/         # React components
│   │   ├── video-stream.tsx    # Core WebRTC video handling
│   │   ├── detection-overlay.tsx # Bounding box rendering
│   │   ├── phone-camera.tsx     # Mobile camera controls
│   │   └── metrics-display.tsx  # Performance dashboard
│   └── lib/                # Core business logic
│       ├── webrtc-manager.ts    # WebRTC + WASM inference
│       ├── webrtc-client.ts     # Phone-side WebRTC
│       └── types.ts             # TypeScript definitions
│
├── 🐍 Backend (Python + WebRTC)
│   ├── server/
│   │   ├── main.py         # aiortc WebRTC server + ONNX
│   │   └── requirements.txt # Python dependencies
│   └── models/             # ONNX model files
│
├── 📊 Benchmarking & Tools
│   ├── bench/
│   │   ├── run_bench.sh    # Automated performance testing
│   │   └── benchmark.py    # Metrics collection backend
│   └── scripts/
│       └── setup_models.sh # Model download & optimization
│
└── 🚀 Deployment
    ├── Dockerfile          # Production container
    ├── docker-compose.yml  # Service orchestration
    ├── start.sh           # Universal startup script
    └── nginx.conf         # Reverse proxy configuration
```

### **Key Components Deep Dive**

#### **WebRTC Manager (`lib/webrtc-manager.ts`)**

- **Dual-mode inference**: Seamless switching between WASM and server
- **Connection management**: ICE handling, reconnection logic
- **Performance optimization**: Frame queuing, duplicate detection prevention

```typescript
class WebRTCManager {
  constructor(mode: "server" | "wasm") {
    this.mode = mode
    this.setupSocket()
    if (mode === "wasm") {
      this.initializeWASMInference()
    }
  }
  
  async processFrame(imageData: ImageData): Promise<Detection[]> {
    if (this.mode === "wasm") {
      return this.runWASMInference(imageData)
    } else {
      return this.sendToServer(imageData)
    }
  }
}
```

#### **Python Server (`server/main.py`)**

- **aiortc integration**: WebRTC peer connection handling
- **ONNX Runtime**: Optimized CPU/GPU inference
- **Frame processing**: Efficient video stream handling

```python
class ObjectDetector:
    def __init__(self, model_path: str):
        self.session = ort.InferenceSession(model_path)
        
    async def process_frame(self, frame: np.ndarray) -> List[Detection]:
        # Preprocess: resize, normalize, CHW format
        input_tensor = self.preprocess(frame)
        
        # Inference
        outputs = self.session.run(None, {self.input_name: input_tensor})
        
        # Postprocess: NMS, coordinate scaling
        return self.postprocess_yolo(outputs, frame.shape)
```

### **Adding Custom Models**

1. **Convert to ONNX format**:

```python
import torch
model = torch.load('your_model.pt')
torch.onnx.export(model, dummy_input, 'models/custom.onnx')
```

2. **Update inference pipeline**:

```typescript
// Add to webrtc-manager.ts
private async loadCustomModel() {
  this.wasmInference = await ort.InferenceSession.create('/models/custom.onnx')
}
```

3. **Customize postprocessing**:

```python
# Update server/main.py
def postprocess_custom(self, outputs, original_shape):
    # Your custom logic here
    return detections
```

---

## 🔍 Troubleshooting Guide

### **❌ Connection Issues**

| Problem | Symptoms | Solution |
|---------|----------|----------|
| **Phone can't connect** | "Connection failed" on phone | Use IP address instead of localhost |
| **WebRTC failed** | Video not showing | Check firewall, try different browser |
| **No detections** | Empty overlay | Verify model files, check console logs |

```bash
# Debug WebRTC connections
# Enable verbose logging in browser console:
localStorage.setItem('debug', '*')

# Check port availability
netstat -an | grep 3000
netstat -an | grep 8765
```

### **🐛 Performance Issues**

```bash
# Monitor system resources during benchmark
./bench/run_bench.sh --duration 60 --mode server

# Check for memory leaks
# Browser DevTools → Performance → Record session

# Optimize inference
export CONFIDENCE_THRESHOLD=0.8  # Reduce false positives
export INPUT_SIZE=320            # Smaller input for speed
```

### **🔧 Development Debug Tips**

```typescript
// Enable debug mode in WebRTC manager
const manager = new WebRTCManager('wasm')
manager.enableDebugMode(true)

// Monitor frame processing
manager.onDetectionResult = (result) => {
  console.log(`Processed frame in ${result.inference_time}ms`)
}
```

### **📊 Common Error Messages**

| Error | Cause | Fix |
|-------|-------|-----|
| `WASM inference failed` | Model not loaded | Check `models/` directory |
| `Server mode unavailable` | Python server not running | Start with `./start.sh --mode=server` |
| `ICE connection failed` | Network restrictions | Try different STUN servers |
| `Camera permission denied` | Browser security | Enable camera in browser settings |

---

## 🚀 Advanced Features

### **🎯 Custom Training Pipeline**

```python
# Train custom YOLO model
from ultralytics import YOLO

# Load pretrained model
model = YOLO('yolov5n.pt')

# Train on custom dataset
model.train(data='custom_dataset.yaml', epochs=100)

# Export to ONNX
model.export(format='onnx', opset=11)
```

### **📊 Real-time Analytics**

```typescript
// Advanced metrics collection
class AdvancedMetrics {
  trackObjectCounts(detections: Detection[]) {
    const counts = detections.reduce((acc, det) => {
      acc[det.label] = (acc[det.label] || 0) + 1
      return acc
    }, {})
    
    this.sendToAnalytics(counts)
  }
}
```

### **🌍 Multi-room Support**

```typescript
// Socket.IO room management
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId)
    socket.to(roomId).emit('user-joined', socket.id)
  })
})
```

### **🔒 Production Security**

```typescript
// Rate limiting and authentication
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

app.use('/api/', limiter)
```

---

## 📈 Performance Optimization

### **🚀 WASM Optimization**

```typescript
// WebAssembly threading
const wasmOptions = {
  executionProviders: ['wasm'],
  graphOptimizationLevel: 'all',
  executionMode: 'parallel',
  intraOpNumThreads: 4
}
```

### **🐍 Server Optimization**

```python
# GPU acceleration
providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
session = ort.InferenceSession(model_path, providers=providers)

# Batch processing
def process_batch(frames: List[np.ndarray]) -> List[List[Detection]]:
    batch_input = np.stack([preprocess(frame) for frame in frames])
    batch_outputs = session.run(None, {input_name: batch_input})
    return [postprocess(output) for output in batch_outputs]
```

### **🌐 Network Optimization**

```typescript
// WebRTC configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:your-turn-server.com', credential: 'xxx' }
  ],
  bundlePolicy: 'max-bundle',
  iceCandidatePoolSize: 10
}
```

---

## 🤝 Contributing

### **Development Setup**

```bash
# Fork the repository
git clone https://github.com/YOUR_USERNAME/object-detection-with-YOLO.git
cd object-detection-with-YOLO

# Create feature branch
git checkout -b feature/your-feature-name

# Install dependencies
npm install
cd server && pip install -r requirements.txt

# Start development
npm run dev
```

### **Code Standards**

- **TypeScript**: Strict mode enabled, full type coverage
- **Python**: Black formatting, type hints required
- **Testing**: Jest for frontend, pytest for backend
- **Documentation**: JSDoc for TypeScript, docstrings for Python

### **Pull Request Guidelines**

1. **🧪 Test Coverage**: Add tests for new features
2. **📚 Documentation**: Update README and inline docs
3. **🎯 Performance**: Benchmark before/after changes
4. **🔧 Compatibility**: Test on multiple browsers/devices

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Ultralytics](https://ultralytics.com/)** - YOLOv5 models and training framework
- **[ONNX Runtime](https://onnxruntime.ai/)** - Cross-platform inference optimization
- **[aiortc](https://github.com/aiortc/aiortc)** - Python WebRTC implementation
- **[Next.js](https://nextjs.org/)** - React framework and developer experience
- **[WebRTC](https://webrtc.org/)** - Real-time communication standards

---

## 📞 Support

- **🐛 Issues**: [GitHub Issues](https://github.com/ananya5151/object-detection-with-YOLO/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/ananya5151/object-detection-with-YOLO/discussions)
- **📧 Contact**: [ananya.verma.may22@gmail.com](mailto:ananya.verma.may22@gmail.com)

---

<div align="center">

**Built with ❤️ for the WebRTC + AI Community**

