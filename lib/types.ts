export interface Detection {
  label: string
  score: number
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

export interface DetectionFrame {
  frame_id: string
  capture_ts: number
  recv_ts: number
  inference_ts: number
  detections: Detection[]
}

export interface MetricsData {
  median_latency: number
  p95_latency: number
  processed_fps: number
  uplink_kbps: number
  downlink_kbps: number
}
