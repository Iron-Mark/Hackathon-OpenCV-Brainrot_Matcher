import { COCO_CLASSES } from "./coco";
import { cachedArrayBuffer } from "./gallery-cache";
import type { Detection } from "./types";

export const NANODET_PATH = "/models/nanodet";
export const ORT_SRC = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.1/dist/ort.min.js";
export const ORT_WASM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.1/dist/";

const INPUT = 416;
const STRIDES = [8, 16, 32] as const;
const REG_MAX = 7;
const SCORE_TH = 0.28;
const IOU_TH = 0.6;
const NMS_PRE = 1000;
const MEAN = [103.53, 116.28, 123.675];
const STD = [57.375, 57.12, 58.395];

type OrtTensor = { data: Float32Array; dims: number[] };

type OrtSession = {
  inputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>;
};

type OrtRuntime = {
  env: { wasm: { wasmPaths: string; numThreads: number; simd: boolean } };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  InferenceSession: {
    create: (data: ArrayBuffer, opts?: { executionProviders?: string[] }) => Promise<OrtSession>;
  };
};

declare global {
  interface Window {
    ort?: OrtRuntime;
  }
}

const anchors = STRIDES.map((stride) => {
  const size = Math.trunc(INPUT / stride);
  const points = new Float32Array(size * size * 2);
  let k = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      points[k] = x * stride + 0.5 * (stride - 1);
      points[k + 1] = y * stride + 0.5 * (stride - 1);
      k += 2;
    }
  }
  return points;
});

let loadPromise: Promise<OrtRuntime> | null = null;
let session: OrtSession | null = null;
let tensorCtor: OrtRuntime["Tensor"] | null = null;

function loadOrt(): Promise<OrtRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("NanoDet runs in the browser"));
  }
  if (window.ort?.InferenceSession) {
    return Promise.resolve(window.ort);
  }
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const ort = window.ort;
      if (!ort?.InferenceSession) {
        reject(new Error("onnxruntime-web loaded without ort"));
        return;
      }
      ort.env.wasm.wasmPaths = ORT_WASM;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
      resolve(ort);
    };
    if (document.querySelector("script[data-ort]")) {
      finish();
      return;
    }
    const script = document.createElement("script");
    script.src = ORT_SRC;
    script.async = true;
    script.dataset.ort = "true";
    script.onload = finish;
    script.onerror = () => reject(new Error("Failed to load onnxruntime-web"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function ensureNanoDet(): Promise<void> {
  if (session) {
    return;
  }
  const ort = await loadOrt();
  const bytes = await cachedArrayBuffer(NANODET_PATH);
  session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  tensorCtor = ort.Tensor;
}

function letterboxGeometry(height: number, width: number) {
  let top = 0;
  let left = 0;
  let newh = INPUT;
  let neww = INPUT;
  if (height !== width) {
    const hw = height / width;
    if (hw > 1) {
      neww = Math.trunc(INPUT / hw);
      left = Math.trunc((INPUT - neww) * 0.5);
    } else {
      newh = Math.trunc(INPUT * hw);
      top = Math.trunc((INPUT - newh) * 0.5);
    }
  }
  return { top, left, newh, neww };
}

function toBlob(imageData: ImageData): { blob: Float32Array; geom: ReturnType<typeof letterboxGeometry> } {
  const geom = letterboxGeometry(imageData.height, imageData.width);
  const canvas = document.createElement("canvas");
  canvas.width = INPUT;
  canvas.height = INPUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, INPUT, INPUT);
  const src = document.createElement("canvas");
  src.width = imageData.width;
  src.height = imageData.height;
  src.getContext("2d")?.putImageData(imageData, 0, 0);
  ctx.drawImage(src, 0, 0, imageData.width, imageData.height, geom.left, geom.top, geom.neww, geom.newh);
  const pixels = ctx.getImageData(0, 0, INPUT, INPUT).data;
  const plane = INPUT * INPUT;
  const blob = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    blob[i] = (r - MEAN[0]) / STD[0];
    blob[plane + i] = (g - MEAN[1]) / STD[1];
    blob[2 * plane + i] = (b - MEAN[2]) / STD[2];
  }
  return { blob, geom };
}

function dflDistance(bbox: Float32Array, count: number, stride: number): Float32Array {
  const dist = new Float32Array(count * 4);
  const bins = REG_MAX + 1;
  for (let i = 0; i < count; i += 1) {
    for (let k = 0; k < 4; k += 1) {
      const off = i * 4 * bins + k * bins;
      let max = -Infinity;
      for (let r = 0; r < bins; r += 1) {
        max = Math.max(max, bbox[off + r]);
      }
      let sum = 0;
      const exp = new Float32Array(bins);
      for (let r = 0; r < bins; r += 1) {
        const v = Math.exp(bbox[off + r] - max);
        exp[r] = v;
        sum += v;
      }
      let acc = 0;
      for (let r = 0; r < bins; r += 1) {
        acc += (exp[r] / sum) * r;
      }
      dist[i * 4 + k] = acc * stride;
    }
  }
  return dist;
}

function iou(a: Detection, b: Detection): number {
  const ax2 = a.box.x + a.box.w;
  const ay2 = a.box.y + a.box.h;
  const bx2 = b.box.x + b.box.w;
  const by2 = b.box.y + b.box.h;
  const x1 = Math.max(a.box.x, b.box.x);
  const y1 = Math.max(a.box.y, b.box.y);
  const x2 = Math.min(ax2, bx2);
  const y2 = Math.min(ay2, by2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.box.w * a.box.h + b.box.w * b.box.h - inter;
  return union <= 0 ? 0 : inter / union;
}

function nms(items: Detection[]): Detection[] {
  const sorted = items.filter((item) => item.score >= SCORE_TH).sort((a, b) => b.score - a.score);
  const keep: Detection[] = [];
  for (const cand of sorted) {
    if (keep.every((item) => iou(item, cand) <= IOU_TH)) {
      keep.push(cand);
    }
  }
  return keep;
}

function unletterbox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  origH: number,
  origW: number,
  geom: ReturnType<typeof letterboxGeometry>,
): Detection["box"] {
  if (origH === origW) {
    const ratio = origH / geom.newh;
    return { x: x1 * ratio, y: y1 * ratio, w: (x2 - x1) * ratio, h: (y2 - y1) * ratio };
  }
  const ratioh = origH / geom.newh;
  const ratiow = origW / geom.neww;
  const bx1 = Math.max((x1 - geom.left) * ratiow, 0);
  const by1 = Math.max((y1 - geom.top) * ratioh, 0);
  const bx2 = Math.min((x2 - geom.left) * ratiow, origW);
  const by2 = Math.min((y2 - geom.top) * ratioh, origH);
  return { x: bx1, y: by1, w: bx2 - bx1, h: by2 - by1 };
}

function decodeLevel(
  cls: Float32Array,
  bbox: Float32Array,
  count: number,
  strideIndex: number,
  origH: number,
  origW: number,
  geom: ReturnType<typeof letterboxGeometry>,
): Detection[] {
  const stride = STRIDES[strideIndex];
  const points = anchors[strideIndex];
  let clsData = cls;
  let bboxData = bbox;
  let used = count;
  if (count > NMS_PRE) {
    const maxScores = new Float32Array(count);
    const order = new Array<number>(count);
    for (let i = 0; i < count; i += 1) {
      order[i] = i;
      let best = -Infinity;
      for (let c = 0; c < 80; c += 1) {
        best = Math.max(best, cls[i * 80 + c]);
      }
      maxScores[i] = best;
    }
    order.sort((a, b) => maxScores[b] - maxScores[a]);
    used = NMS_PRE;
    clsData = new Float32Array(used * 80);
    bboxData = new Float32Array(used * 32);
    const keptPoints = new Float32Array(used * 2);
    for (let i = 0; i < used; i += 1) {
      const src = order[i];
      clsData.set(cls.subarray(src * 80, src * 80 + 80), i * 80);
      bboxData.set(bbox.subarray(src * 32, src * 32 + 32), i * 32);
      keptPoints[i * 2] = points[src * 2];
      keptPoints[i * 2 + 1] = points[src * 2 + 1];
    }
    const dist = dflDistance(bboxData, used, stride);
    return packDetections(clsData, dist, keptPoints, used, origH, origW, geom);
  }
  const dist = dflDistance(bboxData, used, stride);
  return packDetections(clsData, dist, points, used, origH, origW, geom);
}

function packDetections(
  cls: Float32Array,
  dist: Float32Array,
  points: Float32Array,
  count: number,
  origH: number,
  origW: number,
  geom: ReturnType<typeof letterboxGeometry>,
): Detection[] {
  const out: Detection[] = [];
  for (let i = 0; i < count; i += 1) {
    let best = -Infinity;
    let clsId = 0;
    for (let c = 0; c < 80; c += 1) {
      const score = cls[i * 80 + c];
      if (score > best) {
        best = score;
        clsId = c;
      }
    }
    if (best < SCORE_TH) {
      continue;
    }
    const cx = points[i * 2];
    const cy = points[i * 2 + 1];
    const x1 = Math.min(INPUT, Math.max(0, cx - dist[i * 4]));
    const y1 = Math.min(INPUT, Math.max(0, cy - dist[i * 4 + 1]));
    const x2 = Math.min(INPUT, Math.max(0, cx + dist[i * 4 + 2]));
    const y2 = Math.min(INPUT, Math.max(0, cy + dist[i * 4 + 3]));
    out.push({
      label: COCO_CLASSES[clsId] ?? String(clsId),
      score: best,
      box: unletterbox(x1, y1, x2, y2, origH, origW, geom),
    });
  }
  return out;
}

export async function inferNanoDet(imageData: ImageData): Promise<Detection[]> {
  if (!session || !tensorCtor) {
    throw new Error("NanoDet is not loaded");
  }
  const { blob, geom } = toBlob(imageData);
  const tensor = new tensorCtor("float32", blob, [1, 3, INPUT, INPUT]);
  const results = await session.run({ [session.inputNames[0]]: tensor });
  const tensors = Object.values(results);
  const clsTensors = tensors
    .filter((t) => t.dims[t.dims.length - 1] === 80)
    .sort((a, b) => b.dims[1] - a.dims[1]);
  const bboxTensors = tensors
    .filter((t) => t.dims[t.dims.length - 1] === 32)
    .sort((a, b) => b.dims[1] - a.dims[1]);
  const detections: Detection[] = [];
  for (let i = 0; i < STRIDES.length; i += 1) {
    const cls = clsTensors[i];
    const bbox = bboxTensors[i];
    if (!cls || !bbox) {
      continue;
    }
    detections.push(
      ...decodeLevel(
        cls.data,
        bbox.data,
        cls.dims[1],
        i,
        imageData.height,
        imageData.width,
        geom,
      ),
    );
  }
  return nms(detections);
}

export function drawDetections(imageData: ImageData, detections: Detection[]): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }
  ctx.putImageData(imageData, 0, 0);
  ctx.lineWidth = 2;
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  for (const det of detections) {
    const x = Math.round(det.box.x);
    const y = Math.round(det.box.y);
    const w = Math.round(det.box.w);
    const h = Math.round(det.box.h);
    ctx.strokeStyle = "#c8f542";
    ctx.strokeRect(x, y, w, h);
    const label = `${det.label} ${det.score.toFixed(2)}`;
    const pad = 4;
    const tw = ctx.measureText(label).width;
    const ty = Math.max(14, y - 4);
    ctx.fillStyle = "#c8f542";
    ctx.fillRect(x, ty - 12, tw + pad * 2, 16);
    ctx.fillStyle = "#0c0d10";
    ctx.fillText(label, x + pad, ty);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
