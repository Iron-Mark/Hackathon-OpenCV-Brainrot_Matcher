"""Download OpenCV Zoo ONNX weights into backend/weights/."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.weights import ensure_models  # noqa: E402


def main() -> None:
    paths = ensure_models(download=True)
    for name, path in paths.items():
        print(f"{name}: {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
