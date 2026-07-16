import * as crypto from "crypto";
import { CookieOptions, Request, Response } from "express";
import { requireSecret, timingSafeEqualString } from "../common/secrets";

export const SESSION_COOKIE = "dekorama_session";

/** Default 7 days */
export const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    requireSecret("JWT_SECRET", "dev-only-jwt-secret-change-me")
  );
}

/** Signed cookie: userId.exp.hmac — exp = unix seconds */
export function signSession(userId: string, ttlMs = SESSION_TTL_MS): string {
  const exp = Math.floor((Date.now() + ttlMs) / 1000).toString();
  const payload = `${userId}.${exp}`;
  const sig = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  if (!userId || !expStr || !sig) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  const payload = `${userId}.${expStr}`;
  const expected = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");

  if (!timingSafeEqualString(sig, expected)) return null;
  return userId;
}

export function readSessionUserId(req: Request): string | null {
  const raw = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    SESSION_COOKIE
  ];
  return verifySessionToken(raw);
}

/**
 * First-party cookies (via Next /api proxy): sameSite=lax works on mobile Safari.
 * Set COOKIE_SAMESITE=none only if browser talks to API host directly (cross-site).
 */
export function sessionCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  const crossSite = process.env.COOKIE_SAMESITE === "none";
  return {
    httpOnly: true,
    path: "/",
    sameSite: crossSite ? "none" : "lax",
    secure: isProd || crossSite,
    maxAge: SESSION_TTL_MS,
  };
}

export function setSessionCookie(res: Response, userId: string): void {
  res.cookie(SESSION_COOKIE, signSession(userId), sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
}
