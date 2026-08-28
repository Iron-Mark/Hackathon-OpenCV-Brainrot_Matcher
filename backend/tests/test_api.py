from __future__ import annotations

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _png_bytes(width: int = 48, height: int = 32) -> bytes:
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (40, 40, 40)
    cv2.rectangle(img, (8, 6), (width - 8, height - 6), (0, 220, 90), -1)
    cv2.circle(img, (width // 2, height // 2), 6, (240, 240, 240), -1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert "opencv" in body
    assert "yunet" in body["models"]
    assert "yolox" in body["models"]


def test_pipelines() -> None:
    res = client.get("/v1/pipelines")
    ids = {item["id"] for item in res.json()["pipelines"]}
    assert ids == {"faces", "objects", "edges", "grayscale", "blur"}


def test_grayscale_process() -> None:
    res = client.post(
        "/v1/process",
        files={"file": ("dot.png", _png_bytes(), "image/png")},
        data={"pipeline": "grayscale"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["pipeline"] == "grayscale"
    assert body["image"].startswith("data:image/jpeg;base64,")
    assert body["detections"] == []
    assert body["width"] == 48
    assert body["height"] == 32


def test_edges_process() -> None:
    res = client.post(
        "/v1/process",
        files={"file": ("dot.png", _png_bytes(), "image/png")},
        data={"pipeline": "edges"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["pipeline"] == "edges"


def test_unknown_pipeline() -> None:
    res = client.post(
        "/v1/process",
        files={"file": ("dot.png", _png_bytes(), "image/png")},
        data={"pipeline": "magic"},
    )
    assert res.status_code == 400


def test_faces_process_with_weights() -> None:
    from app.weights import is_ready

    if not is_ready("yunet"):
        pytest.skip("yunet weights not present")
    res = client.post(
        "/v1/process",
        files={"file": ("dot.png", _png_bytes(160, 160), "image/png")},
        data={"pipeline": "faces"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["pipeline"] == "faces"
    assert body["model"] == "yunet"
    assert isinstance(body["detections"], list)
