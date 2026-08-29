import { imageDataToUrl } from "./opencv-browser";

export type VisionMatch = {
  subject: "person" | "character" | "other";
  matches: Array<{ id: string; percent: number; reason: string }>;
};

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

function jpegForVision(imageData: ImageData): string {
  const maxEdge = 512;
  const scale = Math.min(1, maxEdge / imageData.width, maxEdge / imageData.height);
  if (scale >= 0.999) {
    const url = imageDataToUrl(imageData);
    const comma = url.indexOf(",");
    return comma >= 0 ? url.slice(comma + 1) : url;
  }
  const width = Math.max(8, Math.round(imageData.width * scale));
  const height = Math.max(8, Math.round(imageData.height * scale));
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
  const url = dst.toDataURL("image/jpeg", 0.72);
  const comma = url.indexOf(",");
  return comma >= 0 ? url.slice(comma + 1) : url;
}

export async function matchWithVision(imageData: ImageData): Promise<VisionMatch | null> {
  try {
    const base64 = jpegForVision(imageData);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 14000);
    const res = await Promise.race([
      fetch("/models/vision-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: base64 }),
        signal: ctrl.signal,
      }),
      timeout(14000, null),
    ]);
    window.clearTimeout(timer);
    if (!res || !res.ok) {
      return null;
    }
    const body = (await res.json()) as VisionMatch;
    if (!body?.matches?.length) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}
