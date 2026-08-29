import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import assert from "node:assert/strict";

const secret = process.env.AI_GUARD_SECRET || process.env.VERCEL_PROJECT_ID || "opencv-cloud-dev-guard";
const BOT_UA =
  /^(curl|wget|python-requests|python-urllib|go-http-client|java\/|libwww|scrapy|postmanruntime|postman|insomnia|httpie|okhttp|aiohttp|node-fetch|undici|axios\/|libcurl|powershell|httpclient)/i;

function issueTicket(ttlSec = 12 * 60) {
  const sid = randomBytes(16).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${sid}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return { ticket: `${payload}.${sig}`, exp };
}

function verifyTicket(ticket) {
  const parts = String(ticket ?? "").trim().split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [sid, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!sid || !Number.isFinite(exp) || exp < Date.now() / 1000) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${sid}.${expStr}`).digest("base64url");
  try {
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function browserLikeUa(ua) {
  const text = ua.trim();
  if (text.length < 16 || BOT_UA.test(text)) {
    return false;
  }
  return /mozilla\/|safari\/|chrome\/|firefox\/|edg\/|opr\//i.test(text);
}

function hostOf(value) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const fresh = issueTicket();
assert.equal(verifyTicket(fresh.ticket), true);
assert.equal(verifyTicket(`${fresh.ticket}x`), false);
assert.equal(verifyTicket("not.a.ticket"), false);
assert.equal(verifyTicket(issueTicket(-10).ticket), false);

assert.equal(browserLikeUa("curl/8.7.1"), false);
assert.equal(browserLikeUa("python-requests/2.32.0"), false);
assert.equal(browserLikeUa("short"), false);
assert.equal(
  browserLikeUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"),
  true,
);

assert.equal(hostOf("https://opencv-cloud.vercel.app/models/hybrid"), "opencv-cloud.vercel.app");
assert.equal(hostOf("https://opencv-cloud.vercel.app"), hostOf("https://opencv-cloud.vercel.app/foo"));
assert.equal(hostOf("not-a-url"), null);

console.log("ai-guard ticket, UA, and origin checks passed");
