import * as crypto from "crypto";

/** Fail hard in production when a secret is missing; allow weak local default in dev. */
export function requireSecret(envName: string, devFallback?: string): string {
  const value = process.env[envName]?.trim();
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${envName} must be set in production`);
  }

  if (devFallback) return devFallback;
  throw new Error(`${envName} is required`);
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
