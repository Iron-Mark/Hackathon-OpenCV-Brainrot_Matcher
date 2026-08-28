# Architecture

Four top-level folders. The Vercel build is self-contained for live vision.

```
Browser (Vercel)
  OpenCV.js + YuNet  ---- live camera / stills (faces, edges, grayscale, blur)

Optional Python backend
  OpenCV DNN + YOLOX ---- objects only, via /api rewrite when API_URL is set
```

## Folders

| Folder | Role | Runtime |
| --- | --- | --- |
| `docs/` | Human-facing design and ops notes | — |
| `frontend/` | Upload UI, live camera, OpenCV.js | Node 22, Next.js, browser WASM |
| `backend/` | Optional YOLOX object detection | Python 3.12, OpenCV |
| `infra/` | Docker Compose, Dockerfiles | Docker |

## Request flow (Vercel / real-time)

1. The page loads OpenCV.js and YuNet in the browser (`/models/yunet` is a Next.js route that caches the Zoo ONNX file).
2. **Live camera** reads webcam frames, runs the selected pipeline, and draws onto a canvas. No Python process is involved.
3. **Still images** use the same in-browser pipelines.
4. **Objects (YOLOX)** still posts to `/api/v1/process` when a container backend is configured.

## Why this split

OpenCV Python wheels are too large for a Vercel Function, and a round-trip API cannot keep up with a webcam. Filters and YuNet therefore run in the browser on the Vercel deployment. The container backend remains for heavier COCO detection.
