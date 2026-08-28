# Architecture

Four top-level folders. The Vercel build is self-contained for live vision.

```
Browser (Vercel)
  OpenCV.js + YuNet     ---- faces, edges, grayscale, blur
  onnxruntime-web + NanoDet ---- COCO objects (live + stills)

Optional Python backend
  OpenCV DNN + YOLOX-S  ---- higher-accuracy object stills via /api when API_URL is set
```

## Folders

| Folder | Role | Runtime |
| --- | --- | --- |
| `docs/` | Human-facing design and ops notes | — |
| `frontend/` | Upload UI, live camera, OpenCV.js, NanoDet | Node 22, Next.js, browser WASM |
| `backend/` | Optional YOLOX object detection | Python 3.12, OpenCV |
| `infra/` | Docker Compose, Dockerfiles | Docker |

## Request flow (Vercel / real-time)

1. The page loads OpenCV.js and YuNet (`/models/yunet`). NanoDet loads on first object-detection run (`/models/nanodet`).
2. **Live camera** reads webcam frames, runs the selected pipeline, and draws onto a canvas. No Python process is involved.
3. **Still images** use the same in-browser pipelines. If a container backend is up, object stills prefer YOLOX.
4. **YOLOX** posts to `/api/v1/process` only when `API_URL` points at a real remote host (or localhost in `next dev`).

## Why this split

OpenCV Python wheels are too large for a Vercel Function, and a round-trip API cannot keep up with a webcam. YuNet, NanoDet, and filters therefore run in the browser. The container backend remains for heavier YOLOX-S stills.
