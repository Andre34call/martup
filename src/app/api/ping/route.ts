// GET /api/ping - Zero-dependency health check
// No database, no env vars, no imports. Just confirms the deployment is alive.
export async function GET() {
  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    vercel: !!process.env.VERCEL,
    vercelUrl: process.env.VERCEL_URL || null,
    nodeEnv: process.env.NODE_ENV,
  })
}
