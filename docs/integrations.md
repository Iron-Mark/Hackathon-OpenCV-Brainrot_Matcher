# Models and backends

What can actually make **brainrot-matcher** work, given Vercel cannot run OpenCV Python.

## What already works

| Path | Where | Models / ops |
| --- | --- | --- |
| Live camera + stills | Browser on [Vercel](https://opencv-cloud.vercel.app) | YuNet faces, **NanoDet objects**, Canny, grayscale, blur |
| Objects (YOLOX-S) | Local/Docker FastAPI, or Vercel stills when `API_URL` is set | `POST /v1/process` with `pipeline=objects` |

Pick Path B only if you want YOLOX accuracy on stills. Live objects already run in the page.

## Path A — stay on Vercel (browser) — shipped

Run OpenCV Zoo ONNX in the page.

| Model | Hugging Face | Size | Status |
| --- | --- | --- | --- |
| YuNet | [opencv/face_detection_yunet](https://huggingface.co/opencv/face_detection_yunet) | 0.23 MB | Wired (`/models/yunet` + OpenCV.js `FaceDetectorYN`). |
| **NanoDet-Plus INT8** | [opencv/object_detection_nanodet](https://huggingface.co/opencv/object_detection_nanodet) | **1.0 MB** | Wired (`/models/nanodet` + onnxruntime-web). Apache 2.0, COCO 80. FP32 (~3.8 MB) is a drop-in URL swap. |
| MP-PalmDet | Zoo `palm_detection_mediapipe` | small | Next live add-on. |
| License-plate YuNet | Zoo `license_plate_detection_yunet` | small | Next live add-on. |
| WeChat QR | Zoo `qrcode_wechatqrcode` | small | Next live add-on. |
| YOLOX-S | [opencv/object_detection_yolox](https://huggingface.co/opencv/object_detection_yolox) | **~35 MB** | Too heavy for WASM live video. Use Path B. |

INT8 was chosen over FP32 so the Next.js model route stays under Vercel’s ~4.5 MB function response limit. OpenCV DNN and ONNX Runtime both emit the same six heads (`2704/676/169` × 80 cls + 32 DFL).

Do **not** put YOLOX-S, EfficientSAM, LAMA, or RAFT in the browser bundle.

## Path B — keep the Python API (YOLOX stills)

The backend in [`backend/`](../backend/) is already the integration. Deploy **that Docker image** and set Vercel env `API_URL` to its HTTPS origin (no trailing slash). The frontend rewrite only activates on Vercel when `API_URL` is a real remote host ([`frontend/next.config.ts`](../frontend/next.config.ts)). Live camera still uses NanoDet; still uploads prefer YOLOX when the API is reachable.

| Host | How | Notes |
| --- | --- | --- |
| **Fly.io** | `fly launch` from `infra/Dockerfile.backend` | Good default. Scale-to-zero, HTTPS, ~1 GB RAM for YOLOX CPU. |
| **Railway** | Dockerfile autodetect | Easy GitHub deploy. Use the Dockerfile, not Nixpacks (`libGL` issues). |
| **Google Cloud Run** | `gcloud run deploy` (see [deploy.md](deploy.md)) | Scale to zero, 1Gi memory, 60s timeout. |
| **Hugging Face Spaces (Docker)** | Space SDK = Docker, same Dockerfile | Free/cheap, public URL, slow cold start. |
| **Render / ECS** | Same image | Fine if you already live there. |

Memory: **≥ 1 GB** for YOLOX-S CPU. NanoDet in the browser needs none of this.

### Wire-up (once you have a URL)

1. Deploy `infra/Dockerfile.backend` (builds with YuNet + YOLOX baked in).
2. Vercel project `opencv-cloud` → Environment Variable `API_URL=https://<backend-host>`.
3. Redeploy the frontend so `rewrites()` include `/api/:path*`.
4. **Detect objects** on a still posts to `/api/v1/process` (YOLOX). Live camera stays NanoDet.

Local equivalent is already `API_URL=http://127.0.0.1:8000`.

## Path C — hosted inference APIs (not OpenCV DNN)

Use these only if you want captions / VLM, not Zoo ONNX.

| Service | Models | Role vs this repo |
| --- | --- | --- |
| Hugging Face Inference / Spaces Gradio | Many vision nets | Extra HTTP client; duplicate of Path B if you wrap OpenCV. |
| Replicate / fal | YOLOv8, SAM, etc. | Paid, not OpenCV Zoo. |
| Vercel AI Gateway | VLMs (Qwen-VL, Gemini, …) | “Describe this frame”, not boxes. Does not replace OpenCV. |
| Ultralytics YOLO | YOLOv8n ONNX | Easy, **AGPL**. Different runtime than Zoo. |

## OpenCV Zoo catalog (all ONNX, OpenCV DNN)

Weights live under `https://huggingface.co/opencv/<dir>` or `opencv/opencv_zoo`.

| Zoo directory | Task | Put it |
| --- | --- | --- |
| `face_detection_yunet` | Faces | Browser (done) |
| `face_recognition_sface` | Face embed | Backend (pair with YuNet) |
| `facial_expression_recognition` | FER | Backend or browser |
| `license_plate_detection_yunet` | Plates | Browser |
| `object_detection_nanodet` | COCO objects | **Browser (done)** |
| `object_detection_yolox` | COCO objects | Backend only (wired) |
| `palm_detection_mediapipe` | Palms | Browser |
| `handpose_estimation_mediapipe` | Hands | Browser |
| `person_detection_mediapipe` | Person | Browser |
| `pose_estimation_mediapipe` | 33 keypoints | Backend or browser |
| `text_detection_ppocr` | Text boxes | Backend |
| `text_recognition_crnn` | OCR | Backend |
| `qrcode_wechatqrcode` | QR | Browser |
| `human_segmentation_pphumanseg` | Person matte | Backend |
| `image_segmentation_efficientsam` | SAM-style | Backend, more RAM |
| `image_classification_mobilenet` | Labels | Browser |
| `object_tracking_vittrack` | Track | Backend (video) |
| `edge_detection_dexined` | Learned edges | Browser |
| `deblurring_nafnet` / `inpainting_lama` / `optical_flow_estimation_raft` | Heavy restore/flow | Backend / GPU |

## What will not work

- **Vercel Function + `opencv-python`**: native wheel (~50 MB+) plus YOLOX, cold starts, no webcam loop.
- **Live YOLOX-S in WASM**: ~35 MB + 640² decode will miss real-time on CPU.
- **Pointing `API_URL` at `127.0.0.1` on Vercel**: the rewrite is disabled on purpose.

## Suggested order

1. Keep live YuNet + NanoDet on Vercel (shipped).
2. Deploy the existing FastAPI image to **Fly / Cloud Run / HF Spaces** and set `API_URL` only if you want YOLOX accuracy on stills.
3. Add Zoo extras (SFace, PPOCR, pose) after that.
