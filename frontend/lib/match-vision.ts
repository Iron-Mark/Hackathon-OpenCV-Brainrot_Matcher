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

export async function matchWithVision(imageData: ImageData): Promise<VisionMatch | null> {
  try {
    const dataUrl = imageDataToUrl(imageData);
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    const res = await Promise.race([
      fetch("/models/vision-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: base64 }),
        signal: ctrl.signal,
      }),
      timeout(8000, null),
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
