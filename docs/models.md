# Open-weight models

Weights are **not** committed. `backend/scripts/download_models.py` pulls them from Hugging Face (`opencv` org) into `backend/weights/`.

| Pipeline | Model | Source | License | Size (approx) |
| --- | --- | --- | --- | --- |
| `faces` | YuNet (`face_detection_yunet_2023mar.onnx`) | [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT | ~350 KB |
| `objects` | YOLOX-S (`object_detection_yolox_2022nov.onnx`) | [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/object_detection_yolox) | Apache 2.0 | ~35 MB |

Both run through **OpenCV DNN** / `cv2.FaceDetectorYN` on CPU. No GPU, no closed API, no Ultralytics runtime.

## Swap a model

1. Drop an ONNX file into `backend/weights/`.
2. Point `YUNET_PATH` or `YOLOX_PATH` at it (see `backend/app/weights.py`).
3. Keep input pre/post-processing in sync — YuNet is used via `FaceDetectorYN`; YOLOX uses the Zoo letterbox + stride decode.

## Why these two

They are the smallest Zoo models that cover the two usual starter jobs (faces + COCO objects), have OSI licenses, and are already wired for OpenCV. Replace them when the product needs a different head (pose, OCR, segmentation).
