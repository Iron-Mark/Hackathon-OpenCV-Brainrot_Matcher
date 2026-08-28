from __future__ import annotations

import os
import urllib.request
from pathlib import Path

WEIGHTS_DIR = Path(__file__).resolve().parents[1] / "weights"

MODELS: dict[str, dict[str, str]] = {
    "yunet": {
        "filename": "face_detection_yunet_2023mar.onnx",
        "url": "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx",
    },
    "yolox": {
        "filename": "object_detection_yolox_2022nov.onnx",
        "url": "https://huggingface.co/opencv/object_detection_yolox/resolve/main/object_detection_yolox_2022nov.onnx",
    },
}


def model_path(name: str) -> Path:
    override = os.environ.get(f"{name.upper()}_PATH")
    if override:
        return Path(override)
    return WEIGHTS_DIR / MODELS[name]["filename"]


def is_ready(name: str) -> bool:
    path = model_path(name)
    return path.is_file() and path.stat().st_size > 1024


def download_model(name: str) -> Path:
    spec = MODELS[name]
    dest = model_path(name)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if is_ready(name):
        return dest
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    urllib.request.urlretrieve(spec["url"], tmp)
    tmp.replace(dest)
    return dest


def ensure_models(*, download: bool) -> dict[str, Path]:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    found: dict[str, Path] = {}
    for name in MODELS:
        if download or is_ready(name):
            found[name] = download_model(name) if download else model_path(name)
        else:
            found[name] = model_path(name)
    return found


def status() -> dict[str, dict[str, object]]:
    root = Path(__file__).resolve().parents[1]
    payload: dict[str, dict[str, object]] = {}
    for name in MODELS:
        path = model_path(name)
        try:
            display = str(path.relative_to(root))
        except ValueError:
            display = str(path)
        payload[name] = {"ready": is_ready(name), "path": display}
    return payload
