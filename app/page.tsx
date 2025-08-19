"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VideoStream } from "@/components/video-stream"
import { MetricsDisplay } from "@/components/metrics-display"
import { QRCodeSVG } from "qrcode.react"

export default function Home() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionUrl, setConnectionUrl] = useState("")
  const [mode, setMode] = useState<"server" | "wasm">("wasm")
  const [metrics, setMetrics] = useState<any>(null)
  const [isNgrokActive, setIsNgrokActive] = useState(false)

  useEffect(() => {
    const checkNgrokUrl = async () => {
      try {
        const response = await fetch("/api/ngrok-url")
        if (response.ok) {
          const data = await response.json()
          if (data.ngrokUrl) {
            setConnectionUrl(`${data.ngrokUrl}/phone`)
            setIsNgrokActive(true)
            console.log("[v0] Using ngrok URL:", data.ngrokUrl)
            return
          }
        }
      } catch (error) {
        console.log("[v0] No ngrok URL available, using localhost")
      }

      // Fallback to localhost
      const url = `${window.location.origin}/phone`
      setConnectionUrl(url)
      setIsNgrokActive(false)
    }

    checkNgrokUrl()
  }, [])

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Real-time WebRTC Object Detection</h1>
          <p className="text-muted-foreground">
            Stream video from your phone and see real-time object detection overlays
          </p>
          {isNgrokActive && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              🌐 External Access Active (ngrok)
            </Badge>
          )}
        </div>

        {/* Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Mode</CardTitle>
            <CardDescription>Choose between server-side inference or client-side WASM processing</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button variant={mode === "server" ? "default" : "outline"} onClick={() => setMode("server")}>
              Server Mode (High Performance)
            </Button>
            <Button variant={mode === "wasm" ? "default" : "outline"} onClick={() => setMode("wasm")}>
              WASM Mode (Low Resource)
            </Button>
            <Badge variant="secondary">Current: {mode.toUpperCase()}</Badge>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Phone Connection */}
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Phone</CardTitle>
              <CardDescription>
                {isNgrokActive
                  ? "Scan the QR code or visit the URL on your phone (works from anywhere with internet)"
                  : "Scan the QR code or visit the URL on your phone (must be on same WiFi network)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectionUrl && (
                <div className="flex flex-col items-center space-y-4">
                  <QRCodeSVG value={connectionUrl} size={200} />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Or visit:</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded break-all">{connectionUrl}</code>
                    <p className="text-xs text-muted-foreground mt-2">
                      {isNgrokActive ? "🌐 External access via ngrok" : "🏠 Local network only"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Real-time latency and processing statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsDisplay metrics={metrics} />
            </CardContent>
          </Card>
        </div>

        {/* Video Stream */}
        <Card>
          <CardHeader>
            <CardTitle>Live Video Stream</CardTitle>
            <CardDescription>Video feed from your phone with object detection overlays</CardDescription>
          </CardHeader>
          <CardContent>
            <VideoStream mode={mode} onMetricsUpdate={setMetrics} onStreamingChange={setIsStreaming} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
