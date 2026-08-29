import { CHARACTER_LOOKS } from "./character-looks";
import { BRAINROT_CHARACTERS } from "./characters";
import { faceSlot } from "./character-slots";
import { labStats, oklabToRgb, reinhardTransfer, rgbToOklab } from "./color-science";
import type { Detection } from "./types";

export type MashupResult = {
  image: string;
  id: string;
  name: string;
  kind: "sticker";
};

function drawImageData(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")?.putImageData(image, 0, 0);
  return canvas;
}

function faceBox(image: ImageData, detections: Detection[]): { x: number; y: number; w: number; h: number } {
  const face = detections
    .filter((d) => d.label === "face" && d.score >= 0.45)
    .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
  if (face) {
    const pad = 0.16;
    return {
      x: face.box.x - face.box.w * pad,
      y: face.box.y - face.box.h * pad * 1.2,
      w: face.box.w * (1 + pad * 2),
      h: face.box.h * (1 + pad * 2.2),
    };
  }
  const person = detections
    .filter((d) => d.label === "person")
    .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
  if (person) {
    return {
      x: person.box.x + person.box.w * 0.28,
      y: person.box.y,
      w: person.box.w * 0.44,
      h: person.box.h * 0.28,
    };
  }
  return { x: image.width * 0.3, y: image.height * 0.06, w: image.width * 0.4, h: image.height * 0.28 };
}

async function stillBitmap(id: string): Promise<ImageBitmap> {
  const res = await fetch(`/models/brainrot/${id}`, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Could not load character still");
  }
  return createImageBitmap(await res.blob());
}

export async function generateMashup(
  person: ImageData,
  id: string,
  detections: Detection[] = [],
): Promise<MashupResult> {
  const character = BRAINROT_CHARACTERS.find((item) => item.id === id);
  if (!character) {
    throw new Error("Unknown character");
  }
  const still = await stillBitmap(id);
  const size = 640;
  const base = document.createElement("canvas");
  base.width = size;
  base.height = size;
  const ctx = base.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / still.width, size / still.height);
  const dw = still.width * scale;
  const dh = still.height * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(still, dx, dy, dw, dh);

  const box = faceBox(person, detections);
  const faceCanvas = document.createElement("canvas");
  const fw = Math.max(24, Math.round(box.w));
  const fh = Math.max(24, Math.round(box.h));
  faceCanvas.width = fw;
  faceCanvas.height = fh;
  const faceCtx = faceCanvas.getContext("2d");
  if (!faceCtx) {
    throw new Error("Canvas is unavailable");
  }
  faceCtx.drawImage(drawImageData(person), box.x, box.y, box.w, box.h, 0, 0, fw, fh);
  const faceData = faceCtx.getImageData(0, 0, fw, fh);
  const target = labStats({ data: ctx.getImageData(dx, dy, Math.max(8, dw), Math.max(8, dh)).data, width: Math.round(dw), height: Math.round(dh) });
  reinhardTransfer(faceData, target);
  faceCtx.putImageData(faceData, 0, 0);

  const slot = faceSlot(id);
  const cx = dx + slot.cx * dw;
  const cy = dy + slot.cy * dh;
  const rx = slot.rx * dw;
  const ry = slot.ry * dh;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(faceCanvas, cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
  const look = CHARACTER_LOOKS[id];
  if (look?.hues?.length) {
    const grade = ctx.getImageData(0, 0, size, size);
    const hue = look.hues[0] / 360;
    for (let i = 0; i < grade.data.length; i += 16) {
      const lab = rgbToOklab(grade.data[i], grade.data[i + 1], grade.data[i + 2]);
      lab[1] = lab[1] * 0.88 + Math.cos(hue * Math.PI * 2) * 0.04 * look.sat;
      lab[2] = lab[2] * 0.88 + Math.sin(hue * Math.PI * 2) * 0.04 * look.sat;
      const rgb = oklabToRgb(lab[0], lab[1], lab[2]);
      grade.data[i] = rgb[0];
      grade.data[i + 1] = rgb[1];
      grade.data[i + 2] = rgb[2];
    }
    ctx.putImageData(grade, 0, 0);
  }
  ctx.strokeStyle = "rgba(12,13,16,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.filter = "contrast(1.06) saturate(1.08)";
  ctx.drawImage(base, 0, 0);
  ctx.filter = "none";

  return {
    image: base.toDataURL("image/png"),
    id,
    name: character.name,
    kind: "sticker",
  };
}
