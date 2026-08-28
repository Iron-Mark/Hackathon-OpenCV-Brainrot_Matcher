import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAINROT_CHARACTERS } from "../../../../lib/characters";

const COMMONS: Record<string, string> = {
  "tralalero-tralala": "Tralalero Tralala.webp",
  "tung-tung-tung-sahur": "Full image of Tung Tung Tung Sahur.png",
  "bombardiro-crocodilo": "Bombardiro Crocodillo.jpg",
  "bombombini-gusini": "Bombini Gusini.webp",
  "brr-brr-patapim": "Brr brr patapim.jpg",
  "lirili-larila": "Lirilì Larilà.webp",
  "cappuccino-assassino": "Cappucino assasino.webp",
  "ballerina-cappuccina": "Ballerina Cappuccina.png",
  "chimpanzini-bananini": "ChimpanziniBananini.webp",
  "boneca-ambalabu": "Boneca Ambalabu.jpg",
  "trippi-troppi": "Trippi Troppi Italian brainrot.png",
  "frigo-camelo": "Frigo Camelo.png",
  "giraffa-celeste": "Giraffa Celeste.jpg",
  "udin-din-din-dun": "Udin din din din dun.jpg",
  "ecco-cavallo-virtuoso": "Ecco Cavallo Virtuoso.webp",
  "frulli-frulla": "Frulli Frulla.jpg",
  "merluzzini-marraquetini": "Merluzzini Marraquetini.png",
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const known = BRAINROT_CHARACTERS.some((item) => item.id === id);
  const commons = COMMONS[id];
  if (!known || !commons) {
    return new Response("Unknown character", { status: 404 });
  }

  const local = path.join(process.cwd(), "public/assets/brainrot", `${id}.jpg`);
  try {
    const bytes = await readFile(local);
    return new Response(bytes, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    // Fall through to Wikimedia.
  }

  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons)}?width=512`;
  const upstream = await fetch(url, {
    headers: { "user-agent": "opencv-cloud/0.1" },
    next: { revalidate: 86400 },
  });
  if (!upstream.ok) {
    return new Response("Failed to fetch character still", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
