import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const AI_TICKET_TTL_SEC = 12 * 60;
const CLOCK_SKEW_SEC = 30;
const MIN_SECRET_LENGTH = 32;
const VERSION = "v1";

function guardSecret(): string | null {
  const value = process.env.AI_GUARD_SECRET?.trim() ?? "";
  return value.length >= MIN_SECRET_LENGTH ? value : null;
}

function normalizeIp(raw: string | null): string | null {
  const value = raw?.split(",")[0]?.trim() ?? "";
  return isIP(value) ? value : null;
}

function trustedDeployment(req: Request): string | null {
  if (process.env.VERCEL === "1") {
    const value = req.headers.get("x-vercel-deployment-url")?.trim().toLowerCase() ?? "";
    return /^[a-z0-9.-]+\.vercel\.app$/.test(value) ? value : null;
  }
  return process.env.NODE_ENV === "production" ? null : "local-development";
}

/**
 * Vercel overwrites x-vercel-forwarded-for at its edge. Outside Vercel, there
 * is no generally safe way to distinguish a proxy header from attacker input,
 * so production deployments fail closed instead of trusting X-Forwarded-For.
 */
export function trustedClientIp(req: Request): string | null {
  if (process.env.VERCEL === "1") {
    return normalizeIp(req.headers.get("x-vercel-forwarded-for"));
  }
  return process.env.NODE_ENV === "production" ? null : "local-development";
}

export function guardConfigurationError(req: Request): "secret" | "client-ip" | "deployment" | null {
  if (!guardSecret()) {
    return "secret";
  }
  if (!trustedClientIp(req)) {
    return "client-ip";
  }
  return trustedDeployment(req) ? null : "deployment";
}

function subject(secret: string, ip: string, deployment: string): string {
  return createHmac("sha256", secret).update(`client:${ip}\ndeployment:${deployment}`).digest("base64url").slice(0, 22);
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueTicket(req: Request, nowSec = Math.floor(Date.now() / 1000)): { ticket: string; exp: number } {
  const secret = guardSecret();
  const ip = trustedClientIp(req);
  const deployment = trustedDeployment(req);
  if (!secret || !ip || !deployment) {
    throw new Error("AI guard is not configured");
  }

  const sid = randomBytes(16).toString("base64url");
  const iat = Math.floor(nowSec);
  const exp = iat + AI_TICKET_TTL_SEC;
  const payload = `${VERSION}.${sid}.${iat}.${exp}.${subject(secret, ip, deployment)}`;
  return { ticket: `${payload}.${signature(secret, payload)}`, exp };
}

export function verifyTicket(req: Request, ticket: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const secret = guardSecret();
  const ip = trustedClientIp(req);
  const deployment = trustedDeployment(req);
  if (!secret || !ip || !deployment) {
    return false;
  }

  const parts = String(ticket ?? "").trim().split(".");
  if (parts.length !== 6) {
    return false;
  }
  const [version, sid, iatText, expText, ticketSubject, sig] = parts;
  if (version !== VERSION || !/^[A-Za-z0-9_-]{22}$/.test(sid) || !/^\d{10}$/.test(iatText) || !/^\d{10}$/.test(expText)) {
    return false;
  }

  const iat = Number(iatText);
  const exp = Number(expText);
  const now = Math.floor(nowSec);
  if (exp - iat !== AI_TICKET_TTL_SEC || iat > now + CLOCK_SKEW_SEC || exp <= now) {
    return false;
  }
  if (ticketSubject !== subject(secret, ip, deployment)) {
    return false;
  }

  const payload = parts.slice(0, 5).join(".");
  const expected = signature(secret, payload);
  try {
    const left = Buffer.from(sig, "utf8");
    const right = Buffer.from(expected, "utf8");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
