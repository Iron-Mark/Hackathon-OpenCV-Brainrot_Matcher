import { guardAi, guardJson } from "../../../lib/ai-guard";
import { issueTicket } from "../../../lib/ai-ticket-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guardAi(req, undefined, "ticket");
  if (!denied.ok) {
    return guardJson(denied);
  }
  const { ticket, exp } = issueTicket(req);
  return Response.json(
    { ticket, exp },
    { headers: { "cache-control": "no-store" } },
  );
}
