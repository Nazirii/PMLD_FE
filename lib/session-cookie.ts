// Token backend disimpan di cookie HttpOnly; dipakai login, refresh (proxy.ts), dan logout.
export const TOKEN_COOKIE = "apd_access_token";

export const tokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};
