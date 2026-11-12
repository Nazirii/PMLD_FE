import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend";
import { validId } from "@/lib/monitoring-validation";

// Satu frame beranotasi terbaru (request pendek). Dipakai kartu dashboard: tidak memegang koneksi terus-menerus
// seperti MJPEG, jadi batas 6 koneksi HTTP/1.1 per host di browser tidak habis oleh banyak kartu.
const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!validId(sessionId)) return new NextResponse(null, { status: 400, headers: HEADERS });
  const size = request.nextUrl.searchParams.get("size") === "thumb" ? "thumb" : "full";
  try {
    const response = await backendFetch(`/analysis-sessions/${sessionId}/preview.jpg?size=${size}`, {
      headers: { Accept: "image/jpeg" }, redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok) return new NextResponse(null, { status: response.status, headers: HEADERS });
    if (response.headers.get("content-type")?.split(";")[0] !== "image/jpeg") return new NextResponse(null, { status: 502, headers: HEADERS });
    return new NextResponse(response.body, { headers: { ...HEADERS, "Content-Type": "image/jpeg" } });
  } catch (error) { return new NextResponse(null, { status: error instanceof BackendError ? error.status : 502, headers: HEADERS }); }
}
