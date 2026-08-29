# Architecture

Four top-level folders. The Vercel build is self-contained for live vision and matching.

```
Browser (Vercel)
  OpenCV.js + YuNet          ---- faces, edges, grayscale, blur
  onnxruntime-web + NanoDet  ---- COCO objects (overlay + Analyze crop/hints)
  Isolation + look/still/CLIP ---- default Analyze (no Gateway)
  On-device sticker mashup   ---- default hybrid
  Optional Gemini            ---- Ask AI to rerank / Brew AI hybrid (ticketed)

Optional Python backend
  OpenCV DNN + YOLOX-S       ---- higher-accuracy object stills via /api when API_URL is set
```

## Folders

| Folder | Role | Runtime |
| --- | --- | --- |
| `docs/` | Human-facing design and ops notes | — |
| `frontend/` | Upload UI, live camera, matcher, mashup | Node 22, Next.js, browser WASM |
| `backend/` | Optional YOLOX object detection | Python 3.12, OpenCV |
| `infra/` | Docker Compose, Dockerfiles | Docker |

## Request flow (Vercel / real-time)

1. Gallery fingerprints load from `/assets/gallery-feat.json` or IndexedDB, else stills via `/models/brainrot/[id]`.
2. NanoDet loads on first object overlay or Analyze (`/models/nanodet`, cached in IndexedDB). YuNet loads with OpenCV overlays.
3. **Analyze match** is local: isolate subject → family/pHash/CLIP blend → calibrated %. No `/models/vision-match` unless the user taps **Ask AI to rerank**.
4. **Free sticker** composites in the browser. **Brew AI hybrid** posts to `/models/hybrid` with a ticket.
5. **YOLOX** posts to `/api/v1/process` only when `API_URL` points at a real remote host (or localhost in `next dev`). Next.js app routes stay under `/models/*`, never `/api/*`.

## Why this split

OpenCV Python wheels are too large for a Vercel Function, and a round-trip API cannot keep up with a webcam. Detection, matching, and the free mashup therefore run in the browser. Paid Gemini stays opt-in and rate limited.
