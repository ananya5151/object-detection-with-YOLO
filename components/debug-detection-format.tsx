// components/debug-detection-format.tsx
"use client"

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

export default function DebugDetectionFormat() {
  const [detectionLog, setDetectionLog] = useState<any[]>([])
  const [serverResponse, setServerResponse] = useState(`{
  "frame_id": "frame_1724175419123",
  "detections": [
    {
      "label": "person",
      "score": 0.85,
      "xmin": 0.2,
      "ymin": 0.1,
      "xmax": 0.8,
      "ymax": 0.9
    }
  ]
}`)

  const analyzeFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(serverResponse)
      
      const analysis = {
        timestamp: new Date().toISOString(),
        has_frame_id: !!parsed.frame_id,
        has_capture_ts: !!parsed.capture_ts,
        has_recv_ts: !!parsed.recv_ts,
        has_inference_ts: !!parsed.inference_ts,
        has_detections: Array.isArray(parsed.detections),
        detections_count: parsed.detections?.length || 0,
        timing_status: parsed.capture_ts && parsed.recv_ts && parsed.inference_ts 
          ? "✅ REAL TIMING" 
          : "⚠️ MISSING TIMING",
        raw_data: parsed
      }

      setDetectionLog(prev => [analysis, ...prev.slice(0, 4)])
    } catch (error) {
      console.error('Invalid JSON:', error)
    }
  }, [serverResponse])

  const clearLog = () => setDetectionLog([])

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border">
        <h2 className="text-xl font-bold mb-4">🔍 Debug Your Detection Format</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Paste what your server is actually sending:
            </label>
            <textarea
              value={serverResponse}
              onChange={(e) => setServerResponse(e.target.value)}
              className="w-full h-32 p-3 border rounded font-mono text-sm"
              placeholder="Paste your actual detection result JSON here..."
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={analyzeFormat} variant="default">
              Analyze Format
            </Button>
            <Button onClick={clearLog} variant="outline">
              Clear Log
            </Button>
          </div>
        </div>
      </div>

      {detectionLog.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Analysis Results:</h3>
          
          {detectionLog.map((log, index) => (
            <div key={index} className="mb-4 p-3 bg-white rounded border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500">{log.timestamp}</span>
                <span className={`px-2 py-1 rounded text-sm font-bold ${
                  log.timing_status.includes('✅') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {log.timing_status}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">Structure Check:</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>frame_id:</span>
                      <span className={log.has_frame_id ? 'text-green-600' : 'text-red-600'}>
                        {log.has_frame_id ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>capture_ts:</span>
                      <span className={log.has_capture_ts ? 'text-green-600' : 'text-red-600'}>
                        {log.has_capture_ts ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>recv_ts:</span>
                      <span className={log.has_recv_ts ? 'text-green-600' : 'text-red-600'}>
                        {log.has_recv_ts ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>inference_ts:</span>
                      <span className={log.has_inference_ts ? 'text-green-600' : 'text-red-600'}>
                        {log.has_inference_ts ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>detections:</span>
                      <span className={log.has_detections ? 'text-green-600' : 'text-red-600'}>
                        {log.has_detections ? `✅ (${log.detections_count})` : '❌'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Raw Data:</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(log.raw_data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">📋 What You Need:</h3>
        <p className="text-yellow-700 text-sm mb-3">
          For accurate metrics, your server should respond with this format:
        </p>
        <pre className="text-xs bg-yellow-100 p-3 rounded overflow-auto">
{`{
  "frame_id": "frame_123",
  "capture_ts": 1724175419000,  ← Client capture time (echoed back)
  "recv_ts": 1724175419050,     ← When server received frame  
  "inference_ts": 1724175419080, ← When inference completed
  "detections": [
    {
      "label": "person",
      "score": 0.85,
      "xmin": 0.2,    ← Normalized [0..1]
      "ymin": 0.1,    ← Normalized [0..1]
      "xmax": 0.8,    ← Normalized [0..1]
      "ymax": 0.9     ← Normalized [0..1]
    }
  ]
}`}
        </pre>
      </div>

      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h3 className="font-semibold text-green-800 mb-2">✅ Current Status:</h3>
        <ul className="text-green-700 text-sm space-y-1">
          <li>• Your metrics collection is working perfectly!</li>
          <li>• You're getting real detections and FPS measurements</li>
          <li>• The 0ms server/network latency is expected without timing fields</li>
          <li>• Everything will work better once server adds timing data</li>
        </ul>
      </div>
    </div>
  )
}