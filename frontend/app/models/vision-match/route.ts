import { generateText } from "ai";
import { guardAi, guardJson } from "../../../lib/ai-guard";
import { ROSTER_IDS, rosterForVision } from "../../../lib/character-looks";

export const maxDuration = 20;

type VisionMatch = {
  subject: "person" | "character" | "other";
  matches: Array<{ id: string; percent: number; reason: string }>;
};

function decodeBase64(image: string): Uint8Array {
  return Uint8Array.from(Buffer.from(image, "base64"));
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function asSubject(value: unknown): VisionMatch["subject"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("character") || text.includes("mascot")) {
    return "character";
  }
  if (text.includes("person") || text.includes("selfie") || text.includes("human")) {
    return "person";
  }
  return "other";
}

function asPercent(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) {
    return 0;
  }
  const scaled = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(1, Math.min(99, Math.round(scaled)));
}

function asId(value: unknown): string | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (ROSTER_IDS.includes(raw)) {
    return raw;
  }
  return ROSTER_IDS.find((id) => raw.includes(id) || id.includes(raw)) ?? null;
}

function sanitize(raw: unknown): VisionMatch {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.matches) ? obj.matches : [];
  const seen = new Set<string>();
  const matches: VisionMatch["matches"] = [];
  for (const row of rows) {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const id = asId(item.id ?? item.character ?? item.name);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    matches.push({
      id,
      percent: asPercent(item.percent ?? item.score ?? item.confidence),
      reason: String(item.reason ?? item.why ?? "matched clothes, colors, and vibe").slice(0, 160),
    });
  }
  if (matches.length === 0) {
    throw new Error("No roster matches in model output");
  }
  matches.sort((a, b) => b.percent - a.percent);
  return { subject: asSubject(obj.subject), matches };
}

const PROMPT = `You match one photo to Italian/Indonesian brainrot mascots.

Return ONLY JSON, no markdown:
{"subject":"person"|"character"|"other","matches":[{"id":"...","percent":0-99,"reason":"..."}]}

Rules:
- subject=character if the photo already IS a roster mascot. Give that id 88-99.
- subject=person for selfies / real people. Do NOT match facial identity or skin tone.
  Match clothing colors, hair color, accessories, silhouette, and energy to the costume.
- Be honest. A random selfie should not score near 90. Typical winner is 42-78.
- Use only the exact ids below. Return 4 to 6 ranked matches.

Roster:
${rosterForVision()}`;

async function askModel(model: string, bytes: Uint8Array): Promise<VisionMatch> {
  const { text } = await generateText({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "file", data: bytes, mediaType: "image/jpeg" },
        ],
      },
    ],
  });
  return sanitize(extractJson(text));
}

export async function POST(req: Request) {
  let image = "";
  let ticket = "";
  try {
    const body = (await req.json()) as { image?: string; ticket?: string };
    image = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
    ticket = String(body.ticket ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const denied = await guardAi(req, ticket, "vision");
  if (!denied.ok) {
    return guardJson(denied);
  }

  if (image.length < 80 || image.length > 1_800_000) {
    return Response.json({ error: "Image too small or too large" }, { status: 400 });
  }

  const bytes = decodeBase64(image);
  const models = ["google/gemini-2.5-flash", "openai/gpt-4o-mini"];
  let last = "Vision match failed";
  for (const model of models) {
    try {
      return Response.json(await askModel(model, bytes));
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    }
  }
  return Response.json({ error: last }, { status: 502 });
}
