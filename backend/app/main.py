from __future__ import annotations

import io
import os
import secrets
import time
from typing import Annotated

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from app import vision, weights

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 1920 * 1080
MAX_DIMENSION = 4096
ALLOWED_FORMATS = {"BMP", "JPEG", "PNG", "WEBP"}
PIPELINES = (
    {"id": "faces", "label": "Detect faces", "needs_model": "yunet"},
    {"id": "objects", "label": "Detect objects", "needs_model": "yolox"},
    {"id": "edges", "label": "Canny edges", "needs_model": None},
    {"id": "grayscale", "label": "Grayscale", "needs_model": None},
    {"id": "blur", "label": "Gaussian blur", "needs_model": None},
)

app = FastAPI(title="opencv-cloud", version="0.1.0")


def _cors_origins() -> list[str]:
    configured = os.getenv("BACKEND_CORS_ORIGINS", "")
    if not configured.strip():
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    origins = [item.strip().rstrip("/") for item in configured.split(",") if item.strip()]
    if "*" in origins:
        raise RuntimeError("BACKEND_CORS_ORIGINS must list trusted origins; wildcard CORS is not allowed")
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def _require_api_token(authorization: str | None) -> None:
    expected = os.getenv("BACKEND_API_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(503, "Image processing is not configured")
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(supplied, expected):
        raise HTTPException(
            401,
            "Valid bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _image_dimensions(payload: bytes) -> tuple[int, int]:
    try:
        with Image.open(io.BytesIO(payload)) as source:
            width, height = source.size
            image_format = source.format
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(400, "Could not inspect image") from exc

    if image_format not in ALLOWED_FORMATS:
        raise HTTPException(415, "Unsupported image format")
    if width <= 0 or height <= 0 or width > MAX_DIMENSION or height > MAX_DIMENSION or width * height > MAX_PIXELS:
        raise HTTPException(413, f"Decoded image exceeds {MAX_PIXELS} pixels")
    return width, height


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
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    _require_api_token(authorization)
    pipeline = pipeline.strip().lower()
    known = {item["id"]: item for item in PIPELINES}
    if pipeline not in known:
        raise HTTPException(400, f"Unknown pipeline '{pipeline}'")

    payload = await file.read(MAX_BYTES + 1)
    if not payload:
        raise HTTPException(400, "Empty file")
    if len(payload) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds 8 MB")

    expected_width, expected_height = _image_dimensions(payload)
    array = np.frombuffer(payload, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image")
    height, width = image.shape[:2]
    if width != expected_width or height != expected_height or width * height > MAX_PIXELS:
        raise HTTPException(413, "Decoded image dimensions are unsafe")

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

    return {
        "pipeline": pipeline,
        "width": int(width),
        "height": int(height),
        "elapsed_ms": round(elapsed_ms, 2),
        "model": model_name,
        "image": vision.to_data_url(result),
        "detections": detections,
    }
