import { CLIP_PROMPTS } from "./character-slots";
import { ROSTER_IDS } from "./character-looks";
import { idbGet, idbSet } from "./gallery-cache";

export type ClipHit = { id: string; score: number };

const CLIP_CACHE = "clip-text-v1";

let textEmbeds: Map<string, number[]> | null = null;
let loading: Promise<void> | null = null;

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

function cosine(a: number[], b: number[]): number {
  let num = 0;
  let da = 0;
  let db = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    num += a[i] * b[i];
    da += a[i] * a[i];
    db += b[i] * b[i];
  }
  const den = Math.sqrt(da * db);
  return den < 1e-8 ? 0 : num / den;
}

async function loadRemoteEsm(url: string): Promise<unknown> {
  const loader = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;
  return loader(url);
}

type TfMod = {
  AutoTokenizer: { from_pretrained: (id: string) => Promise<{ (texts: string[], opts: unknown): unknown }> };
  CLIPTextModelWithProjection: {
    from_pretrained: (id: string) => Promise<{ (inputs: unknown): Promise<{ text_embeds: { normalize: () => { tolist: () => number[][] } } }> }>;
  };
  AutoProcessor: { from_pretrained: (id: string) => Promise<(raw: unknown) => Promise<unknown>> };
  CLIPVisionModelWithProjection: {
    from_pretrained: (id: string) => Promise<{ (inputs: unknown): Promise<{ image_embeds: { normalize: () => { tolist: () => number[][] } } }> }>;
  };
  RawImage: { fromBlob: (blob: Blob) => Promise<unknown> };
};

async function loadClip() {
  if (textEmbeds) {
    return;
  }
  if (!loading) {
    loading = (async () => {
      const cached = await idbGet<Record<string, number[]>>(CLIP_CACHE);
      if (cached && Object.keys(cached).length >= 10) {
        textEmbeds = new Map(Object.entries(cached));
        return;
      }
      const tf = (await loadRemoteEsm(
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/+esm",
      )) as TfMod;
      const modelId = "Xenova/mobileclip_s2";
      const tokenizer = await tf.AutoTokenizer.from_pretrained(modelId);
      const textModel = await tf.CLIPTextModelWithProjection.from_pretrained(modelId);
      const texts = ROSTER_IDS.map((id) => CLIP_PROMPTS[id] ?? id);
      const inputs = tokenizer(texts, { padding: "max_length", truncation: true });
      const out = await textModel(inputs);
      const embeds = out.text_embeds.normalize().tolist();
      textEmbeds = new Map(ROSTER_IDS.map((id, i) => [id, embeds[i]]));
      await idbSet(CLIP_CACHE, Object.fromEntries(textEmbeds));
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  await loading;
}

export function warmupClip() {
  void loadClip().catch(() => undefined);
}

export function localClipScores(query: number[], gallery: Array<{ id: string; vec: number[] }>): ClipHit[] {
  return gallery
    .map((row) => ({ id: row.id, score: (cosine(query, row.vec) + 1) / 2 }))
    .sort((a, b) => b.score - a.score);
}

export function embedLocal(parts: Array<ArrayLike<number>>): number[] {
  const out: number[] = [];
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      out.push(part[i]);
    }
  }
  let norm = 0;
  for (const v of out) {
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}

function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d")?.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode crop"));
      }
    }, "image/jpeg", 0.82);
  });
}

export async function matchWithClip(imageData: ImageData): Promise<ClipHit[] | null> {
  try {
    const ready = await Promise.race([loadClip().then(() => true), timeout(5000, false)]);
    if (!ready || !textEmbeds) {
      return null;
    }
    const tf = (await loadRemoteEsm(
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/+esm",
    )) as TfMod;
    const modelId = "Xenova/mobileclip_s2";
    const processor = await tf.AutoProcessor.from_pretrained(modelId);
    const vision = await tf.CLIPVisionModelWithProjection.from_pretrained(modelId);
    const blob = await imageDataToBlob(imageData);
    const raw = await tf.RawImage.fromBlob(blob);
    const inputs = await processor(raw);
    const out = await vision(inputs);
    const image = out.image_embeds.normalize().tolist()[0];
    return [...textEmbeds.entries()]
      .map(([id, vec]) => ({ id, score: (cosine(image, vec) + 1) / 2 }))
      .sort((a, b) => b.score - a.score);
  } catch {
    return null;
  }
}
