const { Server } = require("socket.io")
const http = require("http")

const server = http.createServer()

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})

console.log("[Socket.IO] Starting server on port 3001...")

const connectedClients = new Map()

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`)
  connectedClients.set(socket.id, {
    id: socket.id,
    connectedAt: new Date(),
    userAgent: socket.handshake.headers["user-agent"] || "unknown",
  })

  console.log(`[Socket.IO] Total connected clients: ${connectedClients.size}`)

  socket.on("start_receiving", (data) => {
    console.log("[Socket.IO] Start receiving request:", data)
    socket.broadcast.emit("start_receiving", data)
  })

  socket.on("offer", (offer) => {
    console.log("[Socket.IO] Received offer")
    socket.broadcast.emit("offer", offer)
  })

  socket.on("answer", (answer) => {
    console.log("[Socket.IO] Received answer")
    socket.broadcast.emit("answer", answer)
  })

  socket.on("ice_candidate", (candidate) => {
    console.log("[Socket.IO] Received ICE candidate")
    socket.broadcast.emit("ice_candidate", candidate)
  })

  socket.on("detection_result", (result) => {
    console.log("[Socket.IO] Broadcasting detection result")
    socket.broadcast.emit("detection_result", result)
  })

  socket.on("error", (error) => {
    console.error(`[Socket.IO] Socket error for ${socket.id}:`, error)
  })

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`)
    connectedClients.delete(socket.id)
    console.log(`[Socket.IO] Total connected clients: ${connectedClients.size}`)
  })
})

server.on("error", (error) => {
  console.error("[Socket.IO] Server error:", error)
  if (error.code === "EADDRINUSE") {
    console.error("[Socket.IO] Port 3001 is already in use. Please stop other processes using this port.")
    process.exit(1)
  }
})

process.on("SIGINT", () => {
  console.log("\n[Socket.IO] Received SIGINT, shutting down gracefully...")
  server.close(() => {
    console.log("[Socket.IO] Server closed")
    process.exit(0)
  })
})

process.on("SIGTERM", () => {
  console.log("\n[Socket.IO] Received SIGTERM, shutting down gracefully...")
  server.close(() => {
    console.log("[Socket.IO] Server closed")
    process.exit(0)
  })
})

server.listen(3000, "0.0.0.0", () => {
  console.log("[Socket.IO] Server running on http://0.0.0.0:3000")
  console.log("[Socket.IO] Accepting connections from all interfaces")
})
