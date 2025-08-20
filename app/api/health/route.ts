import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Basic health check with proper typing
        const health: {
            status: string;
            timestamp: string;
            uptime: number;
            environment: string | undefined;
            mode: string;
            version: string;
            pythonServer?: string;
        } = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            mode: process.env.MODE || 'wasm',
            version: process.env.npm_package_version || '1.0.0'
        }

        // Check if Python server is running (if in server mode)
        if (process.env.MODE === 'server') {
            try {
                const response = await fetch('http://localhost:8765/health', {
                    signal: AbortSignal.timeout(2000)
                })
                if (response.ok) {
                    health.pythonServer = 'healthy'
                } else {
                    health.pythonServer = 'unhealthy'
                }
            } catch (error) {
                health.pythonServer = 'unreachable'
            }
        }

        return NextResponse.json(health)
    } catch (error) {
        return NextResponse.json(
            {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        )
    }
}
