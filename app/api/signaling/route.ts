import { NextRequest, NextResponse } from 'next/server';
import { signalingStore } from '@/lib/signaling-store';

// POST: Send signaling message (offer, answer, ICE candidate)
// GET: Poll for new messages
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { roomId, type, from, to, data } = body;

        if (!roomId || !type || !from || !data) {
            return NextResponse.json(
                { error: 'Missing required fields: roomId, type, from, data' },
                { status: 400 }
            );
        }

        console.log(`[API] Storing ${type} from ${from} to ${to || 'broadcast'} in room ${roomId}`);

        await signalingStore.addMessage(roomId, {
            type,
            from,
            to,
            data,
            timestamp: Date.now(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Signaling POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const roomId = searchParams.get('roomId');
        const since = parseInt(searchParams.get('since') || '0');

        if (!roomId) {
            return NextResponse.json(
                { error: 'Missing roomId parameter' },
                { status: 400 }
            );
        }

        const messages = await signalingStore.getMessages(roomId, since);

        console.log(`[API] GET /api/signaling?roomId=${roomId}&since=${since} -> ${messages.length} messages`,
            messages.map(m => `${m.type} from ${m.from}`));

        return NextResponse.json({ messages });
    } catch (error) {
        console.error('Signaling GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
