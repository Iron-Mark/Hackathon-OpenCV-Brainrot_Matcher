import { ensureNanoDet, inferNanoDet } from "./nanodet";
import { isOpenCvReady, runBrowserPipeline } from "./opencv-browser";
import type { Detection } from "./types";

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

export async function detectForMatch(imageData: ImageData): Promise<Detection[]> {
  const objects = await Promise.race([
    ensureNanoDet()
      .then(() => inferNanoDet(imageData))
      .catch(() => [] as Detection[]),
    timeout(5000, [] as Detection[]),
  ]);
  let faces: Detection[] = [];
  if (isOpenCvReady()) {
    faces = await Promise.race([
      runBrowserPipeline(imageData, "faces")
        .then((row) => row.detections)
        .catch(() => [] as Detection[]),
      timeout(2500, [] as Detection[]),
    ]);
  }
  return [...objects, ...faces];
}

export async function detectObjectsOverlay(imageData: ImageData): Promise<Detection[]> {
  try {
    await ensureNanoDet();
    return await inferNanoDet(imageData);
  } catch {
    return [];
  }
}
