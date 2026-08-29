import { drawDetections } from "./nanodet";
import type { Detection } from "./types";
import { drawToCanvas } from "./opencv-browser";

export function paintDetections(
  canvas: HTMLCanvasElement,
  image: ImageData,
  detections: Detection[],
) {
  if (detections.length === 0) {
    drawToCanvas(canvas, image);
    return;
  }
  drawToCanvas(canvas, drawDetections(image, detections));
}
