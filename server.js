const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
// ...existing code...

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // --- Socket.IO logic with simple role-based routing ---
    // Clients should emit { type: 'identify', role: 'phone' | 'viewer' }
    const clients = new Map(); // socketId -> { role }

    function findSocketsByRole(role) {
        const out = []
        for (const [id, meta] of clients.entries()) {
            if (meta.role === role) out.push(id)
        }
        return out
    }

    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);
        clients.set(socket.id, { role: 'unknown' });
        console.log(`[Socket.IO] Total connected clients: ${clients.size}`);

        socket.on('identify', (data) => {
            try {
                const role = data && data.role ? data.role : 'unknown'
                clients.set(socket.id, { role })
                console.log(`[Socket.IO] ${socket.id} identified as ${role}`)
            } catch (err) {
                console.warn('[Socket.IO] identify handler error', err)
            }
        })

        socket.on('start_receiving', (data) => {
            console.log('[Socket.IO] Start receiving request:', data);
            // notify all phones that a viewer wants to receive
            const phones = findSocketsByRole('phone')
            phones.forEach((id) => io.to(id).emit('start_receiving', data))
        });

        socket.on('offer', (offer) => {
            console.log('[Socket.IO] Received offer');
            // forward offers only to viewers
            const viewers = findSocketsByRole('viewer')
            if (viewers.length === 0) {
                // fallback to broadcast to avoid silent failures
                socket.broadcast.emit('offer', offer)
            } else {
                viewers.forEach((id) => io.to(id).emit('offer', offer))
            }
        });

        socket.on('answer', (answer) => {
            console.log('[Socket.IO] Received answer');
            // forward answers to phones
            const phones = findSocketsByRole('phone')
            if (phones.length === 0) socket.broadcast.emit('answer', answer)
            else phones.forEach((id) => io.to(id).emit('answer', answer))
        });

        socket.on('ice_candidate', (candidate) => {
            console.log('[Socket.IO] Received ICE candidate');
            // relay candidate to all other role groups (phone <-> viewer)
            const meta = clients.get(socket.id) || { role: 'unknown' }
            const targetRole = meta.role === 'phone' ? 'viewer' : 'phone'
            const targets = findSocketsByRole(targetRole)
            if (targets.length === 0) {
                socket.broadcast.emit('ice_candidate', candidate)
            } else {
                targets.forEach((id) => io.to(id).emit('ice_candidate', candidate))
            }
        });

        socket.on('detection_result', (result) => {
            console.log('[Socket.IO] Broadcasting detection result');
            // send detection results to all viewers
            const viewers = findSocketsByRole('viewer')
            if (viewers.length === 0) socket.broadcast.emit('detection_result', result)
            else viewers.forEach((id) => io.to(id).emit('detection_result', result))
        });

        socket.on('error', (error) => {
            console.error(`[Socket.IO] Socket error for ${socket.id}:`, error);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
            clients.delete(socket.id);
            console.log(`[Socket.IO] Total connected clients: ${clients.size}`);
        });
    });

    // ...existing code...

    server.on('error', (error) => {
        console.error('[Socket.IO] Server error:', error);
        if (error.code === 'EADDRINUSE') {
            console.error('[Socket.IO] Port 3000 is already in use. Please stop other processes using this port.');
            process.exit(1);
        }
    });

    process.on('SIGINT', () => {
        console.log('\n[Socket.IO] Received SIGINT, shutting down gracefully...');
        server.close(() => {
            console.log('[Socket.IO] Server closed');
            process.exit(0);
        });
    });
    process.on('SIGTERM', () => {
        console.log('\n[Socket.IO] Received SIGTERM, shutting down gracefully...');
        server.close(() => {
            console.log('[Socket.IO] Server closed');
            process.exit(0);
        });
    });

    server.listen(3000, () => {
        console.log('> Ready on http://localhost:3000');
        console.log('[Socket.IO] Server running on http://0.0.0.0:3000');
        console.log('[Socket.IO] Accepting connections from all interfaces');
    });
});
