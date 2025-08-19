import type { NextRequest } from "next/server"
import { Server as SocketIOServer } from "socket.io"
import { Server as HTTPServer } from "http"

let io: SocketIOServer | null = null

export async function GET(request: NextRequest) {
  if (!io) {
    // Initialize Socket.IO server
    const httpServer = new HTTPServer()
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    })

    io.on("connection", (socket) => {
      console.log("[v0] Client connected:", socket.id)

      socket.on("start_receiving", (data) => {
        console.log("[v0] Start receiving request:", data)
        // Handle WebRTC signaling
      })

      socket.on("offer", (offer) => {
        console.log("[v0] Received offer")
        socket.broadcast.emit("offer", offer)
      })

      socket.on("answer", (answer) => {
        console.log("[v0] Received answer")
        socket.broadcast.emit("answer", answer)
      })

      socket.on("ice_candidate", (candidate) => {
        console.log("[v0] Received ICE candidate")
        socket.broadcast.emit("ice_candidate", candidate)
      })

      socket.on("disconnect", () => {
        console.log("[v0] Client disconnected:", socket.id)
      })
    })

    httpServer.listen(3001)
    console.log("[v0] Socket.IO server started on port 3001")
  }

  return new Response("Socket.IO WebSocket server running on port 3001", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  })
}
