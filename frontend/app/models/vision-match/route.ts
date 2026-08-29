import { generateText, Output } from "ai";
import { z } from "zod";
import { rosterForVision } from "../../../lib/character-looks";

export const maxDuration = 20;

const Schema = z.object({
  subject: z.enum(["person", "character", "other"]),
  matches: z
    .array(
      z.object({
        id: z.string().describe("Exact roster id"),
        percent: z.number().min(0).max(99),
        reason: z
          .string()
          .describe("Short reason tied to colors, clothes, silhouette, or vibe — not identity"),
      }),
    )
    .min(3)
    .max(17),
});

export async function POST(req: Request) {
  let image = "";
  try {
    const body = (await req.json()) as { image?: string };
    image = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (image.length < 80 || image.length > 1_800_000) {
    return Response.json({ error: "Image too small or too large" }, { status: 400 });
  }

  try {
    const { output } = await generateText({
      model: "google/gemini-2.5-flash",
      output: Output.object({
        name: "BrainrotMatch",
        description: "Rank brainrot characters against a photo",
        schema: Schema,
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Match this photo to the Italian / Indonesian brainrot roster.

Rules:
- If the photo is already one of the characters, identify that character with a high percent.
- If the photo is a person or everyday scene, do NOT match facial identity. Match clothing colors, hair color, accessories, silhouette, energy, and vibe to the character costumes.
- Be honest. A random selfie should not all score near 90. The winner can be 40-80 if the vibe is only close.
- Use only these ids.

Roster:
${rosterForVision()}`,
            },
            {
              type: "file",
              data: image,
              mediaType: "image/jpeg",
            },
          ],
        },
      ],
    });

    if (!output) {
      return Response.json({ error: "No vision output" }, { status: 502 });
    }
    return Response.json(output);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vision match failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
