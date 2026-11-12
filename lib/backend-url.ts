// Tanpa "server-only"/next/headers supaya bisa dipakai juga oleh proxy.ts.
export function getBackendUrl(): string {
  return (process.env.API_URL || process.env.FASTAPI_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}
