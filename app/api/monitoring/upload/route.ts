import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/backend";
import { MAX_VIDEO_BYTES } from "@/lib/monitoring-validation";
import { revalidatePath } from "next/cache";

// Sama seperti pemeriksaan Server Actions: Origin harus sama dengan host yang diminta browser.
// (request.url di Next selalu "localhost", jadi akses lewat IP/LAN/reverse proxy akan selalu ditolak.)
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Asal permintaan tidak valid." }, { status: 403 });
  const token = (await cookies()).get("apd_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;")) return NextResponse.json({ message: "Format upload tidak valid." }, { status: 400 });
  if (Number(request.headers.get("content-length") || 0) > MAX_VIDEO_BYTES + 1024 * 1024) return NextResponse.json({ message: "Video maksimal 500 MB." }, { status: 413 });
  try {
    // Forward the multipart stream without loading a whole video into server memory.
    const init: RequestInit & { duplex: "half" } = { method: "POST", body: request.body,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType }, duplex: "half",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(300000)]) };
    const response = await fetch(`${getBackendUrl()}/video-sources/upload`, init);
    if (!response.ok) {
      return NextResponse.json({ message: response.status === 413 ? "Ukuran video melebihi batas backend." : "Upload gagal. Periksa format video, lokasi, jenis area, dan akses akun Anda." },
        { status: response.status, headers: { "Cache-Control": "no-store" } });
    }
    // Do not expose file paths, stream URLs, or backend validation inputs.
    await response.body?.cancel();
    revalidatePath("/dashboard"); revalidatePath("/dashboard/location-management");
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "Upload belum dapat dikonfirmasi. Periksa daftar sumber sebelum mencoba lagi." }, { status: 502 }); }
}
