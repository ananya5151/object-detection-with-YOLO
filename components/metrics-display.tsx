"use client"
import { Badge } from "@/components/ui/badge"

interface MetricsDisplayProps {
  metrics: {
    median_latency?: number
    p95_latency?: number
    server_latency?: number
    network_latency?: number
    processed_fps?: number
  } | null
}

export function MetricsDisplay({ metrics }: MetricsDisplayProps) {
  if (!metrics) {
    return <div className="text-center text-muted-foreground">No metrics available</div>
  }

  const formatLatency = (ms: number) => `${Math.round(ms)}ms`
  const formatFPS = (fps: number) => `${Math.round(fps * 10) / 10} FPS`

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {metrics.median_latency ? formatLatency(metrics.median_latency) : "N/A"}
          </div>
          <div className="text-xs text-muted-foreground">Median Latency</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {metrics.p95_latency ? formatLatency(metrics.p95_latency) : "N/A"}
          </div>
          <div className="text-xs text-muted-foreground">P95 Latency</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <Badge variant="secondary">{metrics.server_latency ? formatLatency(metrics.server_latency) : "N/A"}</Badge>
          <div className="text-xs text-muted-foreground mt-1">Server</div>
        </div>
        <div className="text-center">
          <Badge variant="secondary">{metrics.network_latency ? formatLatency(metrics.network_latency) : "N/A"}</Badge>
          <div className="text-xs text-muted-foreground mt-1">Network</div>
        </div>
        <div className="text-center">
          <Badge variant="secondary">{metrics.processed_fps ? formatFPS(metrics.processed_fps) : "N/A"}</Badge>
          <div className="text-xs text-muted-foreground mt-1">FPS</div>
        </div>
      </div>
    </div>
  )
}
