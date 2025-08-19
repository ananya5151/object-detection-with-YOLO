import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    // Check if .env.local exists and contains NGROK_URL
    const envPath = path.join(process.cwd(), ".env.local")

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8")
      const ngrokMatch = envContent.match(/NGROK_URL=(.+)/)

      if (ngrokMatch && ngrokMatch[1] && ngrokMatch[1].trim() !== "") {
        return NextResponse.json({ ngrokUrl: ngrokMatch[1].trim() })
      }
    }

    return NextResponse.json({ ngrokUrl: null })
  } catch (error) {
    console.error("Error reading ngrok URL:", error)
    return NextResponse.json({ ngrokUrl: null })
  }
}
