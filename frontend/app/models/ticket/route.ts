import { guardAi, guardJson, issueTicket } from "../../../lib/ai-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guardAi(req, undefined, "ticket");
  if (!denied.ok) {
    return guardJson(denied);
  }
  const { ticket, exp } = issueTicket();
  return Response.json(
    { ticket, exp },
    { headers: { "cache-control": "no-store" } },
  );
}
