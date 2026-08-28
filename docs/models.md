# Open-weight models

YuNet is loaded in the **browser** on Vercel via `/models/yunet` (cached Hugging Face download). YOLOX stays on the optional Python backend.

| Pipeline | Model | Where it runs | License | Size (approx) |
| --- | --- | --- | --- | --- |
| `faces` | YuNet (`face_detection_yunet_2023mar.onnx`) | Browser OpenCV.js (Vercel) and Python | MIT | ~350 KB |
| `objects` | YOLOX-S (`object_detection_yolox_2022nov.onnx`) | Python backend only | Apache 2.0 | ~35 MB |

Filters (`edges`, `grayscale`, `blur`) are OpenCV ops with no weights.

## Swap a model

Browser YuNet: change the URL in `frontend/app/models/yunet/route.ts`.

Python YOLOX:

1. Drop an ONNX file into `backend/weights/`.
2. Point `YOLOX_PATH` at it (see `backend/app/weights.py`).
