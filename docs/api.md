# API

Base URL: the backend origin (`http://127.0.0.1:8000` locally). Through the frontend, the same paths are available under `/api` when `API_URL` is set.

The Vercel UI does **not** need this API for live vision or Analyze. Faces, objects, and default matching run in the browser (YuNet / NanoDet / local score). This contract is for the optional YOLOX container.

Frontend-only routes live under `/models/*` (never `/api/*`):

| Route | Role |
| --- | --- |
| `GET /models/ticket` | HMAC session ticket for paid AI |
| `POST /models/vision-match` | Optional Gemini rerank (opt-in, rate limited) |
| `POST /models/hybrid` | Optional paid AI brew (rate limited) |
| `GET /models/brainrot/[id]` | Character still |
| `GET /models/chant/[id]` | Italian chant |
| `GET /models/yunet` / `GET /models/nanodet` | Open-weight ONNX |

Bare curl to the AI routes is rejected. Analyze and the free sticker do not call them.

## `GET /health`

Liveness plus OpenCV and model status.

```json
{
  "ok": true,
  "service": "opencv-cloud-backend",
  "opencv": "4.12.0",
  "models": {
    "yunet": { "ready": true, "path": "weights/face_detection_yunet_2023mar.onnx" },
    "yolox": { "ready": false, "path": "weights/object_detection_yolox_2022nov.onnx" }
  }
}
```

## `GET /v1/pipelines`

```json
{
  "pipelines": [
    { "id": "faces", "label": "Detect faces", "needs_model": "yunet" },
    { "id": "objects", "label": "Detect objects", "needs_model": "yolox" },
    { "id": "edges", "label": "Canny edges", "needs_model": null },
    { "id": "grayscale", "label": "Grayscale", "needs_model": null },
    { "id": "blur", "label": "Gaussian blur", "needs_model": null }
  ]
}
```

## `POST /v1/process`

`multipart/form-data`

| Field | Type | Notes |
| --- | --- | --- |
| `file` | image | PNG, JPEG, WebP, BMP. Max 8 MB. |
| `pipeline` | string | One of the ids above. Default `faces`. |

Response:

```json
{
  "pipeline": "faces",
  "width": 1280,
  "height": 720,
  "elapsed_ms": 42.1,
  "model": "yunet",
  "image": "data:image/jpeg;base64,...",
  "detections": [
    {
      "label": "face",
      "score": 0.97,
      "box": { "x": 120, "y": 80, "w": 90, "h": 110 }
    }
  ]
}
```

Errors use `{ "detail": "..." }` with 4xx/5xx. `503` means a required model file is missing — run `python scripts/download_models.py`.
