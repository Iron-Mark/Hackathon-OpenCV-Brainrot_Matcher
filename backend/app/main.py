from __future__ import annotations

import time
from typing import Annotated

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import vision, weights

MAX_BYTES = 8 * 1024 * 1024
PIPELINES = (
    {"id": "faces", "label": "Detect faces", "needs_model": "yunet"},
    {"id": "objects", "label": "Detect objects", "needs_model": "yolox"},
    {"id": "edges", "label": "Canny edges", "needs_model": None},
    {"id": "grayscale", "label": "Grayscale", "needs_model": None},
    {"id": "blur", "label": "Gaussian blur", "needs_model": None},
)

app = FastAPI(title="opencv-cloud", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "opencv-cloud-backend",
        "opencv": cv2.__version__,
        "models": weights.status(),
    }


@app.get("/v1/pipelines")
def list_pipelines() -> dict:
    return {"pipelines": list(PIPELINES)}


@app.post("/v1/process")
async def process(
    file: Annotated[UploadFile, File()],
    pipeline: Annotated[str, Form()] = "faces",
) -> dict:
    pipeline = pipeline.strip().lower()
    known = {item["id"]: item for item in PIPELINES}
    if pipeline not in known:
        raise HTTPException(400, f"Unknown pipeline '{pipeline}'")

    payload = await file.read()
    if not payload:
        raise HTTPException(400, "Empty file")
    if len(payload) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds 8 MB")

    array = np.frombuffer(payload, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image")

    spec = known[pipeline]
    model_name = spec["needs_model"]
    if model_name and not weights.is_ready(model_name):
        try:
            weights.download_model(model_name)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                503,
                f"Model '{model_name}' is missing. Run backend/scripts/download_models.py ({exc})",
            ) from exc

    started = time.perf_counter()
    if pipeline == "faces":
        result, detections = vision.detect_faces(image, str(weights.model_path("yunet")))
    elif pipeline == "objects":
        result, detections = vision.detect_objects(image, str(weights.model_path("yolox")))
    elif pipeline == "edges":
        result, detections = vision.edges(image)
    elif pipeline == "blur":
        result, detections = vision.blur(image)
    else:
        result, detections = vision.grayscale(image)
    elapsed_ms = (time.perf_counter() - started) * 1000

    h, w = image.shape[:2]
    return {
        "pipeline": pipeline,
        "width": int(w),
        "height": int(h),
        "elapsed_ms": round(elapsed_ms, 2),
        "model": model_name,
        "image": vision.to_data_url(result),
        "detections": detections,
    }
