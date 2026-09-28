import { checkBotId } from "botid/server";
import { guardConfigurationError, verifyTicket } from "./ai-ticket-server";

export type GuardOk = { ok: true };
export type GuardErr = {
  ok: false;
  status: number;
  error: string;
  retryAfter?: number;
};
export type GuardResult = GuardOk | GuardErr;

export type AiKind = "hybrid" | "vision" | "ticket";

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

function disabled(kind: AiKind): boolean {
  if (kind === "hybrid") {
    return process.env.AI_HYBRID_DISABLED === "1";
  }
  if (kind === "vision") {
    return process.env.AI_VISION_DISABLED === "1";
  }
  return false;
}

/**
 * Protects paid AI endpoints with Vercel BotID. Request headers are not used as
 * proof that a caller is a browser; BotID verifies its own browser challenge.
 * Atomic request quotas are enforced at Vercel Firewall before this function.
 */
export async function guardAi(req: Request, ticket: string | undefined, kind: AiKind): Promise<GuardResult> {
  if (disabled(kind)) {
    return deny(503, kind === "hybrid" ? "Hybrid is temporarily off." : "Vision match is temporarily off.");
  }

  if (guardConfigurationError(req)) {
    return deny(503, "AI access is temporarily unavailable.");
  }

  try {
    const verification = await checkBotId({
      advancedOptions: { checkLevel: "basic" },
    });
    if (verification.isBot || !verification.isHuman) {
      return deny(403, "Automated access is not allowed.");
    }
  } catch {
    // A verifier outage must not turn into unmetered access to paid models.
    return deny(503, "AI access verification is temporarily unavailable.");
  }

  if (kind !== "ticket" && !verifyTicket(req, ticket ?? "")) {
    return deny(403, "Session expired. Refresh the page and try again.");
  }

  return { ok: true };
}
