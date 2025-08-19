"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { WebRTCClient } from "@/lib/webrtc-client"

interface PhoneCameraProps {
  onConnectionChange: (status: "disconnected" | "connecting" | "connected") => void
  onStreamingChange: (streaming: boolean) => void
}

export function PhoneCamera({ onConnectionChange, onStreamingChange }: PhoneCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const webrtcClientRef = useRef<WebRTCClient | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [permissionState, setPermissionState] = useState<string | null>(null)

  useEffect(() => {
    console.log("[v0] Initializing WebRTC Client for phone")
    webrtcClientRef.current = new WebRTCClient()

    webrtcClientRef.current.onConnectionStateChange = (state) => {
      console.log("[v0] Connection state changed:", state)
      onConnectionChange(state)
    }

    return () => {
      if (webrtcClientRef.current) {
        webrtcClientRef.current.cleanup()
      }
    }
  }, [onConnectionChange])

  const requestCameraPermission = async () => {
    try {
      console.log("[v0] Requesting camera permission")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      console.log("[v0] Camera permission granted")
      setHasPermission(true)
      setErrorMsg(null)
      return stream
    } catch (error) {
      console.error("[v0] Error accessing camera:", error)
      setErrorMsg(String(error))
      return null
    }
  }

  // Permission diagnostic: query Permissions API if available
  const checkPermission = async () => {
    try {
      if ((navigator as any).permissions && (navigator as any).permissions.query) {
        // 'camera' permission name may not be supported in all browsers; try best-effort
        try {
          const p = await (navigator as any).permissions.query({ name: 'camera' })
          setPermissionState(p.state)
          p.onchange = () => setPermissionState(p.state)
          console.log('[v0] permissions.camera state=', p.state)
          return
        } catch (err) {
          // fallback: try 'microphone' or just report not supported
          try {
            const p2 = await (navigator as any).permissions.query({ name: 'microphone' })
            setPermissionState(p2.state)
            p2.onchange = () => setPermissionState(p2.state)
            console.log('[v0] permissions.microphone state=', p2.state)
            return
          } catch (err2) {
            console.log('[v0] Permissions API query not supported for camera/microphone', err2)
          }
        }
      }

      setPermissionState('unknown')
      console.log('[v0] Permissions API not available')
    } catch (err) {
      console.warn('[v0] checkPermission error', err)
      setPermissionState('error')
    }
  }

  const startStreaming = async () => {
    console.log("[v0] Starting video stream")
    let stream = null

    if (!hasPermission) {
      stream = await requestCameraPermission()
      if (!stream) return
    } else if (videoRef.current?.srcObject) {
      stream = videoRef.current.srcObject as MediaStream
    }

    if (stream && webrtcClientRef.current) {
      await webrtcClientRef.current.startStreaming(stream)
      setIsStreaming(true)
      onStreamingChange(true)
      console.log("[v0] Video streaming started")
    }
  }

  // Helper: combine permission request + start in one tap for mobile friendliness
  const startCameraAndStream = async () => {
    if (!hasPermission) {
      const s = await requestCameraPermission()
      if (!s) return
    }
    await startStreaming()
  }

  const stopStreaming = () => {
    console.log("[v0] Stopping video stream")
    if (webrtcClientRef.current) {
      webrtcClientRef.current.stopStreaming()
      setIsStreaming(false)
      onStreamingChange(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {!hasPermission && (
          <Button onClick={startCameraAndStream} variant="default">
            Start Camera
          </Button>
        )}
        {hasPermission && (
          <>
            <Button onClick={startStreaming} disabled={isStreaming} variant={isStreaming ? "secondary" : "default"}>
              {isStreaming ? "Streaming..." : "Start Stream"}
            </Button>
            <Button onClick={stopStreaming} disabled={!isStreaming} variant="outline">
              Stop
            </Button>
          </>
        )}
        {errorMsg && <div className="text-red-500 text-sm">{errorMsg}</div>}
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden phone-preview"
        onClick={() => {
          // allow tapping the preview to request permissions (user gesture)
          if (!hasPermission) startCameraAndStream().catch((e) => console.warn('[v0] tap start error', e))
        }}
      >
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {!hasPermission && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <p>Camera access required</p>
          </div>
        )}
      </div>
    </div>
  )
}
