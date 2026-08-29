import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export type GuardOk = { ok: true };
export type GuardErr = {
  ok: false;
  status: number;
  error: string;
  retryAfter?: number;
};
export type GuardResult = GuardOk | GuardErr;

export type AiKind = "hybrid" | "vision" | "ticket";

type MemoryEntry = { n: number; resetAt: number };

const memory = new Map<string, MemoryEntry>();

const BOT_UA =
  /^(curl|wget|python-requests|python-urllib|go-http-client|java\/|libwww|scrapy|postmanruntime|postman|insomnia|httpie|okhttp|aiohttp|node-fetch|undici|axios\/|libcurl|powershell|httpclient)/i;

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function secret(): string {
  return process.env.AI_GUARD_SECRET || process.env.VERCEL_PROJECT_ID || "opencv-cloud-dev-guard";
}

export function issueTicket(ttlSec = 12 * 60): { ticket: string; exp: number } {
  const sid = randomBytes(16).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${sid}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { ticket: `${payload}.${sig}`, exp };
}

export function verifyTicket(ticket: string): boolean {
  const parts = String(ticket ?? "").trim().split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [sid, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!sid || !Number.isFinite(exp) || exp < Date.now() / 1000) {
    return false;
  }
  const expected = createHmac("sha256", secret()).update(`${sid}.${expStr}`).digest("base64url");
  try {
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function browserLikeUa(ua: string): boolean {
  const text = ua.trim();
  if (text.length < 16 || BOT_UA.test(text)) {
    return false;
  }
  return /mozilla\/|safari\/|chrome\/|firefox\/|edg\/|opr\//i.test(text);
}

export function hostOf(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function requestHost(req: Request): string {
  const raw = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return raw.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function sameSite(req: Request): boolean {
  const host = requestHost(req);
  const origin = hostOf(req.headers.get("origin"));
  const referer = hostOf(req.headers.get("referer"));
  if (origin) {
    return origin === host;
  }
  if (referer) {
    return referer === host;
  }
  return false;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

function ipHash(ip: string): string {
  return createHash("sha256").update(`${secret()}:${ip}`).digest("hex").slice(0, 16);
}

function utcHour(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}h${d.getUTCHours()}`;
}

function utcDay(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}`;
}

function deny(status: number, error: string, retryAfter?: number): GuardErr {
  return retryAfter ? { ok: false, status, error, retryAfter } : { ok: false, status, error };
}

export function guardJson(denied: GuardErr): Response {
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (denied.retryAfter) {
    headers["retry-after"] = String(denied.retryAfter);
  }
  return Response.json({ error: denied.error }, { status: denied.status, headers });
}

function memoryIncr(key: string, ttlSec: number): number {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.resetAt <= now) {
    memory.set(key, { n: 1, resetAt: now + ttlSec * 1000 });
    return 1;
  }
  cur.n += 1;
  return cur.n;
}

async function incr(key: string, ttlSec: number): Promise<{ n: number; cached: boolean }> {
  try {
    const { getCache } = await import("@vercel/functions");
    const cache = getCache({ namespace: "ai-guard" });
    const raw = await cache.get(key);
    const n = (typeof raw === "number" ? raw : Number(raw) || 0) + 1;
    await cache.set(key, n, { ttl: ttlSec, tags: ["ai-guard", key], name: key });
    return { n, cached: true };
  } catch {
    return { n: memoryIncr(key, ttlSec), cached: false };
  }
}

async function lastSeen(key: string): Promise<number> {
  try {
    const { getCache } = await import("@vercel/functions");
    const cache = getCache({ namespace: "ai-guard" });
    const raw = await cache.get(key);
    return typeof raw === "number" ? raw : Number(raw) || 0;
  } catch {
    const cur = memory.get(key);
    return cur && cur.resetAt > Date.now() ? cur.n : 0;
  }
}

async function stamp(key: string, value: number, ttlSec: number): Promise<void> {
  try {
    const { getCache } = await import("@vercel/functions");
    const cache = getCache({ namespace: "ai-guard" });
    await cache.set(key, value, { ttl: ttlSec, tags: ["ai-guard", key], name: key });
  } catch {
    memory.set(key, { n: value, resetAt: Date.now() + ttlSec * 1000 });
  }
}

function limits(kind: AiKind) {
  if (kind === "hybrid") {
    return {
      cooldown: envInt("AI_HYBRID_COOLDOWN", 40),
      hour: envInt("AI_HYBRID_HOUR_IP", 3),
      day: envInt("AI_HYBRID_DAY_IP", 6),
      global: envInt("AI_HYBRID_DAY_GLOBAL", 80),
      failClosed: true,
      disabled: process.env.AI_HYBRID_DISABLED === "1",
      label: "hybrid",
    };
  }
  if (kind === "vision") {
    return {
      cooldown: envInt("AI_VISION_COOLDOWN", 4),
      hour: envInt("AI_VISION_HOUR_IP", 8),
      day: envInt("AI_VISION_DAY_IP", 30),
      global: envInt("AI_VISION_DAY_GLOBAL", 400),
      failClosed: false,
      disabled: process.env.AI_VISION_DISABLED === "1",
      label: "match",
    };
  }
  return {
    cooldown: 2,
    hour: envInt("AI_TICKET_HOUR_IP", 40),
    day: envInt("AI_TICKET_DAY_IP", 120),
    global: envInt("AI_TICKET_DAY_GLOBAL", 4000),
    failClosed: false,
    disabled: false,
    label: "session",
  };
}

function inspectBrowser(req: Request, kind: AiKind): GuardErr | GuardOk {
  const ua = req.headers.get("user-agent") ?? "";
  if (!browserLikeUa(ua)) {
    return deny(403, "Blocked. Open the site in a browser and try again.");
  }
  const site = (req.headers.get("sec-fetch-site") ?? "").toLowerCase();
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") {
    return deny(403, "Blocked. Open the site in a browser and try again.");
  }
  const hasHint = Boolean(req.headers.get("origin") || req.headers.get("referer"));
  if (kind === "ticket") {
    if (hasHint && !sameSite(req)) {
      return deny(403, "Blocked. Open the site in a browser and try again.");
    }
    return { ok: true };
  }
  if (!sameSite(req)) {
    return deny(403, "Blocked. Open the site in a browser and try again.");
  }
  return { ok: true };
}

export async function guardAi(req: Request, ticket: string | undefined, kind: AiKind): Promise<GuardResult> {
  const cfg = limits(kind);
  if (cfg.disabled) {
    return deny(503, kind === "hybrid" ? "Hybrid is temporarily off." : "Vision match is temporarily off.");
  }

  const browser = inspectBrowser(req, kind);
  if (!browser.ok) {
    return browser;
  }

  if (kind !== "ticket" && !verifyTicket(ticket ?? "")) {
    return deny(403, "Session expired. Refresh the page and try again.");
  }

  const ip = ipHash(clientIp(req));
  const hourKey = `${kind}:h:${ip}:${utcHour()}`;
  const dayKey = `${kind}:d:${ip}:${utcDay()}`;
  const globalKey = `${kind}:g:${utcDay()}`;
  const coolKey = `${kind}:c:${ip}`;

  try {
    const now = Math.floor(Date.now() / 1000);
    const last = await lastSeen(coolKey);
    if (last > 0 && now - last < cfg.cooldown) {
      const wait = cfg.cooldown - (now - last);
      return deny(429, `Slow down — this protects AI credits. Try again in ${wait}s.`, wait);
    }

    const hour = await incr(hourKey, 3600);
    if (hour.n > cfg.hour) {
      return deny(429, `Hourly ${cfg.label} limit reached. Try again later.`, 3600);
    }
    const day = await incr(dayKey, 86400);
    if (day.n > cfg.day) {
      return deny(429, `Daily ${cfg.label} limit reached for this connection.`, 86400);
    }
    const global = await incr(globalKey, 86400);
    if (global.n > cfg.global) {
      return deny(429, `${cfg.label[0].toUpperCase()}${cfg.label.slice(1)} is paused for today to protect AI credits.`, 86400);
    }

    if (cfg.failClosed && process.env.VERCEL && !hour.cached) {
      return deny(503, "Hybrid is paused while the spend limiter is unavailable.");
    }

    await stamp(coolKey, now, cfg.cooldown + 5);
    return { ok: true };
  } catch {
    if (cfg.failClosed) {
      return deny(503, "Hybrid is paused while the spend limiter is unavailable.");
    }
    return { ok: true };
  }
}
