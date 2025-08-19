import { io, type Socket } from "socket.io-client"
import type { Detection, DetectionFrame } from "./types"

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private socket: Socket | null = null
  private mode: "server" | "wasm"
  private wasmInference: any = null
  private sessionResultLogged = false
  private connectionRetries = 0
  private maxRetries = 3
  private isConnected = false
  private pendingRemoteCandidates: RTCIceCandidateInit[] = []
  private wasmInputSize = 640
  private outputStatsLogged = false
  private wasmProcessingActive = false
  private wasmInitializing = false
  private wasmReady = false
  private modelLoaded = false
  private frameQueue: ImageData[] = []
  private isProcessingFrame = false
  private preferredInputName = 'inputs'
  // Queue to hold incoming MediaStreams until WASM is ready
  private videoStreamQueue: MediaStream[] = []
  // Track which classIds we've already logged to avoid noisy output
  private classMappingDebugged: Set<number> = new Set()
  // Preferred mapping strategy: 'auto' lets heuristics pick; can be 'coco1'|'coco0'|'ssd-bg'
  private mappingPreference: 'auto' | 'coco1' | 'coco0' | 'ssd-bg' = 'auto'
  // Remember which model we selected for WASM so we can decide auto-fallbacks
  private selectedModel: string | null = null
  // Simple detection history to detect poor model performance and auto-fallback to YOLO
  private detectionHistory: number[] = []
  private detectionHistoryMax = 30
  private autoFallbackTried = false
  // Per-model detection score threshold (tunable)
  private detectionThreshold = 0.6

  public onVideoReceived: ((stream: MediaStream) => void) | null = null
  public onDetectionResult: ((result: DetectionFrame) => void) | null = null

  constructor(mode: "server" | "wasm") {
    this.mode = mode
    // Only run browser-specific initialization when executing in the browser
    if (typeof window !== 'undefined') {
      this.setupSocket()
      if (mode === "wasm") {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.initializeWASMInference()
      }
      // Expose for debugging from the browser console
      try {
        ; (window as any).__webrtcManager = this
      } catch (e) { /* ignore */ }
    } else {
      // Server-side / SSR: skip socket and WASM initialization
      // This prevents ReferenceError: RTCPeerConnection is not defined during SSR
      // Keep the object constructible for server-side code paths.
      // eslint-disable-next-line no-console
      console.log('[v0] WebRTCManager instantiated on server - skipping browser-only initialization')
    }
  }

  // Persistence helpers for preferred model config (best-effort)
  private loadModelConfig(): { inputName?: string; inputType?: string; inputShape?: number[] } | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null
      const raw = window.localStorage.getItem('webrtc_model_config_v1')
      if (!raw) return null
      return JSON.parse(raw)
    } catch (e) {
      return null
    }
  }

  private saveModelConfig(cfg: { inputName?: string; inputType?: string; inputShape?: number[] }) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return
      window.localStorage.setItem('webrtc_model_config_v1', JSON.stringify(cfg))
    } catch (e) {
      // ignore
    }
  }

  private setupSocket() {

    // Always use the same host and protocol as the frontend (works for localhost, LAN, and ngrok)
    const socketUrl = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000";

    console.log(`Connecting to Socket.IO server at ${socketUrl}`)

    this.socket = io(socketUrl, {
      // Allow the engine to negotiate transport (polling <-> websocket).
      // Forcing 'websocket' can produce noisy "WebSocket is closed before the connection is established" messages behind some proxies/ngrok.
      timeout: 5000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: this.maxRetries,
      reconnectionDelay: 1000,
    })

    this.socket.on("connect", () => {
      console.log("Socket.IO connected successfully")
      this.isConnected = true
      this.connectionRetries = 0
      // Ensure we are prepared to receive video as soon as offers arrive.
      // Create the RTCPeerConnection and attach ontrack handler when in server mode.
      if (this.mode === "server" && !this.peerConnection) {
        // startReceiving sets up peerConnection and emits start_receiving to others
        // fire-and-forget; any errors will be logged inside startReceiving
        // give a short delay to ensure other connect handlers settle
        setTimeout(() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.startReceiving()
          } catch (err) {
            console.error('startReceiving error:', err)
          }
        }, 50)
      }
      // Identify role as viewer so phones can target this client
      try {
        this.socket?.emit('identify', { role: 'viewer' })
      } catch (err) {
        console.warn('identify emit failed', err)
      }
    })

    this.socket.on("disconnect", () => {
      console.log("Socket.IO disconnected")
      this.isConnected = false
    })

    this.socket.on("detection_result", (data) => {
      if (this.onDetectionResult) {
        this.onDetectionResult(data)
      }
    })

    this.socket.on("offer", (offer) => {
      this.handleOffer(offer)
    })

    this.socket.on("ice_candidate", (candidate) => {
      this.handleIceCandidate(candidate)
    })

    this.socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message || error)
      this.connectionRetries++

      if (this.connectionRetries >= this.maxRetries && this.mode === "server") {
        console.log("Max connection retries reached, falling back to WASM mode")
        this.mode = "wasm"
        this.initializeWASMInference()
      }
    })
  }

  private async initializeWASMInference() {
    if (this.wasmInitializing || this.wasmReady) return

    this.wasmInitializing = true
    this.wasmReady = false
    this.modelLoaded = false

    try {
      let ort: any
      // Load ONNX Runtime (CDN preferred, local fallback)
      try {
        const script = document.createElement("script")
        script.src = "https://unpkg.com/onnxruntime-web@1.16.3/dist/ort.min.js"
        document.head.appendChild(script)

        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
        })

        ort = (window as any).ort
        if (!ort) throw new Error("ONNX Runtime not available after CDN load")
        if (ort.env && ort.env.wasm) {
          ort.env.wasm.wasmPaths = "https://unpkg.com/onnxruntime-web@1.16.3/dist/"
          ort.env.wasm.numThreads = 1
          ort.env.logLevel = "warning"
        }
      } catch (cdnErr) {
        // Fallback to local import
        const ortModule = await import("onnxruntime-web")
        ort = ortModule.default || ortModule
      }

      // Use YOLO-only model set for consistent behavior (remove SSD fallback)
      // This repo/demo will rely on a single YOLO model for both wasm and server modes.
      const candidateModels = ["/models/yolov5n.onnx"]

      let selectedModel: string | null = null
      for (const m of candidateModels) {
        try {
          const res = await fetch(m, { method: "HEAD", cache: "no-cache" })
          if (res.ok) { selectedModel = m; break }
        } catch { /* ignore */ }
      }

      if (!selectedModel) {
        // No model available -> demo mode
        this.wasmInference = { ort, session: null, demoMode: true }
        this.wasmReady = false
        this.modelLoaded = false
        return
      }

      // Create session (try wasm then cpu)
      let session: any = null
      try {
        session = await (ort as any).InferenceSession.create(selectedModel as string, { executionProviders: ["wasm"], graphOptimizationLevel: "all" })
      } catch (e) {
        session = await (ort as any).InferenceSession.create(selectedModel as string, { executionProviders: ["cpu"] })
      }

      // Heuristic input size and detection thresholds per model
      // Inspect session input metadata (if available) to respect model's expected input shape.
      try {
        const sessInputs = (session as any).inputs || null
        if (sessInputs && sessInputs.length > 0) {
          const inMeta = sessInputs[0]
          const dims = inMeta?.dims || inMeta?.shape || null
          if (Array.isArray(dims) && dims.length >= 3) {
            // Common formats: [1,3,H,W] or [1,H,W,3]
            let inferredSize: number | null = null
            if (dims[1] === 3 && dims.length >= 4) {
              inferredSize = Number(dims[2]) || Number(dims[3]) || null
            } else if (dims[dims.length - 1] === 3) {
              inferredSize = Number(dims[1]) || Number(dims[2]) || null
            } else {
              // fallback: pick the largest numeric dim > 3
              const numericDims = dims.filter((d: any) => Number.isFinite(Number(d)) && Number(d) > 3).map((d: any) => Number(d))
              if (numericDims.length) inferredSize = Math.max(...numericDims)
            }

            if (inferredSize && Number.isFinite(inferredSize)) {
              this.wasmInputSize = inferredSize
              console.log('[v0] Detected model input size from session metadata:', inferredSize)
            }
          }
        }
      } catch (e) {
        // ignore; fall back to defaults
      }

      // Default low-resource YOLO-friendly settings if not inferred
      if (!this.wasmInputSize) this.wasmInputSize = 640
      this.detectionThreshold = 0.45

      // Capture input/output names if possible
      let inputNames: string[] | null = null
      let outputNames: string[] | null = null
      try {
        inputNames = (session as any).inputNames || (session as any).inputs?.map((i: any) => i.name) || null
        outputNames = (session as any).outputNames || (session as any).outputs?.map((o: any) => o.name) || null
      } catch { /* best-effort */ }

      this.wasmInference = { ort, session, demoMode: false, inputNames, outputNames }
      // remember which model we loaded so mapping heuristics can use it
      this.selectedModel = selectedModel
      // For YOLO we default to standard COCO mapping (1-index or 0-index auto-detected)
      this.mappingPreference = 'auto'
      this.wasmReady = true
      this.modelLoaded = true
      console.log("WASM inference initialized and ready", { selectedModel, inputNames, outputNames })

      // If any video streams arrived while WASM was loading, process them now
      if (this.videoStreamQueue.length > 0) {
        console.log('[v0] Processing', this.videoStreamQueue.length, 'queued video streams now that WASM is ready')
        while (this.videoStreamQueue.length > 0) {
          const s = this.videoStreamQueue.shift()!
          if (this.onVideoReceived) this.onVideoReceived(s)
        }
      }

      // If there are queued frames, process them
      if (this.frameQueue.length > 0) {
        this.processQueuedFrames()
      }
    } catch (error) {
      console.error("WASM init failure:", error)
      this.wasmInference = { ort: null, session: null, demoMode: true }
      this.wasmReady = false
      this.modelLoaded = false
    } finally {
      this.wasmInitializing = false
    }
  }

  private async startReceiving() {
    // Create peer connection if needed
    if (!this.peerConnection) {
      this.peerConnection = new RTCPeerConnection()
    }

    // Attach handlers
    this.peerConnection.ontrack = (event) => {
      console.log("Received video track")
      const incoming = event.streams[0]
      // If WASM not ready yet, queue the stream for processing after init
      if (!this.wasmReady) {
        console.log('[v0] WASM not ready - queueing incoming video stream')
        this.videoStreamQueue.push(incoming)
      } else {
        if (this.onVideoReceived) this.onVideoReceived(incoming)
      }

      // Always start local WASM processing as a fallback to ensure detections happen,
      // even if the UI is set to server mode (server pipeline may not be wired up).
      if (!this.wasmProcessingActive) {
        const stream = event.streams[0]
        const begin = () => {
          if (this.wasmProcessingActive) return
          this.wasmProcessingActive = true
          this.startWASMProcessing(stream)
        }

        // Ensure WASM is initialized; if not, kick it off and poll until ready
        if (!this.wasmInference && !this.wasmInitializing) {
          try { this.initializeWASMInference() } catch (e) { console.error('WASM init error:', e) }
        }

        let attempts = 0
        const maxAttempts = 40 // ~12s max with 300ms interval
        const waitAndStart = () => {
          if (this.wasmInference && !this.wasmInitializing) return begin()
          attempts += 1
          if (attempts >= maxAttempts) {
            console.warn('WASM inference not ready after waiting; starting anyway (may run in demo mode)')
            return begin()
          }
          setTimeout(waitAndStart, 300)
        }
        waitAndStart()
      }
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit("ice_candidate", event.candidate)
      }
    }

    if (this.mode === "server" && this.socket && this.isConnected) {
      this.socket.emit("start_receiving", { mode: this.mode })
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    // Ensure we have a peerConnection ready to accept the offer
    if (!this.peerConnection) {

      await this.startReceiving()
    }

    if (!this.peerConnection) {
      console.error('[v0] Failed to create peerConnection to handle offer')
      return
    }


    await this.peerConnection.setRemoteDescription(offer)

    // Drain any ICE candidates that arrived before the remote description was set
    if (this.pendingRemoteCandidates.length > 0) {

      for (const c of this.pendingRemoteCandidates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.peerConnection.addIceCandidate(c)
        } catch (err) {
          console.warn('[v0] Error adding queued remote ICE candidate:', err)
        }
      }
      this.pendingRemoteCandidates = []
    }

    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)

    if (this.socket) {
      this.socket.emit("answer", answer)
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {

      try {
        await this.peerConnection.addIceCandidate(candidate)
      } catch (err) {
        console.warn('[v0] Error adding ICE candidate:', err)
      }
    } else {
      // Peer connection not ready yet; queue candidates

      this.pendingRemoteCandidates.push(candidate)
    }
  }

  private startWASMProcessing(stream: MediaStream) {
    if (!this.wasmInference) {
      console.log("[DEBUG] WASM inference not available, skipping processing")
      return
    }

    console.log("[DEBUG] Starting WASM processing with inference state:", {
      hasInference: !!this.wasmInference,
      hasSession: !!this.wasmInference?.session,
      demoMode: this.wasmInference?.demoMode,
      inputSize: this.wasmInputSize
    })

    const videoTrack = stream.getVideoTracks()[0]
    const video = document.createElement("video")
    video.srcObject = stream
    // Configure video element to maximize chance autoplay is allowed
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    // Keep the processing video hidden but attached to DOM so some browsers allow autoplay
    video.style.position = "fixed"
    video.style.left = "-9999px"
    video.style.width = "1px"
    video.style.height = "1px"

    document.body.appendChild(video)

    video.onloadedmetadata = () => {
      console.log("[DEBUG] Video loaded - dimensions:", {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      })
    }

    video.onerror = (err) => {
      console.error("[DEBUG] Video error:", err)
    }

    video.onplaying = () => {
      console.log("[DEBUG] Video is playing, readyState:", video.readyState)
    }

    // Play may still be blocked in some cases; catch and continue. onloadeddata will still fire.
    video.play().then(() => {
      console.log("[DEBUG] Video play() succeeded")
    }).catch((err) => {
      console.warn('[DEBUG] video.play() blocked or failed:', err)
    })

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!

    // Use the chosen WASM input size set during model selection (300 for SSD, 640 for YOLO)
    const inputSize = this.wasmInputSize || 300
    canvas.width = inputSize
    canvas.height = inputSize

    let frameCount = 0
    const processFrame = async () => {
      console.log("[DEBUG] Process frame called - video readyState:", video.readyState, "dimensions:", video.videoWidth, "x", video.videoHeight)

      if (video.readyState >= 2) {
        frameCount++
        console.log("[DEBUG] Processing frame", frameCount, "video ready")

        // Center-crop the incoming video frame to a square, then scale to inputSize
        const vw = video.videoWidth || inputSize
        const vh = video.videoHeight || inputSize
        const side = Math.min(vw, vh)
        const sx = Math.max(0, Math.floor((vw - side) / 2))
        const sy = Math.max(0, Math.floor((vh - side) / 2))
        ctx.drawImage(video, sx, sy, side, side, 0, 0, inputSize, inputSize)
        const imageData = ctx.getImageData(0, 0, inputSize, inputSize)

        console.log("[DEBUG] Image data captured, size:", imageData.data.length, "attempting inference...")

        try {
          // If WASM isn't ready yet, enqueue the frame for later processing
          if (!this.wasmReady || !this.wasmInference || !this.wasmInference.session) {
            if (this.frameQueue.length < 10) this.frameQueue.push(imageData)
            console.log('[DEBUG] WASM not ready, queued frame - queue length', this.frameQueue.length)
            // attempt to initialize if not already
            if (!this.wasmInitializing) this.initializeWASMInference().catch((e) => console.error('WASM init error:', e))
            // Skip processing this frame now
            setTimeout(processFrame, 500)
            return
          }

          const detections = await this.runWASMInference(imageData)
          console.log("[DEBUG] Inference completed with", detections.length, "detections")

          if (this.onDetectionResult) {
            // Dispatch asynchronously to avoid React "setState during render" warnings
            setTimeout(() => {
              try {
                const now = Date.now()
                const frame = {
                  frame_id: frameCount.toString(),
                  capture_ts: now, // local capture surrogate
                  recv_ts: now,
                  inference_ts: now,
                  detections,
                }
                console.log("[DEBUG] Emitting detection result with", detections.length, "detections")
                // Record in detection history for auto-fallback heuristics
                try {
                  this.detectionHistory.push(detections.length)
                  if (this.detectionHistory.length > this.detectionHistoryMax) this.detectionHistory.shift()
                  // Evaluate whether we should auto-fallback to another model
                  this.evaluateAutoFallback()
                } catch (e) { /* ignore */ }

                this.onDetectionResult!(frame)
              } catch (cbErr) {
                console.error('[DEBUG] onDetectionResult callback error', cbErr)
              }
            }, 0)
          } else {
            console.warn("[DEBUG] No onDetectionResult callback set!")
          }
        } catch (error) {
          console.error("[DEBUG] Frame processing error:", error)
        }
      } else {
        console.log("[DEBUG] Video not ready, readyState:", video.readyState)
      }

      setTimeout(processFrame, 500) // ~2 FPS - reduced to prevent spamming
    }

    video.onloadeddata = () => {
      console.log("[DEBUG] Video loaded, starting frame processing")
      processFrame()
    }
  }

  private async processQueuedFrames() {
    if (!this.frameQueue || this.frameQueue.length === 0) return
    if (this.isProcessingFrame) return
    this.isProcessingFrame = true
    try {
      while (this.frameQueue.length > 0) {
        const imageData = this.frameQueue.shift()!
        try {
          const detections = await this.runWASMInference(imageData)
          if (this.onDetectionResult) {
            const now = Date.now()
            const frame = { frame_id: now.toString(), capture_ts: now, recv_ts: now, inference_ts: now, detections }
            // Dispatch asynchronously
            setTimeout(() => {
              try {
                // record history
                this.detectionHistory.push(detections.length)
                if (this.detectionHistory.length > this.detectionHistoryMax) this.detectionHistory.shift()
                this.evaluateAutoFallback()
              } catch (e) { /* ignore */ }
              this.onDetectionResult!(frame)
            }, 0)
          }
        } catch (e) {
          console.warn('Error processing queued frame', e)
        }
      }
    } finally {
      this.isProcessingFrame = false
    }
  }

  private async runWASMInference(imageData: ImageData): Promise<Detection[]> {
    console.log("[DEBUG] runWASMInference called - wasmInference state:", {
      hasInference: !!this.wasmInference,
      demoMode: this.wasmInference?.demoMode,
      hasSession: !!this.wasmInference?.session,
      hasOrt: !!this.wasmInference?.ort
    })

    if (!this.wasmInference) {
      console.log("[DEBUG] No WASM inference available, returning empty")
      return []
    }

    try {
      if (this.wasmInference.demoMode) {
        console.log("[DEBUG] Running in demo mode - generating fake detections")
        return this.generateDemoDetections()
      }

      const { ort, session } = this.wasmInference
      if (!session) {
        console.log("[DEBUG] No ONNX session available, returning empty")
        return []
      }

      console.log("[DEBUG] Running actual ONNX inference")

      // Create multiple tensor variants: prefer uint8 HWC for SSD MobileNet, also provide CHW and float32
      const tensorVariants = this.preprocessImage(imageData, ort)

      // Determine the correct feed name for this model's input; try multiple candidates if needed
      const knownInputNames: string[] = []
      try {
        const metaNames = (this.wasmInference as any).inputNames as string[] | null
        if (metaNames && metaNames.length) knownInputNames.push(...metaNames)
      } catch { }

      // Favor the model-specific 'images' input name first; keep fallback minimal
      const fallbackNames = ["images"]

      const tried = new Set<string>()
      let results: any = null
      let lastErr: any = null

      // If the session previously recorded a preferred input name, put it first
      const preferredName = (this.wasmInference as any)?.preferredInputName as string | undefined
      const tryNames = preferredName ? [preferredName, ...knownInputNames.filter(n => n !== preferredName), ...fallbackNames.filter(n => n !== preferredName)] : [...fallbackNames, ...knownInputNames]

      console.log(`[DEBUG] Trying input names for model inference:`, tryNames)

      // Try each input name and for each try the tensor variants in order
      for (const name of tryNames) {
        if (!name || tried.has(name)) continue
        tried.add(name)

        let candidates = tensorVariants.candidates || []
        // If session recorded a preferred input type, prioritize that candidate
        try {
          const prefType = (this.wasmInference as any)?.preferredInputType as string | undefined
          if (prefType && candidates.length > 1) {
            const idx = candidates.findIndex((c: any) => typeof c.type === 'string' && c.type.includes(prefType))
            if (idx > 0) {
              const [p] = candidates.splice(idx, 1)
              candidates.unshift(p)
            }
          }
        } catch { }
        for (const candidate of candidates) {
          try {
            const feed: Record<string, any> = {}
            feed[name] = candidate.tensor
            console.log(`[v0] Attempting inference with input name: "${name}", tensor type=${candidate.type}, shape=[${candidate.shape.join(',')}]`)
            // eslint-disable-next-line no-await-in-loop
            const runRes = await session.run(feed)
            if (runRes && Object.keys(runRes).length > 0) {
              results = runRes
              console.log('[v0] SUCCESS! Using model input name:', name)
              console.log('[v0] Inference result keys:', Object.keys(results))
              // Record which tensor type/name worked so future frames prefer it (and persist)
              try {
                if (candidate.type) (this.wasmInference as any).preferredInputType = candidate.type;
                if (candidate.shape) (this.wasmInference as any).preferredInputShape = candidate.shape;
                (this.wasmInference as any).preferredInputName = name;
              } catch { /* no-op */ }
              break
            }
          } catch (err) {
            const errorMsg = (err as Error).message || String(err)
            console.log(`[v0] Input name "${name}" with tensor ${candidate.type} failed:`, errorMsg)
            // If the error explicitly states a required type, remember it for next tries
            if (errorMsg.includes('expected: (tensor(uint8)') || errorMsg.includes('expected: (tensor(uint8))')) {
              try { (this.wasmInference as any).preferredInputType = 'uint8' } catch { }
            }
            lastErr = err
            // continue trying other tensor candidates and input names
          }
        }

        if (results) break
      }

      if (!results) {
        if (lastErr) console.warn('[v0] session.run failed with all input name candidates', lastErr)
        return []
      }

      // One-shot: log detailed result metadata (shapes/lengths/sample) to help choose postprocessing
      if (!this.sessionResultLogged) {
        try {
          const keys = results ? Object.keys(results) : []
          console.log('[v0] WASM inference results keys:', JSON.stringify(keys))
          for (const k of keys) {
            const o = (results as any)[k]
            const len = o?.data?.length ?? (o?.dims ? o.dims.reduce((a: number, b: number) => a * b, 1) : undefined)
            const dims = o?.dims || o?.shape || null
            let sample: any = null
            if (o && o.data && typeof o.data.slice === 'function') {
              try {
                sample = Array.from(o.data.slice(0, 10))
              } catch (sErr) {
                sample = String(o.data[0])
              }
            }
            console.log(`[v0] WASM inference output key=${k} len=${len} dims=${JSON.stringify(dims)} sample=${JSON.stringify(sample)}`)
          }
        } catch (logErr) {
          console.warn('[v0] Failed to log detailed inference results', logErr)
        }
        this.sessionResultLogged = true
      }

      // First: handle TF-SSD style models with named outputs: detection_boxes/classes/scores
      try {
        const r: any = results as any
        const hasSSD = r && (r.detection_boxes || r['detection_boxes']) && (r.detection_scores || r['detection_scores'])
        if (hasSSD) {
          const boxesT = r.detection_boxes || r['detection_boxes']
          const scoresT = r.detection_scores || r['detection_scores']
          const classesT = r.detection_classes || r['detection_classes'] || r.labels || r['labels']

          const boxes = boxesT?.data as Float32Array | undefined
          const scores = scoresT?.data as Float32Array | undefined
          const classes = (classesT?.data as Float32Array | Float64Array | Int32Array | Uint8Array | undefined)

          if (boxes && scores) {
            const n = Math.min(
              boxes.length / 4,
              scores.length,
              classes ? classes.length : Number.MAX_SAFE_INTEGER
            )
            const dets: Detection[] = []
            for (let i = 0; i < n; i++) {
              const score = scores[i]
              if (!Number.isFinite(score) || score < this.detectionThreshold) continue
              const off = i * 4
              // TF-SSD boxes are [ymin, xmin, ymax, xmax] normalized
              const ymin = boxes[off]
              const xmin = boxes[off + 1]
              const ymax = boxes[off + 2]
              const xmax = boxes[off + 3]
              const clsId = classes ? Math.round((classes as any)[i]) : 0
              dets.push({
                label: this.getClassName(clsId),
                score,
                xmin: Math.max(0, xmin),
                ymin: Math.max(0, ymin),
                xmax: Math.min(1, xmax),
                ymax: Math.min(1, ymax),
              })
            }

            if (dets.length) {
              return this.classNMS(dets, 0.3, 20)  // More aggressive NMS, fewer results
            }
          }
        }
      } catch (ssdErr) {
        console.warn('[v0] SSD named-outputs parse failed', ssdErr)
      }

      // Support variable output key names (models may export 'output', 'output0', etc.)
      const keys = results ? Object.keys(results) : []
      if (keys.length === 0) {
        console.warn('[v0] WASM inference returned no outputs', results)
        return []
      }

      const firstKey = keys[0]
      const out = (results as any)[firstKey]
      if (!out || !out.data) {
        console.warn('[v0] WASM inference output missing data for key', firstKey, results)
        return []
      }

      // guard against raw head outputs with massive flattened size (e.g. grid heads)
      const outLen = out.data?.length || 0
      // If the output is extremely large, allow it only if it matches a known pattern (e.g. YOLO: 85 channels per detection)
      if (outLen > 100000) {
        // Typical YOLO exports produce rows of 85 values (4 bbox + 1 obj + 80 class logits)
        if (outLen % 85 !== 0 && outLen % 6 !== 0) {
          console.warn('[v0] WASM inference produced very large unknown-format output (length=' + outLen + '), skipping this frame.')
          return []
        }
      }

      // Pass both data and dims (if available) so postprocessing can select the correct decoder
      return this.postprocessResults(out.data, out.dims || out.shape)
    } catch (error) {
      console.error("WASM inference error:", error)
      return []
    }
  }

  private preprocessImage(imageData: ImageData, ort: any) {
    const { data, width, height } = imageData
    // Use the manager's wasmInputSize so we match the model's expected input shape
    const inputSize = this.wasmInputSize || width

    console.log(`[v0] Preprocessing image: ${inputSize}x${inputSize}`)

    // Try float32 normalized RGB [0,1] (CHW) - preferred for YOLO
    const rgbData = new Float32Array(3 * inputSize * inputSize)

    for (let i = 0; i < inputSize * inputSize; i++) {
      const pixelIndex = i * 4
      rgbData[i] = data[pixelIndex] / 255.0 // R
      rgbData[inputSize * inputSize + i] = data[pixelIndex + 1] / 255.0 // G
      rgbData[2 * inputSize * inputSize + i] = data[pixelIndex + 2] / 255.0 // B
    }

    // We'll prepare multiple tensor formats and return them as candidates.
    // Candidate 1 (preferred for YOLO): float32 CHW normalized [1,3,H,W]
    const floatBuf = new Float32Array(3 * inputSize * inputSize)
    for (let i = 0; i < inputSize * inputSize; i++) {
      const pixelIndex = i * 4
      floatBuf[i] = data[pixelIndex] / 255.0
      floatBuf[inputSize * inputSize + i] = data[pixelIndex + 1] / 255.0
      floatBuf[2 * inputSize * inputSize + i] = data[pixelIndex + 2] / 255.0
    }

    // Candidate 2: uint8 CHW [1, 3, H, W]
    const chw = new Uint8Array(3 * inputSize * inputSize)
    const planeSize = inputSize * inputSize
    for (let i = 0; i < inputSize * inputSize; i++) {
      const pixelIndex = i * 4
      chw[i] = data[pixelIndex] // R plane
      chw[planeSize + i] = data[pixelIndex + 1] // G
      chw[planeSize * 2 + i] = data[pixelIndex + 2] // B
    }

    // Candidate 3: uint8 HWC [1, H, W, 3]
    const hwc = new Uint8Array(inputSize * inputSize * 3)
    let hi = 0
    for (let i = 0; i < inputSize * inputSize; i++) {
      const pixelIndex = i * 4
      hwc[hi++] = data[pixelIndex]     // R
      hwc[hi++] = data[pixelIndex + 1] // G
      hwc[hi++] = data[pixelIndex + 2] // B
    }

    // Build ort Tensors (defer if ort not available)
    const candidates: Array<{ tensor: any, type: string, shape: number[] }> = []
    try {
      const tFloat = new ort.Tensor('float32', floatBuf, [1, 3, inputSize, inputSize])
      candidates.push({ tensor: tFloat, type: 'float32-chw', shape: [1, 3, inputSize, inputSize] })
    } catch (e) { /* ignore */ }

    try {
      const tCHW = new ort.Tensor('uint8', chw, [1, 3, inputSize, inputSize])
      candidates.push({ tensor: tCHW, type: 'uint8-chw', shape: [1, 3, inputSize, inputSize] })
    } catch (e) { /* ignore */ }

    try {
      const tHWC = new ort.Tensor('uint8', hwc, [1, inputSize, inputSize, 3])
      candidates.push({ tensor: tHWC, type: 'uint8-hwc', shape: [1, inputSize, inputSize, 3] })
    } catch (e) { /* ignore */ }

    console.log(`[v0] Prepared tensor candidates: ${candidates.map(c => c.type).join(', ')}`)

    return { candidates }
  }

  private postprocessResults(output: Float32Array, dims?: number[] | null, confidenceThreshold = 0.1): Detection[] {
    // Debug-friendly YOLOv5 postprocessor
    if (!output || output.length < 85) return []

    // Ensure output aligns to 85-channel stride
    if (output.length % 85 !== 0) {
      console.warn('[v0] Unexpected YOLO output stride, length % 85 != 0:', output.length)
      return []
    }

    const detections: Detection[] = []
    const sigmoid = (v: number) => 1 / (1 + Math.exp(-v))
    const num = output.length / 85

    // Heuristics and debug stats
    let coordNormalize = false
    let totalProcessed = 0
    let passedObjectness = 0
    let passedConfidence = 0
    let maxObjectness = -Infinity
    let maxFinalConfidence = -Infinity

    // Sample a few raw entries for quick inspection
    for (let i = 0; i < Math.min(5, num); i++) {
      const off = i * 85
      const cx = output[off]
      const cy = output[off + 1]
      const w = output[off + 2]
      const h = output[off + 3]
      const objRaw = output[off + 4]
      console.log(`[v0] Sample[${i}] raw bbox cx=${cx.toFixed(4)} cy=${cy.toFixed(4)} w=${w.toFixed(4)} h=${h.toFixed(4)} obj=${objRaw.toFixed(6)}`)
    }

    // Determine whether coords look like pixel values (>1)
    for (let i = 0; i < Math.min(50, num); i++) {
      const off = i * 85
      if (output[off] > 1.0 || output[off + 1] > 1.0 || output[off + 2] > 1.0 || output[off + 3] > 1.0) {
        coordNormalize = true
        break
      }
    }

    for (let i = 0; i < num; i++) {
      const off = i * 85
      totalProcessed++

      const cx = output[off]
      const cy = output[off + 1]
      const w = output[off + 2]
      const h = output[off + 3]
      const objRaw = output[off + 4]

      if (!Number.isFinite(cx + cy + w + h + objRaw)) continue

      const objProb = sigmoid(objRaw)
      maxObjectness = Math.max(maxObjectness, objProb)

      // very permissive objectness filter for debugging
      if (objProb < 0.01) continue
      passedObjectness++

      // find best class (apply sigmoid to logits)
      let bestClass = 0
      let bestClassProb = -Infinity
      for (let c = 0; c < 80; c++) {
        const clsRaw = output[off + 5 + c]
        if (!Number.isFinite(clsRaw)) continue
        const clsProb = sigmoid(clsRaw)
        if (clsProb > bestClassProb) {
          bestClassProb = clsProb
          bestClass = c
        }
      }

      const finalConf = objProb * (bestClassProb === -Infinity ? 0 : bestClassProb)
      maxFinalConfidence = Math.max(maxFinalConfidence, finalConf)

      // skip low-confidence detections
      if (!Number.isFinite(finalConf) || finalConf < confidenceThreshold) continue
      passedConfidence++

      // Normalize coords if needed (model emitted pixel-space coords)
      let nx = cx
      let ny = cy
      let nw = w
      let nh = h
      if (coordNormalize) {
        const S = this.wasmInputSize || 640
        nx = nx / S
        ny = ny / S
        nw = nw / S
        nh = nh / S
      }

      const xmin = Math.max(0, nx - nw / 2)
      const ymin = Math.max(0, ny - nh / 2)
      const xmax = Math.min(1, nx + nw / 2)
      const ymax = Math.min(1, ny + nh / 2)

      const label = this.getClassName(bestClass)
      detections.push({ label, score: finalConf, xmin, ymin, xmax, ymax })
    }

    console.log('[v0] Detection statistics:')
    console.log('[v0]   Total anchors processed:', totalProcessed)
    console.log('[v0]   Passed objectness (>0.01):', passedObjectness)
    console.log('[v0]   Passed final confidence (>', confidenceThreshold, '):', passedConfidence)
    console.log('[v0]   Max objectness found:', maxObjectness)
    console.log('[v0]   Max final confidence:', maxFinalConfidence)
    console.log('[v0]   Detections before NMS:', detections.length)

    // Emergency fallback: if nothing passed, try a much lower threshold once
    if (detections.length === 0 && confidenceThreshold > 0.001) {
      console.log('[v0] NO DETECTIONS FOUND - lowering threshold to 0.001 and retrying')
      return this.postprocessResults(output, dims, 0.001)
    }

    const final = this.classNMS(detections, 0.45, 50)
    console.log('[v0] Detections after NMS:', final.length)
    if (final.length > 0) {
      for (let i = 0; i < Math.min(5, final.length); i++) {
        const d = final[i]
        console.log(`[v0] Detection ${i}: ${d.label} conf=${d.score.toFixed(4)} bbox=[${(d.xmin * 100).toFixed(1)}%, ${(d.ymin * 100).toFixed(1)}%, ${(d.xmax * 100).toFixed(1)}%, ${(d.ymax * 100).toFixed(1)}%]`)
      }
    }

    return final
  }

  // Simple IoU and NMS implementation (works on normalized coords)
  private nonMaxSuppression(boxes: Detection[], iouThreshold = 0.45) {
    if (!boxes.length) return boxes
    // Sort by score desc
    const sorted = boxes.slice().sort((a, b) => b.score - a.score)
    const selected: Detection[] = []

    const iou = (a: Detection, b: Detection) => {
      const x1 = Math.max(a.xmin, b.xmin)
      const y1 = Math.max(a.ymin, b.ymin)
      const x2 = Math.min(a.xmax, b.xmax)
      const y2 = Math.min(a.ymax, b.ymax)

      const w = Math.max(0, x2 - x1)
      const h = Math.max(0, y2 - y1)
      const inter = w * h
      const areaA = Math.max(0, a.xmax - a.xmin) * Math.max(0, a.ymax - a.ymin)
      const areaB = Math.max(0, b.xmax - b.xmin) * Math.max(0, b.ymax - b.ymin)
      const union = areaA + areaB - inter
      return union <= 0 ? 0 : inter / union
    }

    for (const box of sorted) {
      let keep = true
      for (const sel of selected) {
        const ioU = iou(box, sel)
        if (ioU > iouThreshold) {
          keep = false
          break
        }
      }
      if (keep) selected.push(box)
    }

    return selected
  }

  // Apply NMS per class label and limit total results to topK
  private classNMS(boxes: Detection[], iouThreshold = 0.45, topK = 50) {
    if (!boxes.length) return boxes
    const byClass: Record<string, Detection[]> = {}
    for (const b of boxes) {
      byClass[b.label] = byClass[b.label] || []
      byClass[b.label].push(b)
    }

    const results: Detection[] = []
    for (const k of Object.keys(byClass)) {
      const kept = this.nonMaxSuppression(byClass[k], iouThreshold)
      results.push(...kept)
    }

    // Return top-K by score
    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  private getClassName(classId: number): string {
    const classes = [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
      'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
      'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
      'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
      'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
      'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed',
      'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
      'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ]

    const id = Math.round(Number(classId))
    if (!Number.isFinite(id)) return 'unknown'
    if (id >= 0 && id < classes.length) return classes[id]

    // If id is out of range, log once and return unknown
    if (!this.classMappingDebugged.has(id)) {
      this.classMappingDebugged.add(id)
      console.warn('[v0] Unknown classId mapping:', id)
    }
    return `unknown_${id}`
  }

  // Check detection history and if SSD is performing poorly, auto-fallback to YOLO
  private evaluateAutoFallback() {
    // Auto-fallback disabled: we are running YOLO-only for this demo to ensure consistency.
    return
  }

  private generateDemoDetections(): Detection[] {
    console.log("[DEBUG] Generating demo detections")
    const demoDetections: Detection[] = []
    const numDetections = Math.floor(Math.random() * 3) + 1 // 1-3 detections

    for (let i = 0; i < numDetections; i++) {
      demoDetections.push({
        label: ["person", "car", "bicycle", "dog", "cat"][Math.floor(Math.random() * 5)],
        score: 0.7 + Math.random() * 0.3, // 0.7-1.0 confidence
        xmin: Math.random() * 0.5, // Random position
        ymin: Math.random() * 0.5,
        xmax: Math.random() * 0.5 + 0.5,
        ymax: Math.random() * 0.5 + 0.5,
      })
    }

    console.log("[DEBUG] Generated", demoDetections.length, "demo detections:", demoDetections)
    return demoDetections
  }

  stopReceiving() {
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }
  }

  // Public helper: override mapping preference at runtime for debugging
  public setMappingPreference(pref: 'auto' | 'coco1' | 'coco0' | 'ssd-bg') {
    this.mappingPreference = pref
    console.log('[v0] mappingPreference set to', pref)
  }

  // Public helper: force reinitialize WASM with current mode (useful after changing pref)
  public reloadWASM() {
    try {
      this.wasmReady = false
      this.modelLoaded = false
      this.wasmInference = null
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.initializeWASMInference().catch(e => console.error('reloadWASM error', e))
    } catch (e) { console.error('reloadWASM error', e) }
  }

  cleanup() {
    this.stopReceiving()
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    try {
      if (typeof window !== 'undefined' && (window as any).__webrtcManager === this) delete (window as any).__webrtcManager
    } catch (e) { /* ignore */ }
  }
}
