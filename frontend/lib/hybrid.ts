export type HybridResult = {
  image: string;
  id: string;
  name: string;
};

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

export function jpegForHybrid(imageData: ImageData, maxEdge = 768): string {
  const scale = Math.min(1, maxEdge / imageData.width, maxEdge / imageData.height);
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
  const url = dst.toDataURL("image/jpeg", 0.74);
  const comma = url.indexOf(",");
  return comma >= 0 ? url.slice(comma + 1) : url;
}

export async function generateHybrid(imageData: ImageData, id: string): Promise<HybridResult> {
  const image = jpegForHybrid(imageData);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 50000);
  const res = await Promise.race([
    fetch("/models/hybrid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image, id }),
      signal: ctrl.signal,
    }),
    timeout(50000, null),
  ]);
  window.clearTimeout(timer);
  if (!res) {
    throw new Error("Hybrid timed out. Try again.");
  }
  const body = (await res.json()) as HybridResult & { error?: string };
  if (!res.ok || !body.image) {
    throw new Error(body.error || "Hybrid image failed");
  }
  return body;
}
