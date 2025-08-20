//components\video-stream.tsx
"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { WebRTCManager } from "@/lib/webrtc-manager"
import { DetectionOverlay } from "./detection-overlay"
import { metricsCollector } from "@/lib/metrics-collector"
import { Badge } from "@/components/ui/badge"

import type { DetectionFrame } from "@/lib/types"

interface VideoStreamProps {
  mode: "server" | "wasm"
  onMetricsUpdate: (metrics: any) => void
  onStreamingChange: (streaming: boolean) => void
}

export function VideoStream({ mode, onMetricsUpdate, onStreamingChange }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Use a module-level shared manager to avoid duplicate instances (React StrictMode mounts twice in dev)
  let sharedWebRTCManager: WebRTCManager | null = (globalThis as any).__sharedWebRTCManager || null
  if (!sharedWebRTCManager) {
    // Create lazily; store on globalThis to persist across hot reloads
    try {
      sharedWebRTCManager = new WebRTCManager(mode)
      ;(globalThis as any).__sharedWebRTCManager = sharedWebRTCManager
    } catch (e) {
      // If constructor throws (shouldn't), fallback to null
      sharedWebRTCManager = null
    }
  }
  const webrtcManagerRef = useRef<WebRTCManager | null>(sharedWebRTCManager)
  const [isReceiving, setIsReceiving] = useState(false)
  const [detections, setDetections] = useState<DetectionFrame | null>(null)
  const [isCollectingMetrics, setIsCollectingMetrics] = useState(false)
  const [currentMetrics, setCurrentMetrics] = useState<any>(null)

  const handleDetectionResult = useCallback(
    (result: DetectionFrame) => {
      // Defer state updates to avoid React "setState during render" warnings
      setTimeout(() => {
        console.log("[v0] Received detection result:", result)
        setDetections(result)
        
        // Record metrics if collecting
        metricsCollector.recordDetection(result)
        
        // Update real-time metrics display
        const current = metricsCollector.getCurrentMetrics()
        if (current) {
          setCurrentMetrics(current)
          onMetricsUpdate({
            median_latency: current.current_latency,
            p95_latency: current.current_latency * 1.5, // Estimate
            processed_fps: current.current_fps,
            server_latency: result.inference_ts - result.recv_ts,
            network_latency: result.recv_ts - result.capture_ts,
          })
        }
      }, 0)
    },
    [onMetricsUpdate],
  )

  // Start metrics collection for 30 seconds
  const startMetricsCollection = useCallback(() => {
    console.log("[Metrics] Starting 30-second metrics collection...")
    setIsCollectingMetrics(true)
    metricsCollector.startCollection(30)
    
    // Update collection status
    const checkStatus = setInterval(() => {
      if (!metricsCollector.isCollectingMetrics()) {
        setIsCollectingMetrics(false)
        clearInterval(checkStatus)
        console.log("[Metrics] Collection completed - metrics.json should be downloaded")
      }
    }, 1000)
  }, [])

  // Stop metrics collection and save immediately
  const stopMetricsCollection = useCallback(async () => {
    console.log("[Metrics] Stopping metrics collection...")
    setIsCollectingMetrics(false)
    const final = await metricsCollector.stopCollectionAndSave()
    console.log("[Metrics] Final metrics saved:", final)
  }, [])

  // Download current metrics immediately
  const downloadMetricsNow = useCallback(async () => {
    console.log("[Metrics] Downloading current metrics...")
    const metrics = await metricsCollector.saveNow()
    console.log("[Metrics] Downloaded metrics:", metrics)
  }, [])

  useEffect(() => {
    // We keep a shared singleton manager to prevent duplicate instances in dev (StrictMode) and fast-refresh
    if (!webrtcManagerRef.current) {
      console.log("[v0] Initializing (or reusing) WebRTC Manager in", mode, "mode")
      // If shared manager exists on global, reuse; otherwise it was created above
      webrtcManagerRef.current = (globalThis as any).__sharedWebRTCManager || webrtcManagerRef.current

      if (!webrtcManagerRef.current) {
        // As a last resort, create one
        webrtcManagerRef.current = new WebRTCManager(mode)
        ;(globalThis as any).__sharedWebRTCManager = webrtcManagerRef.current
      }

      // Assign callbacks (this overwrites previous hooks safely)
      webrtcManagerRef.current.onVideoReceived = (stream) => {
        console.log("[v0] Video stream received")
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setIsReceiving(true)
          onStreamingChange(true)
        }
      }

      webrtcManagerRef.current.onDetectionResult = handleDetectionResult
    }

    return () => {
      // Do NOT call cleanup on the shared manager here. Keeping the shared manager alive
      // prevents double reconnects and preserves state across fast refresh / strict mode.
      webrtcManagerRef.current = null
    }
  }, [mode, handleDetectionResult, onStreamingChange])

  return (
    <div className="space-y-4">
      {/* Metrics Controls */}
      <div className="flex gap-2 mb-4 p-4 bg-muted rounded-lg">
        <div className="flex-1">
          <h3 className="font-semibold mb-2">Real Metrics Collection</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <Button 
              onClick={startMetricsCollection} 
              disabled={isCollectingMetrics}
              variant={isCollectingMetrics ? "secondary" : "default"}
              size="sm"
            >
              {isCollectingMetrics ? "Collecting..." : "Start 30s Collection"}
            </Button>
            
            <Button 
              onClick={stopMetricsCollection}
              disabled={!isCollectingMetrics}
              variant="outline"
              size="sm"
            >
              Stop & Save
            </Button>
            
            <Button 
              onClick={downloadMetricsNow}
              variant="outline" 
              size="sm"
            >
              Download Now
            </Button>
            
            {isCollectingMetrics && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                📊 Recording Real Metrics
              </Badge>
            )}
          </div>
        </div>
        
        {currentMetrics && (
          <div className="text-sm">
            <div>Samples: {currentMetrics.total_samples}</div>
            <div>Time: {Math.round(currentMetrics.collection_time)}s</div>
            <div>Latency: {currentMetrics.current_latency}ms</div>
            <div>FPS: {currentMetrics.current_fps}</div>
          </div>
        )}
      </div>

      {/* Detection Info */}
      <div className="flex gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">Detections:</span>
          <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
            {detections ? detections.detections.length : 0}
          </span>
          {detections && detections.detections.length > 0 && (
            <span className="text-xs text-green-600">
              Last: {detections.detections.map(d => d.label).join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Video Display */}
      <div className="relative bg-black rounded-lg overflow-hidden video-aspect-16-9">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        {detections && videoRef.current && (
          <DetectionOverlay detections={detections.detections} videoElement={videoRef.current} />
        )}
        {!isReceiving && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <p>Waiting for video stream...</p>
          </div>
        )}
        
        {isCollectingMetrics && (
          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
            🔴 RECORDING
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-muted-foreground p-3 bg-blue-50 rounded-lg">
        <h4 className="font-semibold mb-1">📊 How to Generate Real metrics.json:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Connect your phone camera (scan QR code)</li>
          <li>Point camera at objects to detect</li>
          <li>Click "Start 30s Collection" button above</li>
          <li>Use the detection for 30 seconds (move camera, detect objects)</li>
          <li>metrics.json will automatically download to your computer</li>
        </ol>
      </div>
    </div>
  )
}