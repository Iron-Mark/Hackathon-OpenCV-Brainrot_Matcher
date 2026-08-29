type TicketCache = { ticket: string; exp: number };

let cached: TicketCache | null = null;

export async function aiTicket(): Promise<string> {
  const now = Date.now() / 1000;
  if (cached && cached.exp - 20 > now) {
    return cached.ticket;
  }
  const res = await fetch("/models/ticket", {
    method: "GET",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const body = (await res.json()) as { ticket?: string; exp?: number; error?: string };
  if (!res.ok || !body.ticket) {
    throw new Error(body.error || "Could not start a secure session");
  }
  cached = { ticket: body.ticket, exp: body.exp ?? now + 600 };
  return cached.ticket;
}
