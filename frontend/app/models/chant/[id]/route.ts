import { BRAINROT_CHARACTERS } from "../../../../lib/characters";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function chantUrl(text: string, host: "googleapis" | "google"): string {
  const q = encodeURIComponent(text);
  if (host === "googleapis") {
    return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=it&q=${q}`;
  }
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=it&q=${q}`;
}

async function fetchItalianChant(text: string): Promise<Response | null> {
  for (const host of ["googleapis", "google"] as const) {
    const upstream = await fetch(chantUrl(text, host), {
      headers: {
        accept: "audio/mpeg",
        "user-agent": UA,
      },
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) {
      continue;
    }
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength < 800) {
      continue;
    }
    return new Response(bytes, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const character = BRAINROT_CHARACTERS.find((item) => item.id === id);
  if (!character) {
    return new Response("Unknown character", { status: 404 });
  }

  const audio = await fetchItalianChant(character.theme.chant);
  if (!audio) {
    return new Response("Italian chant unavailable", { status: 502 });
  }
  return audio;
}
