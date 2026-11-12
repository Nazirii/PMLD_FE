import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend";
import { validId } from "@/lib/monitoring-validation";

// Tayangan langsung beranotasi (MJPEG) dari sesi analisis yang sedang berjalan.
// Browser memakai URL ini sebagai src <img>; token tetap di cookie HttpOnly dan dikirim backend lewat server.
const MJPEG_TYPE = /^multipart\/x-mixed-replace;\s*boundary=[A-Za-z0-9_-]{1,70}$/;
const HEADERS = { "Cache-Control": "private, no-store, no-transform", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!validId(sessionId)) return new NextResponse(null, { status: 400, headers: HEADERS });
  const size = request.nextUrl.searchParams.get("size") === "thumb" ? "thumb" : "full";   // thumb = 480 px untuk kartu

  // Batas waktu hanya untuk menunggu respons awal; setelah itu stream berjalan sampai klien menutupnya.
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try {
    const response = await backendFetch(`/analysis-sessions/${sessionId}/live.mjpg?size=${size}`, {
      headers: { Accept: "multipart/x-mixed-replace" }, redirect: "error", signal: controller.signal,
    });
    clearTimeout(timer);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !response.body || !MJPEG_TYPE.test(type)) {
      controller.abort();
      return new NextResponse(null, { status: response.ok ? 502 : response.status, headers: HEADERS });
    }
    return new NextResponse(response.body, { headers: { ...HEADERS, "Content-Type": type, "X-Accel-Buffering": "no" } });
  } catch (error) {
    clearTimeout(timer);
    controller.abort();
    return new NextResponse(null, { status: error instanceof BackendError ? error.status : 502, headers: HEADERS });
  }
}
