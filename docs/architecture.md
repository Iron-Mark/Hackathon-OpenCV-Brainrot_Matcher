# Architecture

Four top-level folders. Nothing else is required to run the starter.

```
+------------+     /api/* rewrite      +------------+
|  frontend  | ----------------------> |  backend   |
|  Next.js   |                         |  FastAPI   |
|  :3000     |                         |  :8000     |
+------------+                         +-----+------+
                                             |
                                       OpenCV DNN
                                       YuNet / YOLOX
                                             |
                                       backend/weights/
```

## Folders

| Folder | Role | Runtime |
| --- | --- | --- |
| `docs/` | Human-facing design and ops notes | — |
| `frontend/` | Upload UI, result viewer, detection list | Node 22, Next.js |
| `backend/` | Image pipelines and model inference | Python 3.12, OpenCV |
| `infra/` | Docker Compose, Dockerfiles, CI-adjacent config | Docker |

## Request flow

1. Browser posts `multipart/form-data` to `/api/v1/process` on the frontend origin.
2. Next.js rewrites `/api/:path*` to `$API_URL/:path*` (server-side, so the browser never needs CORS for the happy path).
3. FastAPI decodes the image with OpenCV, runs the named pipeline, encodes a JPEG, and returns JSON (`image` as data URL + `detections`).
4. The UI draws the JPEG and lists detections.

Classic pipelines (`edges`, `grayscale`, `blur`) are pure OpenCV. `faces` and `objects` load ONNX weights on first use.

## Why this split

OpenCV Python wheels are too large and too native for a Vercel Serverless Function. The frontend stays on Vercel; the backend stays a container. Locally they still feel like one app because of the rewrite.
