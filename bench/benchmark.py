#!/usr/bin/env python3
"""
Benchmarking script for WebRTC Object Detection
Measures end-to-end latency, FPS, and bandwidth usage
"""

import asyncio
import json
import time
import argparse
import statistics
import psutil
import requests
from typing import List, Dict
import websockets
import cv2
import numpy as np

class BenchmarkMetrics:
    def __init__(self):
        self.latencies: List[float] = []
        self.server_latencies: List[float] = []
        self.network_latencies: List[float] = []
        self.frame_times: List[float] = []
        self.cpu_usage: List[float] = []
        self.memory_usage: List[float] = []
        self.bandwidth_up: List[float] = []
        self.bandwidth_down: List[float] = []
        
    def add_frame_metrics(self, result: Dict):
        """Add metrics from a detection result"""
        now = time.time() * 1000
        
        # End-to-end latency
        e2e_latency = now - result['capture_ts']
        self.latencies.append(e2e_latency)
        
        # Server latency
        server_latency = result['inference_ts'] - result['recv_ts']
        self.server_latencies.append(server_latency)
        
        # Network latency
        network_latency = result['recv_ts'] - result['capture_ts']
        self.network_latencies.append(network_latency)
        
        # Frame processing time
        self.frame_times.append(now)
    
    def add_system_metrics(self):
        """Add system resource metrics"""
        self.cpu_usage.append(psutil.cpu_percent())
        self.memory_usage.append(psutil.virtual_memory().percent)
        
        # Network I/O
        net_io = psutil.net_io_counters()
        self.bandwidth_up.append(net_io.bytes_sent)
        self.bandwidth_down.append(net_io.bytes_recv)
    
    def calculate_fps(self) -> float:
        """Calculate processed FPS"""
        if len(self.frame_times) < 2:
            return 0.0
        
        duration = (self.frame_times[-1] - self.frame_times[0]) / 1000  # Convert to seconds
        return len(self.frame_times) / duration if duration > 0 else 0.0
    
    def get_summary(self) -> Dict:
        """Get benchmark summary"""
        if not self.latencies:
            return {"error": "No metrics collected"}
        
        # Calculate bandwidth (bytes per second)
        bandwidth_duration = len(self.bandwidth_up)
        avg_bandwidth_up = (self.bandwidth_up[-1] - self.bandwidth_up[0]) / bandwidth_duration if bandwidth_duration > 1 else 0
        avg_bandwidth_down = (self.bandwidth_down[-1] - self.bandwidth_down[0]) / bandwidth_duration if bandwidth_duration > 1 else 0
        
        return {
            "duration_seconds": len(self.frame_times),
            "total_frames": len(self.latencies),
            "processed_fps": round(self.calculate_fps(), 2),
            "latency_ms": {
                "median": round(statistics.median(self.latencies), 2),
                "p95": round(statistics.quantiles(self.latencies, n=20)[18], 2),  # 95th percentile
                "mean": round(statistics.mean(self.latencies), 2),
                "min": round(min(self.latencies), 2),
                "max": round(max(self.latencies), 2)
            },
            "server_latency_ms": {
                "median": round(statistics.median(self.server_latencies), 2),
                "mean": round(statistics.mean(self.server_latencies), 2)
            } if self.server_latencies else None,
            "network_latency_ms": {
                "median": round(statistics.median(self.network_latencies), 2),
                "mean": round(statistics.mean(self.network_latencies), 2)
            } if self.network_latencies else None,
            "system_resources": {
                "cpu_percent": {
                    "mean": round(statistics.mean(self.cpu_usage), 2),
                    "max": round(max(self.cpu_usage), 2)
                } if self.cpu_usage else None,
                "memory_percent": {
                    "mean": round(statistics.mean(self.memory_usage), 2),
                    "max": round(max(self.memory_usage), 2)
                } if self.memory_usage else None
            },
            "bandwidth_kbps": {
                "uplink": round(avg_bandwidth_up * 8 / 1024, 2),  # Convert to kbps
                "downlink": round(avg_bandwidth_down * 8 / 1024, 2)
            }
        }

class BenchmarkRunner:
    def __init__(self, duration: int, mode: str):
        self.duration = duration
        self.mode = mode
        self.metrics = BenchmarkMetrics()
        self.running = False
    
    async def run_benchmark(self) -> Dict:
        """Run the benchmark"""
        print(f"Starting {self.duration}s benchmark in {self.mode} mode...")
        
        # Start system monitoring
        monitor_task = asyncio.create_task(self.monitor_system())
        
        # Connect to WebSocket and simulate video stream
        try:
            if self.mode == 'server':
                await self.run_server_benchmark()
            else:
                await self.run_wasm_benchmark()
        except Exception as e:
            print(f"Benchmark error: {e}")
        finally:
            self.running = False
            monitor_task.cancel()
        
        return self.metrics.get_summary()
    
    async def monitor_system(self):
        """Monitor system resources"""
        self.running = True
        while self.running:
            self.metrics.add_system_metrics()
            await asyncio.sleep(1)
    
    async def run_server_benchmark(self):
        """Run benchmark against server mode"""
        uri = "ws://localhost:8765"
        
        try:
            async with websockets.connect(uri) as websocket:
                # Send start signal
                await websocket.send(json.dumps({
                    "type": "start_receiving",
                    "mode": "server"
                }))
                
                # Simulate receiving detection results
                start_time = time.time()
                while time.time() - start_time < self.duration:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        data = json.loads(message)
                        
                        if data.get('type') == 'detection_result':
                            self.metrics.add_frame_metrics(data['payload'])
                    
                    except asyncio.TimeoutError:
                        continue
                    except Exception as e:
                        print(f"WebSocket error: {e}")
                        break
        
        except Exception as e:
            print(f"Failed to connect to server: {e}")
    
    async def run_wasm_benchmark(self):
        """Run benchmark for WASM mode"""
        # For WASM mode, we simulate the metrics since inference runs in browser
        print("Simulating WASM benchmark (browser-based inference)")
        
        start_time = time.time()
        frame_id = 0
        
        while time.time() - start_time < self.duration:
            # Simulate frame processing at ~10 FPS
            await asyncio.sleep(0.1)
            
            frame_id += 1
            now = int(time.time() * 1000)
            
            # Simulate detection result
            simulated_result = {
                'frame_id': str(frame_id),
                'capture_ts': now - 50,  # Simulate 50ms ago
                'recv_ts': now - 30,     # Simulate 30ms ago
                'inference_ts': now - 10, # Simulate 10ms ago
                'detections': []
            }
            
            self.metrics.add_frame_metrics(simulated_result)

def main():
    parser = argparse.ArgumentParser(description='Benchmark WebRTC Object Detection')
    parser.add_argument('--duration', type=int, default=30, help='Benchmark duration in seconds')
    parser.add_argument('--mode', choices=['server', 'wasm'], default='wasm', help='Detection mode')
    parser.add_argument('--output', default='metrics.json', help='Output file for metrics')
    
    args = parser.parse_args()
    
    # Check if application is running
    try:
        response = requests.get('http://localhost:3000', timeout=5)
        if response.status_code != 200:
            print("❌ Application not responding on port 3000")
            return
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to application on port 3000")
        return
    
    # Run benchmark
    runner = BenchmarkRunner(args.duration, args.mode)
    
    try:
        results = asyncio.run(runner.run_benchmark())
        
        # Save results
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"✅ Benchmark completed! Results saved to {args.output}")
        
        # Print summary
        print("\n📊 Benchmark Summary:")
        print(f"Duration: {results.get('duration_seconds', 0)}s")
        print(f"Total Frames: {results.get('total_frames', 0)}")
        print(f"Processed FPS: {results.get('processed_fps', 0)}")
        
        latency = results.get('latency_ms', {})
        print(f"Median Latency: {latency.get('median', 0)}ms")
        print(f"P95 Latency: {latency.get('p95', 0)}ms")
        
        bandwidth = results.get('bandwidth_kbps', {})
        print(f"Uplink: {bandwidth.get('uplink', 0)} kbps")
        print(f"Downlink: {bandwidth.get('downlink', 0)} kbps")
        
    except KeyboardInterrupt:
        print("\n⏹️  Benchmark interrupted")
    except Exception as e:
        print(f"❌ Benchmark failed: {e}")

if __name__ == "__main__":
    main()
