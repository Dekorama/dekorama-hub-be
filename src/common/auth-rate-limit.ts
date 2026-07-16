import { HttpException, HttpStatus } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const MAX_HITS = Number(process.env.AUTH_RATE_LIMIT_MAX) || 20;

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";
  return ip;
}

/** Simple in-memory rate limit for auth endpoints (per IP). */
export function authRateLimitMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const now = Date.now();
  const key = clientKey(req);
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > MAX_HITS) {
    next(
      new HttpException(
        "Demasiados intentos. Prueba de nuevo más tarde.",
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    return;
  }

  next();
}
