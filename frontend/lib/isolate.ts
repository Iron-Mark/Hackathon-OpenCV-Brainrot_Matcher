import type { Detection } from "./types";

export type Box = { x: number; y: number; w: number; h: number };

export type Isolation = {
  person: boolean;
  coverage: number;
  mask: Uint8Array | null;
  face?: Box;
  hair: Box;
  clothes: Box;
  legs: Box;
};

type Landmark = { x: number; y: number; visibility?: number };

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

function clampBox(box: Box, width: number, height: number): Box {
  const x = Math.max(0, Math.min(width - 2, box.x));
  const y = Math.max(0, Math.min(height - 2, box.y));
  return {
    x,
    y,
    w: Math.max(4, Math.min(width - x, box.w)),
    h: Math.max(4, Math.min(height - y, box.h)),
  };
}

function inBox(px: number, py: number, box: Box): boolean {
  return px >= box.x && py >= box.y && px < box.x + box.w && py < box.y + box.h;
}

function heuristicZones(width: number, height: number, person?: Box): Omit<Isolation, "person" | "coverage" | "mask"> {
  const body = person ?? { x: width * 0.12, y: 0, w: width * 0.76, h: height };
  return {
    face: clampBox({ x: body.x + body.w * 0.28, y: body.y, w: body.w * 0.44, h: body.h * 0.22 }, width, height),
    hair: clampBox({ x: body.x + body.w * 0.2, y: body.y, w: body.w * 0.6, h: body.h * 0.2 }, width, height),
    clothes: clampBox({ x: body.x + body.w * 0.08, y: body.y + body.h * 0.22, w: body.w * 0.84, h: body.h * 0.42 }, width, height),
    legs: clampBox({ x: body.x + body.w * 0.12, y: body.y + body.h * 0.62, w: body.w * 0.76, h: body.h * 0.36 }, width, height),
  };
}

function zonesFromPose(width: number, height: number, pose: Landmark[]): Omit<Isolation, "person" | "coverage" | "mask"> | null {
  const at = (i: number) => pose[i];
  const ok = (p?: Landmark) => Boolean(p && (p.visibility == null || p.visibility > 0.35));
  const ls = at(11);
  const rs = at(12);
  const lh = at(23);
  const rh = at(24);
  const le = at(2);
  const re = at(5);
  const nose = at(0);
  const la = at(27);
  const ra = at(28);
  if (!ok(ls) || !ok(rs) || !ok(lh) || !ok(rh)) {
    return null;
  }
  const sx = Math.min(ls.x, rs.x) * width;
  const sw = Math.abs(rs.x - ls.x) * width;
  const sy = Math.min(ls.y, rs.y) * height;
  const eyeY = ok(le) && ok(re) ? ((le.y + re.y) / 2) * height : sy;
  const hipY = ((lh.y + rh.y) / 2) * height;
  const ankleY = ok(la) && ok(ra) ? Math.max(la.y, ra.y) * height : height;
  const faceCy = ok(nose) ? nose.y * height : eyeY;
  const faceCx = ok(nose) ? nose.x * width : (ls.x + rs.x) * 0.5 * width;
  return {
    face: clampBox({ x: faceCx - sw * 0.45, y: faceCy - sw * 0.55, w: sw * 0.9, h: sw * 0.95 }, width, height),
    hair: clampBox({ x: sx - sw * 0.15, y: Math.max(0, eyeY - sw * 0.85), w: sw * 1.3, h: sw * 0.7 }, width, height),
    clothes: clampBox({ x: sx - sw * 0.2, y: sy, w: sw * 1.4, h: Math.max(16, hipY - sy) }, width, height),
    legs: clampBox({ x: sx - sw * 0.1, y: hipY, w: sw * 1.2, h: Math.max(16, ankleY - hipY) }, width, height),
  };
}

let mpPromise: Promise<{
  segment?: (image: ImageData) => Uint8Array | null;
  pose?: (image: ImageData) => Landmark[] | null;
} | null> | null = null;

async function loadRemoteEsm(url: string): Promise<unknown> {
  const loader = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;
  return loader(url);
}

async function loadMediaPipe() {
  if (typeof window === "undefined") {
    return null;
  }
  if (mpPromise) {
    return mpPromise;
  }
  mpPromise = (async () => {
    try {
      const vision = (await loadRemoteEsm(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm",
      )) as {
        FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
        ImageSegmenter: {
          createFromOptions: (
            fileset: unknown,
            opts: unknown,
          ) => Promise<{ segment: (image: ImageData) => { categoryMask?: { getAsUint8Array?: () => Uint8Array }; close?: () => void } }>;
        };
        PoseLandmarker: {
          createFromOptions: (
            fileset: unknown,
            opts: unknown,
          ) => Promise<{ detect: (image: ImageData) => { landmarks?: Landmark[][] } }>;
        };
      };
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
      );
      const segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        outputCategoryMask: true,
      });
      const pose = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numPoses: 1,
      });
      return {
        segment: (image: ImageData) => {
          const result = segmenter.segment(image);
          const mask = result.categoryMask?.getAsUint8Array?.() ?? null;
          result.close?.();
          return mask;
        },
        pose: (image: ImageData) => pose.detect(image).landmarks?.[0] ?? null,
      };
    } catch {
      return null;
    }
  })();
  return mpPromise;
}

export function warmupIsolation() {
  void loadMediaPipe();
}

export async function isolateSubject(image: ImageData, detections: Detection[] = []): Promise<Isolation> {
  const { width, height } = image;
  const person = detections
    .filter((d) => d.label === "person" && d.score >= 0.35)
    .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
  const faceDet = detections
    .filter((d) => d.label === "face" && d.score >= 0.5)
    .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];

  const mp = await Promise.race([loadMediaPipe(), timeout(2800, null)]);
  let mask: Uint8Array | null = null;
  let pose: Landmark[] | null = null;
  if (mp) {
    try {
      mask = mp.segment?.(image) ?? null;
      pose = mp.pose?.(image) ?? null;
    } catch {
      mask = null;
    }
  }

  let coverage = 0;
  if (mask && mask.length >= width * height) {
    let n = 0;
    for (let i = 0; i < width * height; i += 1) {
      if (mask[i] > 0) {
        n += 1;
      }
    }
    coverage = n / (width * height);
  } else if (person) {
    coverage = Math.min(0.85, (person.box.w * person.box.h) / (width * height));
  } else if (faceDet) {
    coverage = Math.min(0.45, (faceDet.box.w * faceDet.box.h * 6) / (width * height));
  }

  const fromPose = pose ? zonesFromPose(width, height, pose) : null;
  const zones = fromPose ?? heuristicZones(width, height, person?.box);
  if (faceDet) {
    zones.face = clampBox(faceDet.box, width, height);
    zones.hair = clampBox(
      {
        x: faceDet.box.x - faceDet.box.w * 0.15,
        y: Math.max(0, faceDet.box.y - faceDet.box.h * 0.55),
        w: faceDet.box.w * 1.3,
        h: faceDet.box.h * 0.7,
      },
      width,
      height,
    );
  }

  const personLike = coverage >= 0.08 || Boolean(person) || Boolean(faceDet);
  return {
    person: personLike,
    coverage,
    mask,
    ...zones,
  };
}

export function pixelZone(
  index: number,
  width: number,
  isolation: Isolation,
): "face" | "hair" | "clothes" | "legs" | "bg" {
  const px = index % width;
  const py = Math.floor(index / width);
  if (isolation.mask && isolation.mask.length > index && isolation.mask[index] === 0) {
    return "bg";
  }
  if (isolation.face && inBox(px, py, isolation.face)) {
    return "face";
  }
  if (inBox(px, py, isolation.hair)) {
    return "hair";
  }
  if (inBox(px, py, isolation.clothes)) {
    return "clothes";
  }
  if (inBox(px, py, isolation.legs)) {
    return "legs";
  }
  return isolation.mask ? "clothes" : "bg";
}
