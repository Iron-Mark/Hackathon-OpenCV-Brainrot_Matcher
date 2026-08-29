import { generateText } from "ai";
import { BRAINROT_CHARACTERS } from "../../../lib/characters";
import { CHARACTER_LOOKS } from "../../../lib/character-looks";

export const maxDuration = 60;

function decodeBase64(image: string): Uint8Array {
  return Uint8Array.from(Buffer.from(image, "base64"));
}

function fileToDataUrl(file: { base64?: string; mediaType?: string }): string | null {
  if (!file.base64) {
    return null;
  }
  const media = file.mediaType && file.mediaType.startsWith("image/") ? file.mediaType : "image/png";
  return `data:${media};base64,${file.base64}`;
}

async function characterStill(req: Request, id: string): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  try {
    const res = await fetch(new URL(`/models/brainrot/${id}`, req.url), {
      headers: { "user-agent": "opencv-cloud/0.1" },
    });
    if (!res.ok) {
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 80) {
      return null;
    }
    return { bytes, mediaType: res.headers.get("content-type") ?? "image/jpeg" };
  } catch {
    return null;
  }
}

function hybridPrompt(name: string, vibe: string, blurb: string): string {
  return `Create ONE new image: a hybrid mashup of the uploaded person and the Italian/Indonesian brainrot mascot.

Image 1 = the person (or selfie).
Image 2 = the official ${name} still.

Rules:
- Keep the person's face recognizable: face shape, eyes, expression, hairline. Do not replace the face with the mascot's face.
- This is NOT a cheap cut-and-paste face swap. Blend them: the person becoming ${name}.
- Restyle the body, clothes, colors, silhouette, and energy as ${name}: ${vibe}. ${blurb}
- Cartoon / meme mascot look, slightly glossy, fun, readable at a glance.
- Keep it safe: no nudity, no gore, no extra text, no watermark.
- Square composition, one subject, clear background.`;
}

export async function POST(req: Request) {
  let image = "";
  let id = "";
  try {
    const body = (await req.json()) as { image?: string; id?: string };
    image = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
    id = String(body.id ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const character = BRAINROT_CHARACTERS.find((item) => item.id === id);
  if (!character) {
    return Response.json({ error: "Unknown character" }, { status: 400 });
  }
  if (image.length < 80 || image.length > 1_800_000) {
    return Response.json({ error: "Image too small or too large" }, { status: 400 });
  }

  const person = decodeBase64(image);
  const still = await characterStill(req, id);
  const look = CHARACTER_LOOKS[id];
  const prompt = hybridPrompt(character.name, look?.vibe ?? character.blurb, character.blurb);

  const content: Array<{ type: "text"; text: string } | { type: "file"; data: Uint8Array; mediaType: string }> = [
    { type: "text", text: prompt },
    { type: "file", data: person, mediaType: "image/jpeg" },
  ];
  if (still) {
    content.push({ type: "file", data: still.bytes, mediaType: still.mediaType });
  }

  const models = ["google/gemini-3.1-flash-image-preview", "google/gemini-3-pro-image"];
  let last = "Hybrid image failed";
  for (const model of models) {
    try {
      const result = await generateText({
        model,
        temperature: 0.4,
        messages: [{ role: "user", content }],
      });
      const images = result.files.filter((file) => file.mediaType?.startsWith("image/"));
      const dataUrl = images[0] ? fileToDataUrl(images[0]) : null;
      if (!dataUrl) {
        last = result.text?.slice(0, 180) || "Model returned no image";
        continue;
      }
      return Response.json({ image: dataUrl, id, name: character.name });
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    }
  }
  return Response.json({ error: last }, { status: 502 });
}
