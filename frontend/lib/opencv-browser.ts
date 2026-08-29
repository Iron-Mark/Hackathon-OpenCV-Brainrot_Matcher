import type { Detection, PipelineId } from "./types";

export type { Detection, PipelineId };

export const YUNET_PATH = "/models/yunet";
export const OPENCV_JS_SRC =
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";

const MAX_STILL = 640;

let worker: Worker | null = null;
let ready = false;
let loadPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<
  number,
  {
    resolve: (value: { imageData: ImageData; detections: Detection[]; elapsedMs: number; model: string }) => void;
    reject: (err: Error) => void;
  }
>();

function onWorkerMessage(event: MessageEvent) {
  const msg = event.data || {};
  if (msg.type === "ready") {
    ready = true;
    return;
  }
  const wait = pending.get(msg.id);
  if (!wait) {
    return;
  }
  pending.delete(msg.id);
  if (msg.type === "error") {
    wait.reject(new Error(msg.message || "OpenCV worker failed"));
    return;
  }
  const data = new Uint8ClampedArray(msg.buffer);
  wait.resolve({
    imageData: new ImageData(data, msg.width, msg.height),
    detections: msg.detections ?? [],
    elapsedMs: msg.elapsedMs ?? 0,
    model: msg.model ?? "opencv.js",
  });
}

export function isOpenCvReady(): boolean {
  return ready;
}

/** Compile OpenCV.js in a worker. Does not block the UI thread. */
export function preloadOpenCv(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV.js runs in the browser"));
  }
  if (ready) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = new Promise((resolve, reject) => {
    try {
      worker = new Worker("/opencv-worker.js");
      worker.onmessage = (event) => {
        if (event.data?.type === "ready") {
          ready = true;
          resolve();
        }
        onWorkerMessage(event);
      };
      worker.onerror = () => {
        loadPromise = null;
        worker = null;
        reject(new Error("Failed to load OpenCV worker"));
      };
      worker.postMessage({ type: "init" });
    } catch (err) {
      loadPromise = null;
      reject(err instanceof Error ? err : new Error("Failed to start OpenCV worker"));
    }
  });
  return loadPromise;
}

export async function runBrowserPipeline(
  imageData: ImageData,
  pipeline: PipelineId,
): Promise<{ imageData: ImageData; detections: Detection[]; elapsedMs: number; model: string }> {
  if (pipeline === "objects") {
    return { imageData, detections: [], elapsedMs: 0, model: "skip" };
  }
  await preloadOpenCv();
  if (!worker) {
    throw new Error("OpenCV worker is not available");
  }
  const id = nextId;
  nextId += 1;
  const copy = new Uint8ClampedArray(imageData.data);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker?.postMessage(
      {
        id,
        type: "process",
        pipeline,
        width: imageData.width,
        height: imageData.height,
        buffer: copy.buffer,
      },
      [copy.buffer],
    );
  });
}

function drawScaled(bitmap: ImageBitmap, maxEdge: number): ImageData {
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

export async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  return drawScaled(bitmap, MAX_STILL);
}

export function imageDataToUrl(imageData: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function drawToCanvas(canvas: HTMLCanvasElement, imageData: ImageData) {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d")?.putImageData(imageData, 0, 0);
}
