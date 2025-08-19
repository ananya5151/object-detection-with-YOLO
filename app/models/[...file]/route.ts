import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"

function contentTypeForExt(ext: string) {
    switch (ext.toLowerCase()) {
        case ".onnx":
            return "application/octet-stream"
        case ".json":
            return "application/json"
        case ".bin":
            return "application/octet-stream"
        default:
            return "application/octet-stream"
    }
}

export async function GET(_req: Request, { params }: { params: { file: string[] } }) {
    try {
        const fileParts = params?.file || []

        if (!fileParts || fileParts.length === 0) {
            return NextResponse.json({ error: 'missing filename' }, { status: 400 })
        }

        const rel = path.join(...fileParts)
        const modelsDir = path.join(process.cwd(), "models")
        const filePath = path.join(modelsDir, rel)

        // Prevent path traversal: ensure resolved path starts with modelsDir
        const resolved = path.resolve(filePath)
        if (!resolved.startsWith(path.resolve(modelsDir))) {
            console.warn('[models route] path traversal attempt:', filePath)
            return NextResponse.json({ error: 'invalid path' }, { status: 400 })
        }

        if (!fs.existsSync(resolved)) {
            return NextResponse.json({ error: 'not found' }, { status: 404 })
        }

        const stat = fs.statSync(resolved)
        const data = fs.readFileSync(resolved)
        const ext = path.extname(resolved)
        const headers: Record<string, string> = {}
        headers["Content-Type"] = contentTypeForExt(ext)
        headers["Content-Length"] = String(stat.size)
        headers["Cache-Control"] = "public, max-age=0, must-revalidate"

        return new NextResponse(data, { status: 200, headers })
    } catch (err) {
        console.error("Error serving model file:", err)
        return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
}

export async function HEAD(_req: Request, { params }: { params: { file: string[] } }) {
    try {
        const fileParts = params?.file || []
        if (!fileParts || fileParts.length === 0) {
            return NextResponse.json({ error: 'missing filename' }, { status: 400 })
        }

        const rel = path.join(...fileParts)
        const modelsDir = path.join(process.cwd(), "models")
        const filePath = path.join(modelsDir, rel)
        const resolved = path.resolve(filePath)
        if (!resolved.startsWith(path.resolve(modelsDir))) {
            return NextResponse.json({ error: 'invalid path' }, { status: 400 })
        }

        if (!fs.existsSync(resolved)) {
            return NextResponse.json({ error: 'not found' }, { status: 404 })
        }

        const stat = fs.statSync(resolved)
        const ext = path.extname(resolved)
        const headers: Record<string, string> = {}
        headers["Content-Type"] = contentTypeForExt(ext)
        headers["Content-Length"] = String(stat.size)
        headers["Cache-Control"] = "public, max-age=0, must-revalidate"

        return new NextResponse(null, { status: 200, headers })
    } catch (err) {
        console.error("Error serving model HEAD:", err)
        return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
}
