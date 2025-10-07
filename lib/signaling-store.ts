// Simple in-memory signaling store for WebRTC (Vercel-compatible)
// Note: This is ephemeral and will reset on serverless function cold starts
// For production, consider using Redis or a database

interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate';
    from: string;
    to?: string;
    data: any;
    timestamp: number;
}

class SignalingStore {
    private messages: Map<string, SignalingMessage[]> = new Map();
    private readonly MAX_AGE = 60000; // 60 seconds

    addMessage(roomId: string, message: SignalingMessage) {
        if (!this.messages.has(roomId)) {
            this.messages.set(roomId, []);
        }
        this.messages.get(roomId)!.push(message);
        this.cleanup(roomId);
    }

    getMessages(roomId: string, since: number): SignalingMessage[] {
        const messages = this.messages.get(roomId) || [];
        return messages.filter(m => m.timestamp > since);
    }

    private cleanup(roomId: string) {
        const now = Date.now();
        const messages = this.messages.get(roomId) || [];
        const filtered = messages.filter(m => now - m.timestamp < this.MAX_AGE);

        if (filtered.length === 0) {
            this.messages.delete(roomId);
        } else {
            this.messages.set(roomId, filtered);
        }
    }

    getRooms(): string[] {
        return Array.from(this.messages.keys());
    }
}

// Singleton instance
export const signalingStore = new SignalingStore();
