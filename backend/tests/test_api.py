from __future__ import annotations

import os
import struct
import zlib

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("BACKEND_API_TOKEN", "test-backend-token-that-is-at-least-32-bytes")

from app.main import app

client = TestClient(app)
AUTH = {"Authorization": f"Bearer {os.environ['BACKEND_API_TOKEN']}"}


def _png_bytes(width: int = 48, height: int = 32) -> bytes:
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (40, 40, 40)
    cv2.rectangle(img, (8, 6), (width - 8, height - 6), (0, 220, 90), -1)
    cv2.circle(img, (width // 2, height // 2), 6, (240, 240, 240), -1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def _png_with_claimed_dimensions(width: int, height: int) -> bytes:
    payload = bytearray(_png_bytes())
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    payload[16:29] = ihdr_data
    payload[29:33] = struct.pack(">I", zlib.crc32(b"IHDR" + ihdr_data) & 0xFFFFFFFF)
    return bytes(payload)


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
        headers=AUTH,
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
        headers=AUTH,
    )
    assert res.status_code == 200, res.text
    assert res.json()["pipeline"] == "edges"


def test_unknown_pipeline() -> None:
    res = client.post(
        "/v1/process",
        files={"file": ("dot.png", _png_bytes(), "image/png")},
        data={"pipeline": "magic"},
        headers=AUTH,
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
        headers=AUTH,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["pipeline"] == "faces"
    assert body["model"] == "yunet"
    assert isinstance(body["detections"], list)


def test_process_requires_bearer_token() -> None:
    res = client.post(
        "/v1/process",
        files={"file": ("dot.png", _png_bytes(), "image/png")},
        data={"pipeline": "grayscale"},
    )
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_process_fails_closed_without_server_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BACKEND_API_TOKEN")
    res = client.post(
        "/v1/process",
        files={"file": ("dot.png", _png_bytes(), "image/png")},
        data={"pipeline": "grayscale"},
        headers=AUTH,
    )
    assert res.status_code == 503


def test_rejects_decompression_bomb_before_opencv(monkeypatch: pytest.MonkeyPatch) -> None:
    def unexpected_decode(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("cv2.imdecode must not run for oversized dimensions")

    monkeypatch.setattr(cv2, "imdecode", unexpected_decode)
    bomb = _png_with_claimed_dimensions(8192, 8192)
    assert len(bomb) < 10_000
    res = client.post(
        "/v1/process",
        files={"file": ("bomb.png", bomb, "image/png")},
        data={"pipeline": "grayscale"},
        headers=AUTH,
    )
    assert res.status_code == 413


def test_rejects_wildcard_cors_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import _cors_origins

    monkeypatch.setenv("BACKEND_CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError, match="wildcard CORS"):
        _cors_origins()


def test_cors_only_allows_configured_origin() -> None:
    preflight = {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    }
    trusted = client.options(
        "/v1/process",
        headers={"Origin": "http://localhost:3000", **preflight},
    )
    assert trusted.headers["access-control-allow-origin"] == "http://localhost:3000"

    untrusted = client.options(
        "/v1/process",
        headers={"Origin": "https://attacker.example", **preflight},
    )
    assert "access-control-allow-origin" not in untrusted.headers
