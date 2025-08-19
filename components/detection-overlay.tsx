"use client"

import { useEffect, useRef } from "react"

interface Detection {
  label: string
  score: number
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

interface DetectionOverlayProps {
  detections: Detection[]
  videoElement: HTMLVideoElement
}

export function DetectionOverlay({ detections, videoElement }: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !videoElement) {
      return
    }

    const resize = () => {
      const w = Math.max(1, videoElement.clientWidth)
      const h = Math.max(1, videoElement.clientHeight)
      // match CSS pixels
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
    }

    const draw = () => {
      resize()
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const det of detections) {
        const x = det.xmin * canvas.width
        const y = det.ymin * canvas.height
        const w = (det.xmax - det.xmin) * canvas.width
        const h = (det.ymax - det.ymin) * canvas.height

        // Box
        ctx.strokeStyle = "rgba(239,68,68,1)"
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 200))
        ctx.strokeRect(x, y, w, h)

        // Label background
        const label = `${det.label} (${Math.round(det.score * 100)}%)`
        ctx.font = "12px sans-serif"
        const textWidth = ctx.measureText(label).width
        const pad = 6
        ctx.fillStyle = "rgba(239,68,68,1)"
        ctx.fillRect(x, Math.max(0, y - 20), textWidth + pad, 18)
        // Text
        ctx.fillStyle = "white"
        ctx.fillText(label, x + 4, Math.max(0, y - 6))
      }
    }    // Draw initially and whenever detections change
    draw()

    // Redraw on window resize to keep overlay in sync
    window.addEventListener("resize", draw)
    return () => window.removeEventListener("resize", draw)
  }, [detections, videoElement])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
}
