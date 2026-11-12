
import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";
import { TOKEN_COOKIE } from "@/lib/session-cookie";

export async function POST(request: NextRequest) {
  // Cabut token di backend (POST /auth/logout) supaya tidak bisa dipakai lagi walau belum kedaluwarsa.
  // Gagal menghubungi backend tidak menghalangi logout lokal.
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) {
    await fetch(`${getBackendUrl()}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
  }

  const response = NextResponse.json({
    message: "Logout berhasil",
  });

  response.cookies.delete(TOKEN_COOKIE);

  return response;
}
