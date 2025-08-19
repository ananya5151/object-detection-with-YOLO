"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PhoneCamera } from "@/components/phone-camera"

export default function PhonePage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Phone Camera</h1>
          <p className="text-muted-foreground text-sm">Stream your camera to the detection system</p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <Badge
                variant={
                  connectionStatus === "connected"
                    ? "default"
                    : connectionStatus === "connecting"
                      ? "secondary"
                      : "destructive"
                }
              >
                {connectionStatus.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Camera Stream */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Camera Feed</CardTitle>
            <CardDescription>Your camera stream will appear below</CardDescription>
          </CardHeader>
          <CardContent>
            <PhoneCamera onConnectionChange={setConnectionStatus} onStreamingChange={setIsStreaming} />
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Allow camera access when prompted</p>
            <p>2. Point your camera at objects to detect</p>
            <p>3. View results on the main screen</p>
            <p>4. Keep this tab active for best performance</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
