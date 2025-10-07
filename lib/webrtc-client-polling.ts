// WebRTC client using HTTP polling for signaling (Vercel-compatible)
// No Socket.IO dependency - works on any static hosting platform

export class WebRTCClientPolling {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private roomId: string;
    private clientId: string;
    private pollingInterval: NodeJS.Timeout | null = null;
    private lastPollTimestamp: number = 0;
    private pendingIceCandidates: RTCIceCandidateInit[] = []; // Queue for ICE candidates received before answer

    public onConnectionStateChange: ((state: "disconnected" | "connecting" | "connected") => void) | null = null;

    constructor(roomId: string = 'default-room') {
        this.roomId = roomId;
        this.clientId = 'phone-' + Math.random().toString(36).substr(2, 9);
        console.log(`[Phone] WebRTC client initialized with room: ${roomId}, clientId: ${this.clientId}`);
    }

    private async sendSignalingMessage(type: 'offer' | 'answer' | 'ice-candidate', data: any) {
        try {
            const response = await fetch('/api/signaling', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: this.roomId,
                    type,
                    from: this.clientId,
                    to: 'viewer',
                    data,
                }),
            });

            if (!response.ok) {
                console.error('[Phone] Failed to send signaling message:', response.statusText);
            }
        } catch (error) {
            console.error('[Phone] Error sending signaling message:', error);
        }
    }

    private startPolling() {
        if (this.pollingInterval) return;

        this.lastPollTimestamp = Date.now();

        this.pollingInterval = setInterval(async () => {
            try {
                const response = await fetch(
                    `/api/signaling?roomId=${this.roomId}&since=${this.lastPollTimestamp}`
                );

                if (!response.ok) return;

                const { messages } = await response.json();

                if (messages.length > 0) {
                    console.log(`[Phone] Received ${messages.length} messages:`, messages.map((m: any) => ({ type: m.type, from: m.from, to: m.to })));
                }

                for (const message of messages) {
                    // Only process messages meant for us or broadcasts
                    if (message.to && message.to !== this.clientId && message.to !== 'phone') {
                        console.log(`[Phone] Skipping message (to: ${message.to}, my clientId: ${this.clientId})`);
                        continue;
                    }

                    console.log(`[Phone] Processing ${message.type} from ${message.from}`);

                    if (message.type === 'answer') {
                        await this.handleAnswer(message.data);
                    } else if (message.type === 'ice-candidate') {
                        await this.handleIceCandidate(message.data);
                    }
                }

                // Update timestamp for next poll
                if (messages.length > 0) {
                    this.lastPollTimestamp = Math.max(...messages.map((m: any) => m.timestamp));
                }
            } catch (error) {
                console.error('[Phone] Polling error:', error);
            }
        }, 1000); // Poll every second
    }

    private stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async startStreaming(stream: MediaStream) {
        console.log('[Phone] Starting streaming...');

        if (this.onConnectionStateChange) {
            this.onConnectionStateChange("connecting");
        }

        this.localStream = stream;
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ],
        });

        // Add video track
        stream.getVideoTracks().forEach((track) => {
            console.log('[Phone] Adding video track:', track.label);
            this.peerConnection!.addTrack(track, stream);
        });

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[Phone] Sending ICE candidate');
                this.sendSignalingMessage('ice-candidate', event.candidate);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection?.connectionState;
            console.log('[Phone] Connection state:', state);

            if (state === "connected" && this.onConnectionStateChange) {
                this.onConnectionStateChange("connected");
            } else if (state === "disconnected" || state === "failed") {
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange("disconnected");
                }
            }
        };

        // Create and send offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        console.log('[Phone] Sending offer');
        await this.sendSignalingMessage('offer', offer);

        // Start polling for answers and ICE candidates
        this.startPolling();
    }

    private async handleAnswer(answer: RTCSessionDescriptionInit) {
        if (!this.peerConnection) return;

        console.log('[Phone] Received answer, applying...');

        const maxRetries = 5;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const sigState = this.peerConnection.signalingState;

                if (sigState === "have-local-offer" || sigState === "have-local-pranswer") {
                    await this.peerConnection.setRemoteDescription(answer);
                    console.log('[Phone] Answer applied successfully');

                    // Drain any queued ICE candidates now that remote description is set
                    if (this.pendingIceCandidates.length > 0) {
                        console.log(`[Phone] Draining ${this.pendingIceCandidates.length} queued ICE candidates`);
                        for (const candidate of this.pendingIceCandidates) {
                            try {
                                await this.peerConnection.addIceCandidate(candidate);
                            } catch (err) {
                                console.warn('[Phone] Error adding queued ICE candidate:', err);
                            }
                        }
                        this.pendingIceCandidates = [];
                    }

                    return;
                }

                if (sigState === "stable") {
                    console.warn('[Phone] Already in stable state, skipping answer');
                    return;
                }

                await new Promise((res) => setTimeout(res, 200));
            } catch (err) {
                console.warn('[Phone] Error applying answer (attempt ' + attempt + '):', err);
            }
        }

        console.error('[Phone] Failed to apply answer after retries');
    }

    private async handleIceCandidate(candidate: RTCIceCandidateInit) {
        if (!this.peerConnection) {
            console.warn('[Phone] Received ICE candidate but no peer connection');
            return;
        }

        // If remote description isn't set yet, queue the candidate
        if (!this.peerConnection.remoteDescription) {
            console.log('[Phone] Queueing ICE candidate (remote description not set yet)');
            this.pendingIceCandidates.push(candidate);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(candidate);
            console.log('[Phone] ICE candidate added');
        } catch (err) {
            console.error('[Phone] Error adding ICE candidate:', err);
        }
    }

    stopStreaming() {
        console.log('[Phone] Stopping streaming');

        this.stopPolling();

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }

    cleanup() {
        this.stopStreaming();
    }
}
