import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.AI_GUARD_SECRET = "test-only-secret-that-is-at-least-32-bytes";
process.env.VERCEL = "1";
process.env.NODE_ENV = "production";

const { AI_TICKET_TTL_SEC, guardConfigurationError, issueTicket, trustedClientIp, verifyTicket } = await import(
  "../lib/ai-ticket-server.ts"
);

const request = (ip = "203.0.113.10", deployment = "opencv-cloud-a1b2c3.vercel.app") =>
  new Request("https://opencv-cloud.vercel.app/models/ticket", {
    headers: {
      "x-vercel-forwarded-for": ip,
      "x-vercel-deployment-url": deployment,
    },
  });

const now = 1_800_000_000;
const req = request();
const fresh = issueTicket(req, now);

assert.equal(guardConfigurationError(req), null);
assert.equal(trustedClientIp(req), "203.0.113.10");
assert.equal(verifyTicket(req, fresh.ticket, now), true);
assert.equal(verifyTicket(req, fresh.ticket, now + AI_TICKET_TTL_SEC), false);
assert.equal(verifyTicket(request("203.0.113.11"), fresh.ticket, now), false);
assert.equal(verifyTicket(request("203.0.113.10", "other-deployment.vercel.app"), fresh.ticket, now), false);
assert.equal(verifyTicket(req, `${fresh.ticket}x`, now), false);
assert.equal(verifyTicket(req, "not.a.ticket", now), false);

const parts = fresh.ticket.split(".");
const longExpiry = now + 365 * 24 * 60 * 60;
const longPayload = [parts[0], parts[1], String(now), String(longExpiry), parts[4]].join(".");
const forgedLongTicket = `${longPayload}.${createHmac("sha256", process.env.AI_GUARD_SECRET).update(longPayload).digest("base64url")}`;
assert.equal(verifyTicket(req, forgedLongTicket, now), false);

const originalSecret = process.env.AI_GUARD_SECRET;
delete process.env.AI_GUARD_SECRET;
assert.equal(guardConfigurationError(req), "secret");
assert.throws(() => issueTicket(req, now), /not configured/);
process.env.AI_GUARD_SECRET = originalSecret;

delete process.env.VERCEL;
assert.equal(trustedClientIp(req), null);
assert.equal(guardConfigurationError(req), "client-ip");

console.log("AI guard secret, trusted IP, ticket binding, signature, and TTL checks passed");
