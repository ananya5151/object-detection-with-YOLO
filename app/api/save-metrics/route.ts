//app\api\save-metrics\route.ts
import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export async function POST(request: Request) {
  try {
    const metrics = await request.json()
    
    // Save to project root directory
    const projectRoot = process.cwd()
    const metricsPath = path.join(projectRoot, "metrics.json")
    
    console.log("[API] Saving metrics.json to:", metricsPath)
    
    // Write metrics to file
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2), 'utf8')
    
    console.log("[API] Successfully saved metrics.json")
    
    return NextResponse.json({ 
      success: true, 
      message: "Metrics saved successfully",
      path: metricsPath 
    })
    
  } catch (error) {
    console.error("[API] Failed to save metrics:", error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to save metrics",
        details: String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Check if metrics.json exists and return it
    const projectRoot = process.cwd()
    const metricsPath = path.join(projectRoot, "metrics.json")
    
    const data = await fs.readFile(metricsPath, 'utf8')
    const metrics = JSON.parse(data)
    
    return NextResponse.json(metrics)
    
  } catch (error) {
    return NextResponse.json(
      { error: "metrics.json not found" },
      { status: 404 }
    )
  }
}