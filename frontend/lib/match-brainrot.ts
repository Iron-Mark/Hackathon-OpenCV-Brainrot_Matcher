import { BRAINROT_CHARACTERS, type BrainrotCharacter } from "./characters";
import type { Detection } from "./types";

const SIZE = 128;
const H_BINS = 16;
const S_BINS = 12;
const EDGE_BINS = 24;

export type MatchRow = {
  character: BrainrotCharacter;
  raw: number;
  percent: number;
  reasons: string[];
};

type Feat = {
  hist: Float32Array;
  color: Float32Array;
  edges: Float32Array;
};

type Packed = { character: BrainrotCharacter; feat: Feat };

let gallery: Packed[] | null = null;
let galleryPromise: Promise<Packed[]> | null = null;

function resizeImageData(imageData: ImageData, width: number, height: number): ImageData {
  const src = document.createElement("canvas");
  src.width = imageData.width;
  src.height = imageData.height;
  src.getContext("2d")?.putImageData(imageData, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = width;
  dst.height = height;
  const ctx = dst.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) {
      h = ((gg - bb) / d) % 6;
    } else if (max === gg) {
      h = (bb - rr) / d + 2;
    } else {
      h = (rr - gg) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvHist(imageData: ImageData): Float32Array {
  const hist = new Float32Array(H_BINS * S_BINS);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) {
      continue;
    }
    const [h, s] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
    const hb = Math.min(H_BINS - 1, Math.floor((h / 360) * H_BINS));
    const sb = Math.min(S_BINS - 1, Math.floor(s * S_BINS));
    hist[hb * S_BINS + sb] += 1;
  }
  let sum = 0;
  for (let i = 0; i < hist.length; i += 1) {
    sum += hist[i];
  }
  const n = sum || 1;
  for (let i = 0; i < hist.length; i += 1) {
    hist[i] /= n;
  }
  return hist;
}

function meanStd(imageData: ImageData): Float32Array {
  const d = imageData.data;
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    n += 1;
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  n = n || 1;
  r /= n;
  g /= n;
  b /= n;
  let rs = 0;
  let gs = 0;
  let bs = 0;
  for (let i = 0; i < d.length; i += 4) {
    rs += (d[i] - r) ** 2;
    gs += (d[i + 1] - g) ** 2;
    bs += (d[i + 2] - b) ** 2;
  }
  return new Float32Array([r, g, b, Math.sqrt(rs / n), Math.sqrt(gs / n), Math.sqrt(bs / n)]);
}

function edgeProfileJs(imageData: ImageData): Float32Array {
  const prof = new Float32Array(EDGE_BINS);
  const { width: w, height: h, data } = imageData;
  const step = h / EDGE_BINS;
  for (let b = 0; b < EDGE_BINS; b += 1) {
    const y0 = Math.floor(b * step);
    const y1 = Math.max(y0 + 1, Math.floor((b + 1) * step));
    let acc = 0;
    let count = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = 1; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const j = (y * w + x - 1) * 4;
        const g1 = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
        const g0 = data[j] * 0.3 + data[j + 1] * 0.59 + data[j + 2] * 0.11;
        acc += Math.abs(g1 - g0);
        count += 1;
      }
    }
    prof[b] = count ? acc / count : 0;
  }
  let sum = 0;
  for (let i = 0; i < prof.length; i += 1) {
    sum += prof[i];
  }
  const n = sum || 1;
  for (let i = 0; i < prof.length; i += 1) {
    prof[i] /= n;
  }
  return prof;
}

function extract(imageData: ImageData): Feat {
  const small = resizeImageData(imageData, SIZE, SIZE);
  return {
    hist: hsvHist(small),
    color: meanStd(small),
    edges: edgeProfileJs(small),
  };
}

function correlation(a: Float32Array, b: Float32Array): number {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i += 1) {
    ma += a[i];
    mb += b[i];
  }
  ma /= a.length;
  mb /= b.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db) || 1e-6;
  return num / den;
}

function colorSim(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    d += diff * diff;
  }
  return Math.exp(-Math.sqrt(d) / 80);
}

function visualScore(a: Feat, b: Feat): number {
  const h = Math.max(0, correlation(a.hist, b.hist));
  const c = colorSim(a.color, b.color);
  const e = Math.max(0, correlation(a.edges, b.edges));
  return 0.55 * h + 0.25 * c + 0.2 * e;
}

function toPercent(raw: number): number {
  return Math.max(0, Math.min(99, Math.round(((raw - 0.15) / 0.8) * 100)));
}

async function imageDataFromUrl(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load ${url}`);
  }
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export async function ensureGallery(): Promise<void> {
  if (gallery) {
    return;
  }
  if (!galleryPromise) {
    galleryPromise = (async () => {
      const packed = await Promise.all(
        BRAINROT_CHARACTERS.map(async (character) => {
          try {
            return { character, feat: extract(await imageDataFromUrl(character.image)) };
          } catch (err) {
            console.warn(`Gallery skip ${character.id}`, err);
            return null;
          }
        }),
      );
      const ready = packed.filter((row): row is Packed => row !== null);
      if (ready.length < 4) {
        throw new Error("Character gallery failed to load");
      }
      return ready;
    })();
  }
  gallery = await galleryPromise;
}

export async function matchBrainrot(
  imageData: ImageData,
  detections: Detection[] = [],
): Promise<MatchRow[]> {
  await ensureGallery();
  if (!gallery) {
    throw new Error("Gallery failed to load");
  }
  const query = extract(imageData);
  const labels = new Set(detections.map((d) => d.label));
  const rows: MatchRow[] = gallery.map(({ character, feat }) => {
    let raw = visualScore(query, feat);
    const reasons: string[] = ["color histogram + silhouette"];
    const hits = character.cocoHints.filter((hint) => labels.has(hint));
    if (hits.length) {
      raw = Math.min(0.98, raw + 0.08 * hits.length);
      reasons.push(`scan also saw ${hits.join(", ")}`);
    }
    return {
      character,
      raw,
      percent: toPercent(raw),
      reasons,
    };
  });
  rows.sort((a, b) => b.raw - a.raw);
  return rows;
}
