import { drawDetections, ensureNanoDet, inferNanoDet } from "./nanodet";
import type { Detection, PipelineId } from "./types";

export type { Detection, PipelineId };

export const YUNET_PATH = "/models/yunet";
export const OPENCV_JS_SRC =
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0/dist/opencv.js";

type CvRuntime = {
  Mat: new () => { delete: () => void; cols: number; rows: number; data: Uint8Array };
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  Scalar: new (a: number, b: number, c: number, d?: number) => unknown;
  FaceDetectorYN: new (
    model: string,
    config: string,
    size: unknown,
    score: number,
    nms: number,
    topK: number,
  ) => {
    setInputSize: (size: unknown) => void;
    detect: (src: unknown, faces?: unknown) => unknown;
  };
  matFromImageData: (data: ImageData) => {
    delete: () => void;
    cols: number;
    rows: number;
    data: Uint8Array;
  };
  cvtColor: (src: unknown, dst: unknown, code: number) => void;
  Canny: (src: unknown, dst: unknown, a: number, b: number) => void;
  GaussianBlur: (src: unknown, dst: unknown, ksize: unknown, sigma: number) => void;
  rectangle: (img: unknown, p1: unknown, p2: unknown, color: unknown, thickness: number) => void;
  COLOR_RGBA2GRAY: number;
  COLOR_GRAY2RGBA: number;
  COLOR_RGBA2BGR: number;
  COLOR_BGR2RGBA: number;
  FS: { writeFile: (path: string, data: Uint8Array) => void };
};

declare global {
  interface Window {
    cv?: CvRuntime & { onRuntimeInitialized?: () => void };
  }
}

let loadPromise: Promise<CvRuntime> | null = null;
let detector: InstanceType<CvRuntime["FaceDetectorYN"]> | null = null;

export function loadOpenCv(): Promise<CvRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV.js runs in the browser"));
  }
  if (window.cv && "Mat" in window.cv && window.cv.Mat) {
    return Promise.resolve(window.cv as CvRuntime);
  }
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const cv = window.cv;
      if (!cv) {
        reject(new Error("OpenCV.js loaded without cv"));
        return;
      }
      if (cv.Mat) {
        resolve(cv as CvRuntime);
        return;
      }
      cv.onRuntimeInitialized = () => resolve(window.cv as CvRuntime);
    };
    if (document.querySelector("script[data-opencv-js]")) {
      finish();
      return;
    }
    const script = document.createElement("script");
    script.src = OPENCV_JS_SRC;
    script.async = true;
    script.dataset.opencvJs = "true";
    script.onload = finish;
    script.onerror = () => reject(new Error("Failed to load OpenCV.js"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function ensureYuNet(cv: CvRuntime): Promise<void> {
  if (detector) {
    return;
  }
  const res = await fetch(YUNET_PATH);
  if (!res.ok) {
    throw new Error("Could not download YuNet weights");
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  cv.FS.writeFile("/yunet.onnx", bytes);
  detector = new cv.FaceDetectorYN("/yunet.onnx", "", new cv.Size(320, 320), 0.7, 0.3, 5000);
}

function faceValue(faces: { floatAt?: (i: number, j: number) => number; data32F?: Float32Array; cols: number }, row: number, col: number) {
  if (faces.floatAt) {
    return faces.floatAt(row, col);
  }
  if (faces.data32F) {
    return faces.data32F[row * faces.cols + col];
  }
  return 0;
}

function readFaces(faces: { rows?: number; cols: number; floatAt?: (i: number, j: number) => number; data32F?: Float32Array } | null): Detection[] {
  if (!faces?.rows) {
    return [];
  }
  const detections: Detection[] = [];
  for (let i = 0; i < faces.rows; i += 1) {
    detections.push({
      label: "face",
      score: faceValue(faces, i, 14),
      box: {
        x: faceValue(faces, i, 0),
        y: faceValue(faces, i, 1),
        w: faceValue(faces, i, 2),
        h: faceValue(faces, i, 3),
      },
    });
  }
  return detections;
}

export async function runBrowserPipeline(
  cv: CvRuntime,
  imageData: ImageData,
  pipeline: PipelineId,
): Promise<{ imageData: ImageData; detections: Detection[]; elapsedMs: number; model: string }> {
  const started = performance.now();
  if (pipeline === "objects") {
    await ensureNanoDet();
    const detections = await inferNanoDet(imageData);
    return {
      imageData: drawDetections(imageData, detections),
      detections,
      elapsedMs: performance.now() - started,
      model: "nanodet",
    };
  }
  if (pipeline === "faces") {
    await ensureYuNet(cv);
  }
  const result = processImageData(cv, imageData, pipeline);
  return {
    ...result,
    model: pipeline === "faces" ? "yunet" : "opencv.js",
  };
}

export function processImageData(
  cv: CvRuntime,
  imageData: ImageData,
  pipeline: PipelineId,
): { imageData: ImageData; detections: Detection[]; elapsedMs: number } {
  if (pipeline === "objects") {
    throw new Error("Object detection uses NanoDet in the browser");
  }
  const started = performance.now();
  const src = cv.matFromImageData(imageData);
  const out = new cv.Mat();
  let detections: Detection[] = [];

  try {
    if (pipeline === "grayscale") {
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.cvtColor(gray, out, cv.COLOR_GRAY2RGBA);
      gray.delete();
    } else if (pipeline === "edges") {
      const gray = new cv.Mat();
      const edges = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, 80, 160);
      cv.cvtColor(edges, out, cv.COLOR_GRAY2RGBA);
      gray.delete();
      edges.delete();
    } else if (pipeline === "blur") {
      cv.GaussianBlur(src, out, new cv.Size(21, 21), 0);
    } else {
      if (!detector) {
        throw new Error("YuNet is not loaded");
      }
      const bgr = new cv.Mat();
      cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR);
      detector.setInputSize(new cv.Size(bgr.cols, bgr.rows));
      const facesMat = new cv.Mat();
      const detected = detector.detect(bgr, facesMat) as { rows?: number; cols: number; floatAt?: (i: number, j: number) => number; data32F?: Float32Array; delete?: () => void } | void;
      const faces = detected && typeof detected === "object" && "rows" in detected ? detected : facesMat;
      detections = readFaces(faces as { rows?: number; cols: number; floatAt?: (i: number, j: number) => number; data32F?: Float32Array });
      const color = new cv.Scalar(66, 180, 245, 255);
      for (const det of detections) {
        const x = Math.round(det.box.x);
        const y = Math.round(det.box.y);
        const w = Math.round(det.box.w);
        const h = Math.round(det.box.h);
        cv.rectangle(bgr, new cv.Point(x, y), new cv.Point(x + w, y + h), color, 2);
      }
      cv.cvtColor(bgr, out, cv.COLOR_BGR2RGBA);
      bgr.delete();
      facesMat.delete();
    }

    return {
      imageData: new ImageData(new Uint8ClampedArray(out.data), out.cols, out.rows),
      detections,
      elapsedMs: performance.now() - started,
    };
  } finally {
    src.delete();
    out.delete();
  }
}

export async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
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
