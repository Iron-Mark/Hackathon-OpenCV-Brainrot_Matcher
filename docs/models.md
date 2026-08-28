# Open-weight models

YuNet and NanoDet are loaded in the **browser** on Vercel via `/models/yunet` and `/models/nanodet` (cached Hugging Face downloads). YOLOX stays on the optional Python backend.

Full catalog and host matrix: [integrations.md](integrations.md).

| Pipeline | Model | Where it runs | License | Size (approx) |
| --- | --- | --- | --- | --- |
| `faces` | YuNet (`face_detection_yunet_2023mar.onnx`) | Browser OpenCV.js (Vercel) and Python | MIT | ~232 KB |
| `objects` | NanoDet-Plus INT8 (`object_detection_nanodet_2022nov_int8.onnx`) | Browser onnxruntime-web (Vercel) | Apache 2.0 | ~1.0 MB |
| `objects` (optional stills) | YOLOX-S (`object_detection_yolox_2022nov.onnx`) | Python backend only | Apache 2.0 | ~35 MB |

Filters (`edges`, `grayscale`, `blur`) are OpenCV ops with no weights.

## Swap a model

Browser YuNet: change the URL in `frontend/app/models/yunet/route.ts`.

Browser NanoDet: change the URL in `frontend/app/models/nanodet/route.ts` (FP32 `object_detection_nanodet_2022nov.onnx` is ~3.8 MB).

Python YOLOX:

1. Drop an ONNX file into `backend/weights/`.
2. Point `YOLOX_PATH` at it (see `backend/app/weights.py`).
