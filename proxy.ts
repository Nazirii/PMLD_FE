import { NextResponse, type NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";
import { TOKEN_COOKIE, tokenCookieOptions } from "@/lib/session-cookie";

// Token backend berumur 30 menit (batas tidak aktif SRS 5.2). Selama pengguna masih memakai dashboard,
// token yang sisa umurnya < 20 menit ditukar lewat POST /auth/refresh, jadi paling sering ~10 menit sekali.
// Batas total sesi (SESSION_MAX_MINUTES) tetap ditegakkan backend.
const REFRESH_BELOW_SECONDS = 20 * 60;

function tokenExpiry(token: string): number | null {
  try {
    const payload: unknown = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return payload && typeof payload === "object" && "exp" in payload && typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

async function refreshToken(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${getBackendUrl()}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return data && typeof data === "object" && "access_token" in data && typeof data.access_token === "string" && data.access_token
      ? data.access_token : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const expiry = token ? tokenExpiry(token) : null;
  const remaining = expiry === null ? null : expiry - Date.now() / 1000;
  // Token kosong/kedaluwarsa/masih panjang: biarkan; halaman dan route handler yang menangani 401.
  if (!token || remaining === null || remaining <= 0 || remaining > REFRESH_BELOW_SECONDS) return NextResponse.next();

  const fresh = await refreshToken(token);
  if (!fresh) return NextResponse.next();

  // Teruskan token baru ke request ini juga (server component / route handler membaca cookies()).
  request.cookies.set(TOKEN_COOKIE, fresh);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(TOKEN_COOKIE, fresh, tokenCookieOptions);
  return response;
}

export const config = {
  // /api/monitoring/upload sengaja DIKECUALIKAN: request yang lewat proxy body-nya di-buffer ke memori dengan
  // batas 10 MB (proxyClientMaxBodySize), sehingga video besar terpotong dan ditolak backend (422).
  matcher: ["/dashboard/:path*", "/api/monitoring/((?!upload).*)", "/api/users/:path*"],
};
