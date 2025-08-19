"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { WebRTCManager } from "@/lib/webrtc-manager"
import { DetectionOverlay } from "./detection-overlay"

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
  // eslint-disable-next-line import/no-mutable-exports
  // ...existing code...
  let sharedWebRTCManager: WebRTCManager | null = (globalThis as any).__sharedWebRTCManager || null
  if (!sharedWebRTCManager) {
    // Create lazily; store on globalThis to persist across hot reloads
    try {
      sharedWebRTCManager = new WebRTCManager(mode)
        ; (globalThis as any).__sharedWebRTCManager = sharedWebRTCManager
    } catch (e) {
      // If constructor throws (shouldn't), fallback to null
      sharedWebRTCManager = null
    }
  }
  const webrtcManagerRef = useRef<WebRTCManager | null>(sharedWebRTCManager)
  const [isReceiving, setIsReceiving] = useState(false)
  const [detections, setDetections] = useState<DetectionFrame | null>(null)
  const [latencyStats, setLatencyStats] = useState<number[]>([])

  const handleDetectionResult = useCallback(
    (result: DetectionFrame) => {
      // Defer state updates to avoid React "setState during render" warnings
      setTimeout(() => {
        console.log("[v0] Received detection result:", result)
        setDetections(result)
        // Calculate end-to-end latency and append to stats
        const now = Date.now()
        const latency = now - result.capture_ts
        setLatencyStats((prev) => {
          return [...prev, latency].slice(-100) // Keep last 100 measurements
        })
      }, 0)
    },
    [onMetricsUpdate],
  )

  // Compute aggregated metrics when latencyStats changes and report upward.
  useEffect(() => {
    if (!latencyStats.length) return

    const sorted = [...latencyStats].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const avg = latencyStats.reduce((a, b) => a + b, 0) / latencyStats.length
    const processedFps = avg > 0 ? 1000 / avg : 0

    try {
      // server_latency and network_latency are best-effort here; pass undefined if not available in last detection
      const latest = detections
      onMetricsUpdate({
        median_latency: median,
        p95_latency: p95,
        server_latency: latest ? latest.inference_ts - latest.recv_ts : undefined,
        network_latency: latest ? latest.recv_ts - latest.capture_ts : undefined,
        processed_fps: processedFps,
      })
    } catch (err) {
      console.warn('[v0] onMetricsUpdate error', err)
    }
  }, [latencyStats, detections, onMetricsUpdate])

  useEffect(() => {
    // We keep a shared singleton manager to prevent duplicate instances in dev (StrictMode) and fast-refresh
    if (!webrtcManagerRef.current) {
      console.log("[v0] Initializing (or reusing) WebRTC Manager in", mode, "mode")
      // If shared manager exists on global, reuse; otherwise it was created above
      webrtcManagerRef.current = (globalThis as any).__sharedWebRTCManager || webrtcManagerRef.current

      if (!webrtcManagerRef.current) {
        // As a last resort, create one
        webrtcManagerRef.current = new WebRTCManager(mode)
          ; (globalThis as any).__sharedWebRTCManager = webrtcManagerRef.current
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


  // Remove manual start/stop logic. Streaming will start automatically when available.

  return (
    <div className="space-y-4">
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
      </div>
    </div>
  )
}
