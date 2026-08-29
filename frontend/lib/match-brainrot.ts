import { BRAINROT_CHARACTERS, type BrainrotCharacter } from "./characters";
import { CHARACTER_LOOKS, colorFamily, familyOverlap, type ColorFamily } from "./character-looks";
import { embedLocal, localClipScores, matchWithClip } from "./clip-match";
import {
  chiSquareSim,
  dominantColors,
  phashBits,
  phashSim,
  softmax,
} from "./color-science";
import { idbGet, idbSet } from "./gallery-cache";
import { isolateSubject, pixelZone, type Isolation } from "./isolate";
import { matchWithVision, type VisionMatch } from "./match-vision";
import type { Detection } from "./types";

const SIZE = 160;
const H_BINS = 18;
const S_BINS = 10;
const GRID = 2;
const PROF_BINS = 32;
const GENERIC_HINTS = new Set(["person", "face"]);
const GALLERY_FEAT_URL = "/assets/gallery-feat.json";
const GALLERY_IDB = "gallery-feat-v3";

export type MatchRow = {
  character: BrainrotCharacter;
  raw: number;
  percent: number;
  reasons: string[];
  engine?: "look" | "still" | "vision" | "clip";
};

export type MatchOptions = {
  vision?: boolean;
};

type Feat = {
  hist: Float32Array;
  spatial: Float32Array;
  color: Float32Array;
  hProf: Float32Array;
  vProf: Float32Array;
  edges: Float32Array;
  aspect: number;
  phash: bigint;
};

type Packed = { character: BrainrotCharacter; feat: Feat; embed: number[] };

type StoredFeat = {
  id: string;
  hist: number[];
  spatial: number[];
  color: number[];
  hProf: number[];
  vProf: number[];
  edges: number[];
  aspect: number;
  phash: string;
};

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

function cropImageData(imageData: ImageData, x: number, y: number, w: number, h: number): ImageData {
  const cw = Math.max(8, Math.round(w));
  const ch = Math.max(8, Math.round(h));
  const sx = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const width = Math.min(cw, imageData.width - sx);
  const height = Math.min(ch, imageData.height - sy);
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
  ctx.drawImage(src, sx, sy, width, height, 0, 0, width, height);
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
    h /= 6;
    if (h < 0) {
      h += 1;
    }
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function isNearWhite(r: number, g: number, b: number, sat: number): boolean {
  return r > 232 && g > 232 && b > 232 && sat < 0.14;
}

function cornerMean(imageData: ImageData): [number, number, number] {
  const { width: w, height: h, data } = imageData;
  const s = Math.min(14, Math.floor(w / 6), Math.floor(h / 6)) || 1;
  const patches: Array<[number, number]> = [
    [0, 0],
    [w - s, 0],
    [0, h - s],
    [w - s, h - s],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [x0, y0] of patches) {
    for (let y = y0; y < y0 + s; y += 1) {
      for (let x = x0; x < x0 + s; x += 1) {
        const i = (y * w + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
    }
  }
  n = n || 1;
  return [r / n, g / n, b / n];
}

function foregroundCrop(imageData: ImageData): { image: ImageData; aspect: number } {
  const { width: w, height: h, data } = imageData;
  const [br, bg, bb] = cornerMean(imageData);
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let fg = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [, sat] = rgbToHsv(r, g, b);
      const dist = Math.hypot(r - br, g - bg, b - bb);
      if (!isNearWhite(r, g, b, sat) && (dist > 32 || sat > 0.18)) {
        fg += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (fg < w * h * 0.06 || maxX <= minX || maxY <= minY) {
    return { image: imageData, aspect: w / h };
  }
  const pad = Math.round(0.08 * Math.max(w, h));
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const cw = Math.min(w - x, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - y, maxY - minY + 1 + pad * 2);
  return { image: cropImageData(imageData, x, y, cw, ch), aspect: cw / ch };
}

const DISTINCTIVE_HINTS = new Set(
  BRAINROT_CHARACTERS.flatMap((character) =>
    character.cocoHints.filter((hint) => !GENERIC_HINTS.has(hint)),
  ),
);

function boxArea(box: Detection["box"]): number {
  return Math.max(0, box.w) * Math.max(0, box.h);
}

export function cropToSubject(imageData: ImageData, detections: Detection[] = []): ImageData {
  const area = imageData.width * imageData.height || 1;
  const scored = detections
    .filter((det) => det.score >= 0.32 && boxArea(det.box) / area >= 0.05)
    .sort((a, b) => boxArea(b.box) * b.score - boxArea(a.box) * a.score);
  const distinctive = scored.filter((det) => DISTINCTIVE_HINTS.has(det.label));
  const people = scored.filter((det) => det.label === "person");
  const pick = distinctive[0] ?? (people[0] && boxArea(people[0].box) / area >= 0.18 ? people[0] : null);
  if (!pick) {
    return foregroundCrop(imageData).image;
  }
  const pad = 0.18;
  const x = pick.box.x - pick.box.w * pad;
  const y = pick.box.y - pick.box.h * pad;
  const w = pick.box.w * (1 + pad * 2);
  const h = pick.box.h * (1 + pad * 2);
  return cropImageData(imageData, x, y, w, h);
}

function extract(imageData: ImageData): Feat {
  const { image: subject, aspect } = foregroundCrop(imageData);
  const small = resizeImageData(subject, SIZE, SIZE);
  const { data } = small;
  const hist = new Float32Array(H_BINS * S_BINS);
  const spatial = new Float32Array(GRID * GRID * H_BINS * S_BINS);
  const hProf = new Float32Array(PROF_BINS);
  const vProf = new Float32Array(PROF_BINS);
  const edges = new Float32Array(PROF_BINS);
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let hh = 0;
  let ss = 0;
  let vv = 0;
  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];
    const [h, s, v] = rgbToHsv(pr, pg, pb);
    if (data[i + 3] < 16 || isNearWhite(pr, pg, pb, s)) {
      continue;
    }
    const px = (i / 4) % SIZE;
    const py = Math.floor(i / 4 / SIZE);
    const hi = Math.min(H_BINS - 1, Math.floor(h * H_BINS));
    const si = Math.min(S_BINS - 1, Math.floor(s * S_BINS));
    hist[hi * S_BINS + si] += 1;
    const gx = px < SIZE / 2 ? 0 : 1;
    const gy = py < SIZE / 2 ? 0 : 1;
    spatial[((gy * GRID + gx) * H_BINS + hi) * S_BINS + si] += 1;
    r += pr;
    g += pg;
    b += pb;
    hh += h;
    ss += s;
    vv += v;
    hProf[Math.min(PROF_BINS - 1, Math.floor((py / SIZE) * PROF_BINS))] += 1;
    vProf[Math.min(PROF_BINS - 1, Math.floor((px / SIZE) * PROF_BINS))] += 1;
    n += 1;
  }
  n = n || 1;
  r /= n;
  g /= n;
  b /= n;
  let rs = 0;
  let gs = 0;
  let bs = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [, s] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (data[i + 3] < 16 || isNearWhite(data[i], data[i + 1], data[i + 2], s)) {
      continue;
    }
    rs += (data[i] - r) ** 2;
    gs += (data[i + 1] - g) ** 2;
    bs += (data[i + 2] - b) ** 2;
  }
  normalize(hist);
  normalize(spatial);
  normalize(hProf);
  normalize(vProf);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 1; x < SIZE; x += 1) {
      const i = (y * SIZE + x) * 4;
      const j = i - 4;
      const g1 = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      const g0 = data[j] * 0.3 + data[j + 1] * 0.59 + data[j + 2] * 0.11;
      edges[Math.min(PROF_BINS - 1, Math.floor((y / SIZE) * PROF_BINS))] += Math.abs(g1 - g0);
    }
  }
  normalize(edges);
  return {
    hist,
    spatial,
    color: new Float32Array([
      r,
      g,
      b,
      Math.sqrt(rs / n),
      Math.sqrt(gs / n),
      Math.sqrt(bs / n),
      hh / n,
      ss / n,
      vv / n,
    ]),
    hProf,
    vProf,
    edges,
    aspect,
    phash: phashBits(small),
  };
}

function normalize(vec: Float32Array) {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) {
    sum += vec[i];
  }
  const n = sum || 1;
  for (let i = 0; i < vec.length; i += 1) {
    vec[i] /= n;
  }
}

function intersection(a: Float32Array, b: Float32Array): number {
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) {
    acc += Math.min(a[i], b[i]);
  }
  return acc;
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
  const den = Math.sqrt(da * db);
  if (den < 1e-8) {
    return intersection(a, b);
  }
  return num / den;
}

function colorSim(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 0; i < 6; i += 1) {
    const diff = a[i] - b[i];
    d += diff * diff;
  }
  return Math.exp(-Math.sqrt(d) / 70);
}

function visualScore(a: Feat, b: Feat): number {
  const h = Math.max(0, 0.5 * intersection(a.hist, b.hist) + 0.5 * correlation(a.hist, b.hist));
  const s = Math.max(0, intersection(a.spatial, b.spatial));
  const c = colorSim(a.color, b.color);
  const sil =
    0.5 * Math.max(0, intersection(a.hProf, b.hProf)) + 0.5 * Math.max(0, intersection(a.vProf, b.vProf));
  const e = Math.max(0, correlation(a.edges, b.edges));
  const asp = 1 - Math.min(1, Math.abs(a.aspect - b.aspect) / 1.4);
  return 0.28 * h + 0.22 * s + 0.18 * c + 0.18 * sil + 0.1 * e + 0.04 * asp;
}

function stillScore(a: Feat, b: Feat, hint: number): number {
  const lab = chiSquareSim(a.hist, b.hist);
  const sil =
    0.5 * Math.max(0, intersection(a.hProf, b.hProf)) + 0.5 * Math.max(0, intersection(a.vProf, b.vProf));
  const hash = phashSim(a.phash, b.phash);
  return Math.min(0.99, 0.4 * hash + 0.25 * lab + 0.2 * sil + 0.15 * hint);
}

function hintBoost(character: BrainrotCharacter, detections: Detection[], frameArea: number): { boost: number; labels: string[] } {
  let best = 0;
  const labels: string[] = [];
  for (const hint of character.cocoHints) {
    if (GENERIC_HINTS.has(hint)) {
      continue;
    }
    for (const det of detections) {
      if (det.label !== hint || det.score < 0.32) {
        continue;
      }
      const frac = boxArea(det.box) / (frameArea || 1);
      if (frac < 0.04 && det.score < 0.5) {
        continue;
      }
      const gain = 0.04 + 0.1 * det.score * Math.min(1, frac / 0.25);
      if (gain > best) {
        best = gain;
      }
      if (!labels.includes(hint)) {
        labels.push(hint);
      }
    }
  }
  return { boost: Math.min(0.14, best), labels };
}

function isSkin(h: number, s: number, v: number): boolean {
  if (v < 0.16 || v > 0.97 || s < 0.07 || s > 0.68) {
    return false;
  }
  const deg = h * 360;
  return deg <= 52 || deg >= 345;
}

type QueryLook = {
  person: boolean;
  hues: number[];
  clothes: ColorFamily[];
  hair: ColorFamily[];
  energy: number;
  coverage: number;
};

function topFamilies(counts: Partial<Record<ColorFamily, number>>, limit = 3): ColorFamily[] {
  return (Object.entries(counts) as Array<[ColorFamily, number]>)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([family]) => family);
}

function queryLook(imageData: ImageData, isolation: Isolation): QueryLook {
  const { data, width, height } = imageData;
  const clothes: Partial<Record<ColorFamily, number>> = {};
  const hair: Partial<Record<ColorFamily, number>> = {};
  const buckets = new Float32Array(18);
  let kept = 0;
  let sat = 0;
  let colorful = 0;
  const step = Math.max(4, Math.floor((width * height) / 5000) * 4);
  for (let i = 0; i < data.length; i += step) {
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (data[i + 3] < 16) {
      continue;
    }
    const zone = pixelZone(i / 4, width, isolation);
    if (zone === "bg" || zone === "face") {
      continue;
    }
    if (isSkin(h, s, v) && zone !== "hair") {
      continue;
    }
    kept += 1;
    const family = colorFamily(h, s, v);
    const weight = 0.35 + s;
    if (zone === "hair" && family) {
      hair[family] = (hair[family] ?? 0) + weight;
    }
    if ((zone === "clothes" || zone === "legs") && family) {
      clothes[family] = (clothes[family] ?? 0) + weight * (zone === "legs" ? 0.85 : 1);
    }
    if (s < 0.12 || v < 0.12) {
      continue;
    }
    buckets[Math.min(17, Math.floor(h * 18))] += s;
    sat += s;
    colorful += 1;
  }
  const fromKmeans = dominantColors(imageData, 3, (index) => {
    const zone = pixelZone(index, width, isolation);
    return zone === "clothes" || zone === "legs";
  });
  for (const swatch of fromKmeans) {
    const [h, s, v] = rgbToHsv(swatch.r, swatch.g, swatch.b);
    if (isSkin(h, s, v)) {
      continue;
    }
    const family = colorFamily(h, s, v);
    if (family) {
      clothes[family] = (clothes[family] ?? 0) + swatch.weight * 2.2;
    }
  }
  const ranked = Array.from(buckets)
    .map((weight, index) => ({ hue: (index + 0.5) * 20, weight }))
    .filter((row) => row.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((row) => row.hue);
  return {
    person: isolation.person,
    hues: ranked,
    clothes: topFamilies(clothes),
    hair: topFamilies(hair, 2),
    energy: colorful ? sat / colorful : 0.4,
    coverage: isolation.coverage,
  };
}

function lookScore(query: QueryLook, character: BrainrotCharacter): { score: number; why: string[] } {
  const look = CHARACTER_LOOKS[character.id];
  if (!look) {
    return { score: 0.2, why: [] };
  }
  const clothes = familyOverlap(query.clothes, look.families);
  const hair = familyOverlap(query.hair, look.hair.length ? look.hair : look.families);
  const energy = 1 - Math.min(1, Math.abs(query.energy - look.sat));
  const dominant = query.clothes[0];
  const mismatch =
    dominant && !look.families.includes(dominant) && !["brown", "gray", "black"].includes(dominant) ? 0.22 : 0;
  const zone = clothes;
  const score = Math.max(
    0.04,
    Math.min(0.98, 0.7 * clothes + 0.15 * zone + 0.1 * energy + 0.05 * hair - mismatch),
  );
  const why: string[] = [];
  if (clothes >= 0.7 && dominant) {
    why.push(`${dominant} clothes match ${character.name}`);
  } else if (clothes >= 0.4) {
    why.push(`closest costume vibe: ${look.vibe}`);
  }
  if (hair >= 0.7 && query.hair[0]) {
    why.push(`${query.hair[0]} crown/top fits the look`);
  }
  return { score, why };
}

function toPercent(prob: number, raw: number, best: number, second: number, isWinner: boolean): number {
  const abs = Math.max(0, Math.min(1, (raw - 0.16) / 0.82));
  const gap = best - second;
  let pct = 100 * (0.42 * abs + 0.58 * prob);
  if (isWinner) {
    pct = Math.min(94, pct + 5 * Math.min(1, gap / 0.12) * abs);
  } else {
    pct = Math.min(pct, 100 * prob * 0.92);
  }
  return Math.max(0, Math.min(94, Math.round(pct)));
}

function downscaleForMatch(imageData: ImageData, maxEdge = 384): ImageData {
  const scale = Math.min(1, maxEdge / imageData.width, maxEdge / imageData.height);
  if (scale >= 0.999) {
    return imageData;
  }
  return resizeImageData(
    imageData,
    Math.max(8, Math.round(imageData.width * scale)),
    Math.max(8, Math.round(imageData.height * scale)),
  );
}

async function imageDataFromUrl(url: string): Promise<ImageData> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, cache: "force-cache" });
  } finally {
    window.clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`Could not load ${url}`);
  }
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const maxEdge = 384;
  const scale = Math.min(1, maxEdge / bitmap.width, maxEdge / bitmap.height);
  const width = Math.max(8, Math.round(bitmap.width * scale));
  const height = Math.max(8, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function featFromStored(row: StoredFeat): Feat {
  return {
    hist: Float32Array.from(row.hist),
    spatial: Float32Array.from(row.spatial),
    color: Float32Array.from(row.color),
    hProf: Float32Array.from(row.hProf),
    vProf: Float32Array.from(row.vProf),
    edges: Float32Array.from(row.edges),
    aspect: row.aspect,
    phash: BigInt(row.phash),
  };
}

function storeFeat(id: string, feat: Feat): StoredFeat {
  return {
    id,
    hist: Array.from(feat.hist),
    spatial: Array.from(feat.spatial),
    color: Array.from(feat.color),
    hProf: Array.from(feat.hProf),
    vProf: Array.from(feat.vProf),
    edges: Array.from(feat.edges),
    aspect: feat.aspect,
    phash: feat.phash.toString(),
  };
}

function packOf(character: BrainrotCharacter, feat: Feat): Packed {
  const colorScale = feat.color.map((v, i) => (i < 6 ? v / 255 : v));
  return {
    character,
    feat,
    embed: embedLocal([feat.hist, feat.spatial, colorScale, feat.hProf, feat.vProf, feat.edges]),
  };
}

async function loadStoredGallery(rows: StoredFeat[]): Promise<Packed[]> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const packed: Packed[] = [];
  for (const character of BRAINROT_CHARACTERS) {
    const stored = byId.get(character.id);
    if (!stored) {
      continue;
    }
    packed.push(packOf(character, featFromStored(stored)));
  }
  return packed;
}

export async function ensureGallery(): Promise<void> {
  if (gallery) {
    return;
  }
  if (!galleryPromise) {
    galleryPromise = (async () => {
      const cached = await idbGet<StoredFeat[]>(GALLERY_IDB);
      if (cached && cached.length >= 12) {
        const packed = await loadStoredGallery(cached);
        if (packed.length >= 12) {
          return packed;
        }
      }
      try {
        const res = await fetch(GALLERY_FEAT_URL, { cache: "force-cache" });
        if (res.ok) {
          const body = (await res.json()) as { items?: StoredFeat[] };
          if (body.items && body.items.length >= 12) {
            const packed = await loadStoredGallery(body.items);
            if (packed.length >= 12) {
              await idbSet(GALLERY_IDB, body.items);
              return packed;
            }
          }
        }
      } catch {
        /* extract from stills */
      }
      const extracted = await Promise.all(
        BRAINROT_CHARACTERS.map(async (character) => {
          try {
            return packOf(character, extract(await imageDataFromUrl(character.image)));
          } catch (err) {
            console.warn(`Gallery skip ${character.id}`, err);
            return null;
          }
        }),
      );
      const ready = extracted.filter((row): row is Packed => row !== null);
      if (ready.length < 4) {
        throw new Error("Character gallery failed to load");
      }
      await idbSet(
        GALLERY_IDB,
        ready.map((row) => storeFeat(row.character.id, row.feat)),
      );
      return ready;
    })().catch((err: unknown) => {
      galleryPromise = null;
      throw err;
    });
  }
  gallery = await galleryPromise;
}

function applyVision(rows: MatchRow[], vision: VisionMatch, personMode: boolean): MatchRow[] {
  const byId = new Map(vision.matches.map((row) => [row.id, row]));
  const weight = personMode || vision.subject === "person" ? 0.82 : 0.28;
  const next = rows.map((row) => {
    const hit = byId.get(row.character.id);
    if (!hit) {
      return row;
    }
    const percent = Math.max(1, Math.min(94, Math.round((1 - weight) * row.percent + weight * hit.percent)));
    const reasons = hit.reason
      ? [hit.reason, ...row.reasons.filter((reason) => !reason.startsWith("weak vibe"))]
      : row.reasons;
    return { ...row, percent, reasons, engine: "vision" as const, raw: Math.max(row.raw, hit.percent / 100) };
  });
  next.sort((a, b) => b.percent - a.percent || b.raw - a.raw);
  return next;
}

function finishPercents(rows: MatchRow[]): MatchRow[] {
  rows.sort((a, b) => b.raw - a.raw);
  const best = rows[0]?.raw ?? 0;
  const second = rows[1]?.raw ?? 0;
  const gap = best - second;
  const probs = softmax(
    rows.map((row) => row.raw),
    0.16,
  );
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    row.percent = toPercent(probs[i], row.raw, best, second, i === 0);
    if (i === 0) {
      if (gap < 0.045) {
        row.reasons.unshift("Closest vibe — not a strong lock");
      } else if (gap >= 0.12 && row.percent >= 70) {
        row.reasons.unshift("strong unique look");
      } else if (gap >= 0.05) {
        row.reasons.unshift(row.engine === "still" ? "closest character still" : "closest look in the roster");
      } else {
        row.reasons.unshift("weak vibe — closest of 17");
      }
    }
  }
  return rows;
}

export async function matchBrainrot(
  imageData: ImageData,
  detections: Detection[] = [],
  options: MatchOptions = {},
): Promise<MatchRow[]> {
  await ensureGallery();
  if (!gallery) {
    throw new Error("Gallery failed to load");
  }
  const scaled = downscaleForMatch(imageData);
  const subject = cropToSubject(scaled, detections);
  const isolation = await isolateSubject(subject, detections);
  const look = queryLook(subject, isolation);
  const query = extract(subject);
  const queryEmbed = embedLocal([
    query.hist,
    query.spatial,
    query.color.map((v, i) => (i < 6 ? v / 255 : v)),
    query.hProf,
    query.vProf,
    query.edges,
  ]);
  const frameArea = imageData.width * imageData.height;
  const bestVisualAlone = Math.max(...gallery.map(({ feat }) => visualScore(query, feat)));
  const personMode = isolation.person && isolation.coverage >= 0.08;
  const stillMode = !personMode || bestVisualAlone >= 0.7;
  const localClip = localClipScores(
    queryEmbed,
    gallery.map((row) => ({ id: row.character.id, vec: row.embed })),
  );
  const clipById = new Map(localClip.map((row) => [row.id, row.score]));
  const rows: MatchRow[] = gallery.map(({ character, feat }) => {
    const visual = visualScore(query, feat);
    const lookHit = lookScore(look, character);
    const { boost, labels } = hintBoost(character, detections, frameArea);
    const hint = boost > 0 ? Math.min(1, boost / 0.14) : 0;
    const still = stillScore(query, feat, hint);
    const mix = stillMode
      ? still
      : 0.7 * lookHit.score + 0.15 * familyOverlap(look.clothes, CHARACTER_LOOKS[character.id]?.families ?? []) + 0.1 * lookHit.score + 0.05 * visual;
    const clip = clipById.get(character.id) ?? 0.5;
    const blended = stillMode ? 0.8 * mix + 0.2 * clip : 0.55 * mix + 0.45 * clip;
    const raw = Math.min(0.99, blended + (stillMode ? 0 : boost > 0 ? boost * 0.35 : 0));
    const reasons: string[] = stillMode
      ? ["matched character colors + silhouette"]
      : lookHit.why.length
        ? lookHit.why
        : ["closest costume vibe after ignoring skin and face"];
    if (boost > 0) {
      reasons.push(`scan locked onto ${labels.join(", ")}`);
    }
    if (!stillMode && isolation.coverage >= 0.12) {
      reasons.push("sampled torso / crown / legs, not the whole frame");
    }
    return {
      character,
      raw,
      percent: 0,
      reasons,
      engine: stillMode ? "still" : "look",
    };
  });

  const remoteClip = await Promise.race([
    matchWithClip(subject),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 1800);
    }),
  ]);
  if (remoteClip?.length) {
    const weight = stillMode ? 0.22 : 0.45;
    const byId = new Map(remoteClip.map((row) => [row.id, row.score]));
    for (const row of rows) {
      const hit = byId.get(row.character.id);
      if (hit == null) {
        continue;
      }
      row.raw = Math.min(0.99, (1 - weight) * row.raw + weight * hit);
      row.engine = "clip";
      if (!row.reasons.some((reason) => reason.includes("on-device CLIP"))) {
        row.reasons.push("on-device CLIP agreed");
      }
    }
  }

  const finished = finishPercents(rows);
  if (options.vision) {
    const vision = await matchWithVision(scaled);
    if (vision) {
      return applyVision(finished, vision, personMode || vision.subject === "person");
    }
  }
  return finished;
}

export async function rerankWithVision(imageData: ImageData, rows: MatchRow[]): Promise<MatchRow[]> {
  const vision = await matchWithVision(downscaleForMatch(imageData));
  if (!vision) {
    throw new Error("AI rerank is unavailable right now");
  }
  return applyVision(rows, vision, vision.subject === "person");
}
