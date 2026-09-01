import type { PipelineId } from "./opencv-browser";

export const SCANS: { id: PipelineId; label: string; mark: string }[] = [
  { id: "faces", label: "Face", mark: "01" },
  { id: "objects", label: "Obj", mark: "02" },
  { id: "edges", label: "Edge", mark: "03" },
  { id: "grayscale", label: "Gray", mark: "04" },
  { id: "blur", label: "Blur", mark: "05" },
];

export type StudioViewport = "mobile" | "tablet" | "desktop";
export type StudioDrawer = "roster" | "match" | "mixer" | "sticker" | null;
export type StudioStep = "cam" | "scan" | "lock" | "print";

export function originKind(origin: string): "it" | "id" {
  return /indonesia/i.test(origin) ? "id" : "it";
}

export function shortName(name: string): string {
  const parts = name.split(/\s+/);
  if (parts[0] && parts[0].length >= 8) {
    return parts[0];
  }
  return parts.slice(0, 2).join(" ");
}

export function studioStep(args: {
  hasFrame: boolean;
  live: boolean;
  matched: boolean;
  printed: boolean;
}): StudioStep {
  if (args.printed) {
    return "print";
  }
  if (args.matched) {
    return "lock";
  }
  if (args.hasFrame || args.live) {
    return "scan";
  }
  return "cam";
}
