// Signaling store for WebRTC (Vercel-compatible)
// Default is in-memory. If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set,
// use a Redis-backed implementation to persist across serverless instances.

export interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate'
    from: string
    to?: string
    data: any
    timestamp: number
}

interface ISignalingStore {
    addMessage(roomId: string, message: SignalingMessage): Promise<void>
    getMessages(roomId: string, since: number): Promise<SignalingMessage[]>
}

class MemorySignalingStore implements ISignalingStore {
    private messages: Map<string, SignalingMessage[]> = new Map()
    private readonly MAX_AGE = 60_000 // 60s

    async addMessage(roomId: string, message: SignalingMessage): Promise<void> {
        if (!this.messages.has(roomId)) {
            this.messages.set(roomId, [])
        }

        if (message.type === 'offer') {
            const arr = this.messages.get(roomId)!
            const filtered = arr.filter(m => m.from !== message.from)
            this.messages.set(roomId, filtered)
        }

        this.messages.get(roomId)!.push(message)
        this.cleanup(roomId)
    }

    async getMessages(roomId: string, since: number): Promise<SignalingMessage[]> {
        const arr = this.messages.get(roomId) || []
        return arr.filter(m => m.timestamp > since)
    }

    private cleanup(roomId: string) {
        const now = Date.now()
        const arr = this.messages.get(roomId) || []
        const filtered = arr.filter(m => now - m.timestamp < this.MAX_AGE)
        if (filtered.length === 0) {
            this.messages.delete(roomId)
        } else {
            this.messages.set(roomId, filtered)
        }
    }
}

class RedisSignalingStore implements ISignalingStore {
    private readonly url: string
    private readonly token: string
    private readonly MAX_AGE = 60_000 // 60s

    constructor(url: string, token: string) {
        this.url = url
        this.token = token
    }

    private async call(command: (string | number)[]): Promise<any> {
        const res = await fetch(this.url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${this.token}`,
            },
            body: JSON.stringify({ command })
        })
        if (!res.ok) {
            throw new Error(`Redis error: ${res.status} ${res.statusText}`)
        }
        return res.json()
    }

    private key(roomId: string) { return `signaling:${roomId}` }

    private async cleanup(roomId: string) {
        const cutoff = Date.now() - this.MAX_AGE
        await this.call(['ZREMRANGEBYSCORE', this.key(roomId), '-inf', cutoff])
    }

    private async removeBySender(roomId: string, from: string) {
        // Read recent messages and remove those from same sender
        // Keep the window to MAX_AGE to bound data
        const cutoff = Date.now() - this.MAX_AGE
        const res = await this.call(['ZRANGEBYSCORE', this.key(roomId), cutoff, '+inf'])
        const members: string[] = res?.result || []
        if (!Array.isArray(members) || members.length === 0) {
            return
        }
        const toRemove: string[] = []
        for (const m of members) {
            try {
                const obj: SignalingMessage = JSON.parse(m)
                if (obj?.from === from) {
                    toRemove.push(m)
                }
            } catch { /* ignore parse errors */ }
        }
        for (const member of toRemove) {
            await this.call(['ZREM', this.key(roomId), member])
        }
    }

    async addMessage(roomId: string, message: SignalingMessage): Promise<void> {
        if (message.type === 'offer') {
            await this.removeBySender(roomId, message.from)
        }
        const member = JSON.stringify(message)
        await this.call(['ZADD', this.key(roomId), message.timestamp, member])
        await this.cleanup(roomId)
    }

    async getMessages(roomId: string, since: number): Promise<SignalingMessage[]> {
        // Use exclusive lower bound to avoid dropping messages that share the same millisecond timestamp
        const lowerBound = `(${since}`
        const res = await this.call(['ZRANGEBYSCORE', this.key(roomId), lowerBound, '+inf'])
        const members: string[] = res?.result || []
        const out: SignalingMessage[] = []
        for (const m of members) {
            try {
                const obj: SignalingMessage = JSON.parse(m)
                out.push(obj)
            } catch { /* ignore */ }
        }
        return out
    }
}

function createStore(): ISignalingStore {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (url && token) {
        // eslint-disable-next-line no-console
        console.log('[Signaling] Using Upstash Redis store')
        return new RedisSignalingStore(url, token)
    }
    // eslint-disable-next-line no-console
    console.log('[Signaling] Using in-memory store')
    return new MemorySignalingStore()
}

export const signalingStore: ISignalingStore = createStore()
