from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.coco import COCO_CLASSES


Detection = dict[str, Any]


def encode_jpeg(image: np.ndarray, quality: int = 90) -> bytes:
    ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("Failed to encode JPEG")
    return buf.tobytes()


def to_data_url(image: np.ndarray) -> str:
    import base64

    return "data:image/jpeg;base64," + base64.b64encode(encode_jpeg(image)).decode("ascii")


def draw_detections(image: np.ndarray, detections: list[Detection]) -> np.ndarray:
    canvas = image.copy()
    for det in detections:
        box = det["box"]
        x, y, w, h = int(box["x"]), int(box["y"]), int(box["w"]), int(box["h"])
        color = (180, 245, 66) if det.get("label") != "face" else (66, 180, 245)
        cv2.rectangle(canvas, (x, y), (x + w, y + h), color, 2)
        label = f"{det['label']} {det['score']:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        y0 = max(0, y - th - 6)
        cv2.rectangle(canvas, (x, y0), (x + tw + 8, y0 + th + 6), color, -1)
        cv2.putText(
            canvas,
            label,
            (x + 4, y0 + th + 1),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (12, 13, 16),
            1,
            cv2.LINE_AA,
        )
        for pt in det.get("landmarks") or []:
            cv2.circle(canvas, (int(pt[0]), int(pt[1])), 2, color, -1)
    return canvas


def grayscale(image: np.ndarray) -> tuple[np.ndarray, list[Detection]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR), []


def edges(image: np.ndarray) -> tuple[np.ndarray, list[Detection]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    canny = cv2.Canny(gray, 80, 160)
    return cv2.cvtColor(canny, cv2.COLOR_GRAY2BGR), []


def blur(image: np.ndarray) -> tuple[np.ndarray, list[Detection]]:
    return cv2.GaussianBlur(image, (21, 21), 0), []


def detect_faces(image: np.ndarray, model_path: str) -> tuple[np.ndarray, list[Detection]]:
    h, w = image.shape[:2]
    detector = cv2.FaceDetectorYN.create(model_path, "", (w, h), 0.7, 0.3, 5000)
    detector.setInputSize((w, h))
    _, faces = detector.detect(image)
    detections: list[Detection] = []
    if faces is not None:
        for face in faces:
            x, y, bw, bh = face[:4]
            detections.append(
                {
                    "label": "face",
                    "score": float(face[-1]),
                    "box": {
                        "x": float(max(0, x)),
                        "y": float(max(0, y)),
                        "w": float(bw),
                        "h": float(bh),
                    },
                    "landmarks": [
                        [float(face[4]), float(face[5])],
                        [float(face[6]), float(face[7])],
                        [float(face[8]), float(face[9])],
                        [float(face[10]), float(face[11])],
                        [float(face[12]), float(face[13])],
                    ],
                }
            )
    return draw_detections(image, detections), detections


class YoloX:
    """OpenCV Zoo YOLOX-S decode (Apache 2.0)."""

    def __init__(self, model_path: str, conf_threshold: float = 0.5, nms_threshold: float = 0.5):
        self.net = cv2.dnn.readNet(model_path)
        self.input_size = (640, 640)
        self.strides = [8, 16, 32]
        self.conf_threshold = conf_threshold
        self.nms_threshold = nms_threshold
        self._grids, self._expanded_strides = self._anchors()

    def _anchors(self) -> tuple[np.ndarray, np.ndarray]:
        grids = []
        expanded = []
        for stride in self.strides:
            hsize = self.input_size[0] // stride
            wsize = self.input_size[1] // stride
            xv, yv = np.meshgrid(np.arange(hsize), np.arange(wsize))
            grid = np.stack((xv, yv), 2).reshape(1, -1, 2)
            grids.append(grid)
            expanded.append(np.full((*grid.shape[:2], 1), stride))
        return np.concatenate(grids, 1), np.concatenate(expanded, 1)

    def infer(self, letterboxed: np.ndarray) -> np.ndarray:
        blob = np.transpose(letterboxed, (2, 0, 1))[None, :, :, :]
        self.net.setInput(blob)
        outs = self.net.forward(self.net.getUnconnectedOutLayersNames())
        return self._postprocess(outs[0])

    def _postprocess(self, outputs: np.ndarray) -> np.ndarray:
        dets = outputs[0].copy()
        dets[:, :2] = (dets[:, :2] + self._grids) * self._expanded_strides
        dets[:, 2:4] = np.exp(dets[:, 2:4]) * self._expanded_strides
        boxes = dets[:, :4]
        boxes_xywh = np.ones_like(boxes)
        boxes_xywh[:, 0] = boxes[:, 0] - boxes[:, 2] / 2.0
        boxes_xywh[:, 1] = boxes[:, 1] - boxes[:, 3] / 2.0
        boxes_xywh[:, 2] = boxes[:, 2]
        boxes_xywh[:, 3] = boxes[:, 3]
        scores = dets[:, 4:5] * dets[:, 5:]
        max_scores = np.amax(scores, axis=1)
        max_idx = np.argmax(scores, axis=1)
        keep = cv2.dnn.NMSBoxesBatched(
            boxes_xywh.tolist(),
            max_scores.tolist(),
            max_idx.tolist(),
            self.conf_threshold,
            self.nms_threshold,
        )
        if keep is None or len(keep) == 0:
            return np.empty((0, 6), dtype=np.float32)
        candidates = np.concatenate(
            [boxes_xywh, max_scores[:, None], max_idx[:, None]], axis=1
        )
        return candidates[np.array(keep).reshape(-1)]


def _letterbox(src: np.ndarray, target_size: tuple[int, int] = (640, 640)) -> tuple[np.ndarray, float]:
    padded = np.ones((target_size[0], target_size[1], 3), dtype=np.float32) * 114.0
    ratio = min(target_size[0] / src.shape[0], target_size[1] / src.shape[1])
    resized = cv2.resize(
        src,
        (int(src.shape[1] * ratio), int(src.shape[0] * ratio)),
        interpolation=cv2.INTER_LINEAR,
    ).astype(np.float32)
    padded[: int(src.shape[0] * ratio), : int(src.shape[1] * ratio)] = resized
    return padded, ratio


_yolox: YoloX | None = None


def detect_objects(image: np.ndarray, model_path: str) -> tuple[np.ndarray, list[Detection]]:
    global _yolox
    if _yolox is None:
        _yolox = YoloX(model_path)
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    blob, scale = _letterbox(rgb)
    preds = _yolox.infer(blob)
    detections: list[Detection] = []
    for det in preds:
        x, y, w, h, score, cls_id = det
        x, y, w, h = (x / scale, y / scale, w / scale, h / scale)
        cls_id = int(cls_id)
        label = COCO_CLASSES[cls_id] if 0 <= cls_id < len(COCO_CLASSES) else str(cls_id)
        detections.append(
            {
                "label": label,
                "score": float(score),
                "box": {"x": float(x), "y": float(y), "w": float(w), "h": float(h)},
            }
        )
    return draw_detections(image, detections), detections
