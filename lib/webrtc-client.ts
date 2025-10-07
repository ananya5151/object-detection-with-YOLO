import { io, type Socket } from "socket.io-client"

export class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null
  private socket: Socket | null = null
  private localStream: MediaStream | null = null

  public onConnectionStateChange: ((state: "disconnected" | "connecting" | "connected") => void) | null = null

  constructor() {
    this.setupSocketIO()
  }

  private setupSocketIO() {
    const socketUrl = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "http://localhost:3000";

    this.socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      timeout: 5000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    })

    this.socket.on("connect", () => {
      console.log("[Phone] Socket.IO connected successfully")
      // Tell server this client is a phone (publisher)
      try {
        this.socket?.emit('identify', { role: 'phone' })
      } catch (err) {
        console.warn('[Phone] identify emit failed', err)
      }
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange("connected")
      }
    })

    this.socket.on("disconnect", () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange("disconnected")
      }
    })

    this.socket.on("answer", (answer) => {
      this.handleAnswer(answer)
    })

    this.socket.on("ice_candidate", (candidate) => {
      this.handleIceCandidate(candidate)
    })
  }

  async startStreaming(stream: MediaStream) {
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange("connecting")
    }

    this.localStream = stream
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })

    // Add video track
    stream.getVideoTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream)
    })

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit("ice_candidate", event.candidate)
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      if (state === "connected" && this.onConnectionStateChange) {
        this.onConnectionStateChange("connected")
      } else if (state === "disconnected" || state === "failed") {
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange("disconnected")
        }
      }
    }

    // Create offer
    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)

    // Send offer via Socket.IO
    if (this.socket) {
      this.socket.emit("offer", offer)
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return

    // Only set remote description when the connection is in the expected state
    // If an answer arrives too early/late we may see 'stable' and setRemoteDescription will throw.
    // Retry a few times waiting for the 'have-local-offer' signaling state; then give up and log.
    const maxRetries = 5
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const sigState = this.peerConnection.signalingState
        if (sigState === "have-local-offer" || sigState === "have-local-pranswer") {
          await this.peerConnection.setRemoteDescription(answer)
          return
        }

        // If already stable, remote was likely applied or no-op; skip to avoid InvalidStateError
        if (sigState === "stable") {
          console.warn('[Phone] Received answer but signalingState is stable; skipping setRemoteDescription')
          return
        }

        // wait a short time for state to progress
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, 200))
      } catch (err) {
        console.warn('[Phone] Error while applying remote answer (attempt=' + attempt + ')', err)
        return
      }
    }

    console.warn('[Phone] Giving up applying remote answer after retries')
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(candidate)
    }
  }

  stopStreaming() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }
  }

  cleanup() {
    this.stopStreaming()
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}
