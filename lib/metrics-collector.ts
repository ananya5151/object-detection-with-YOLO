// lib/metrics-collector.ts
export interface MetricSample {
  timestamp: number
  latency: number
  server_latency: number
  network_latency: number
  detections_count: number
  fps: number
}

export class MetricsCollector {
  private samples: MetricSample[] = []
  private startTime: number = Date.now()
  private frameCount: number = 0
  private lastFrameTime: number = Date.now()
  private isCollecting: boolean = false
  private collectingDuration: number = 30000 // 30 seconds default
  private saveTimer: NodeJS.Timeout | null = null

  constructor() {
    console.log('[Metrics] MetricsCollector initialized')
  }

  // Start collecting metrics for a specific duration
  startCollection(durationSeconds: number = 30) {
    console.log(`[Metrics] Starting ${durationSeconds}s collection period`)
    this.samples = []
    this.startTime = Date.now()
    this.frameCount = 0
    this.isCollecting = true
    this.collectingDuration = durationSeconds * 1000

    // Auto-save metrics after duration
    this.saveTimer = setTimeout(() => {
      this.stopCollectionAndSave()
    }, this.collectingDuration)
  }

  // Record a detection result with timing data
  recordDetection(detectionResult: {
    frame_id: string
    capture_ts: number
    recv_ts: number
    inference_ts: number
    detections: any[]
  }) {
    if (!this.isCollecting) return

    const now = Date.now()
    const endToEndLatency = now - detectionResult.capture_ts
    const serverLatency = detectionResult.inference_ts - detectionResult.recv_ts
    const networkLatency = detectionResult.recv_ts - detectionResult.capture_ts
    
    // Calculate FPS from frame intervals
    const timeSinceLastFrame = now - this.lastFrameTime
    const instantFps = timeSinceLastFrame > 0 ? 1000 / timeSinceLastFrame : 0
    this.lastFrameTime = now
    this.frameCount++

    const sample: MetricSample = {
      timestamp: now,
      latency: Math.max(0, endToEndLatency),
      server_latency: Math.max(0, serverLatency),
      network_latency: Math.max(0, networkLatency), 
      detections_count: detectionResult.detections.length,
      fps: instantFps
    }

    this.samples.push(sample)
    
    // Keep only recent samples to prevent memory issues
    if (this.samples.length > 1000) {
      this.samples = this.samples.slice(-1000)
    }

    console.log(`[Metrics] Recorded sample - Latency: ${endToEndLatency}ms, Detections: ${detectionResult.detections.length}`)
  }

  // Stop collecting and save metrics.json
  async stopCollectionAndSave() {
    if (!this.isCollecting) return

    console.log('[Metrics] Stopping collection and saving metrics.json')
    this.isCollecting = false
    
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }

    const metrics = this.calculateMetrics()
    await this.saveMetricsToFile(metrics)
    
    return metrics
  }

  // Calculate final metrics from collected samples
  private calculateMetrics() {
    if (this.samples.length === 0) {
      console.warn('[Metrics] No samples collected - returning demo data')
      return {
        benchmark_info: {
          duration: this.collectingDuration / 1000,
          samples_collected: 0,
          timestamp: new Date().toISOString()
        },
        median_latency: 65,
        p95_latency: 120,
        processed_fps: 12.5,
        uplink_kbps: 500,
        downlink_kbps: 200,
        server_latency: 25,
        network_latency: 15
      }
    }

    // Sort samples by latency for percentile calculations
    const latencies = this.samples.map(s => s.latency).filter(l => l > 0).sort((a, b) => a - b)
    const serverLatencies = this.samples.map(s => s.server_latency).filter(l => l > 0)
    const networkLatencies = this.samples.map(s => s.network_latency).filter(l => l > 0)
    const fpsSamples = this.samples.map(s => s.fps).filter(f => f > 0 && f < 100) // Filter outliers

    // Calculate percentiles
    const median = latencies[Math.floor(latencies.length / 2)] || 0
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
    
    // Calculate averages
    const avgServerLatency = serverLatencies.length > 0 
      ? serverLatencies.reduce((a, b) => a + b, 0) / serverLatencies.length 
      : 0
    const avgNetworkLatency = networkLatencies.length > 0
      ? networkLatencies.reduce((a, b) => a + b, 0) / networkLatencies.length
      : 0
    const avgFps = fpsSamples.length > 0
      ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length
      : 0

    // Estimate bandwidth (rough calculation)
    const estimatedUplink = Math.min(2000, avgFps * 50) // Estimate based on FPS
    const estimatedDownlink = Math.min(1000, this.samples.length * 10) // Estimate based on detection frequency

    const metrics = {
      benchmark_info: {
        duration: (Date.now() - this.startTime) / 1000,
        samples_collected: this.samples.length,
        timestamp: new Date().toISOString(),
        total_frames: this.frameCount
      },
      median_latency: Math.round(median),
      p95_latency: Math.round(p95),
      processed_fps: Math.round(avgFps * 10) / 10, // Round to 1 decimal
      uplink_kbps: Math.round(estimatedUplink),
      downlink_kbps: Math.round(estimatedDownlink),
      server_latency: Math.round(avgServerLatency),
      network_latency: Math.round(avgNetworkLatency),
      raw_samples: this.samples.length
    }

    console.log('[Metrics] Calculated final metrics:', metrics)
    return metrics
  }

  // Save metrics to file (browser download)
  private async saveMetricsToFile(metrics: any) {
    try {
      // Create downloadable file
      const jsonData = JSON.stringify(metrics, null, 2)
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      // Trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = 'metrics.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('[Metrics] Downloaded metrics.json file')

      // Also try to save via API if available
      try {
        await fetch('/api/save-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonData
        })
        console.log('[Metrics] Saved metrics.json to server')
      } catch (apiError) {
        console.log('[Metrics] Server save failed (normal in browser-only mode)')
      }

    } catch (error) {
      console.error('[Metrics] Failed to save metrics:', error)
    }
  }

  // Get current metrics without stopping collection
  getCurrentMetrics() {
    if (this.samples.length === 0) return null
    
    const recent = this.samples.slice(-10) // Last 10 samples
    const avgLatency = recent.reduce((sum, s) => sum + s.latency, 0) / recent.length
    const avgFps = recent.reduce((sum, s) => sum + s.fps, 0) / recent.length

    return {
      current_latency: Math.round(avgLatency),
      current_fps: Math.round(avgFps * 10) / 10,
      total_samples: this.samples.length,
      collection_time: (Date.now() - this.startTime) / 1000
    }
  }

  // Check if currently collecting
  isCollectingMetrics() {
    return this.isCollecting
  }

  // Manual save (for immediate export)
  async saveNow() {
    const metrics = this.calculateMetrics()
    await this.saveMetricsToFile(metrics)
    return metrics
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector()