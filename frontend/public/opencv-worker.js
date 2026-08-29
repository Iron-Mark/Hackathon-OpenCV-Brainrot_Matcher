/* OpenCV WASM stays off the UI thread so camera + Analyze stay responsive. */
const OPENCV_JS_SRC =
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";

let cv = null;
let detector = null;

function unwrapCv(raw) {
  return new Promise((resolve, reject) => {
    if (raw && raw.Mat) {
      resolve(raw);
      return;
    }
    if (!raw) {
      reject(new Error("OpenCV.js loaded without cv"));
      return;
    }
    const timer = setTimeout(() => reject(new Error("OpenCV.js runtime timed out")), 30000);
    raw.onRuntimeInitialized = () => {
      clearTimeout(timer);
      resolve(raw);
    };
  });
}

async function init() {
  importScripts(OPENCV_JS_SRC);
  cv = await unwrapCv(self.cv);
  self.postMessage({ type: "ready" });
}

function faceValue(faces, row, col) {
  if (faces.floatAt) {
    return faces.floatAt(row, col);
  }
  if (faces.data32F) {
    return faces.data32F[row * faces.cols + col];
  }
  return 0;
}

function readFaces(faces) {
  if (!faces || !faces.rows) {
    return [];
  }
  const detections = [];
  for (let i = 0; i < faces.rows; i += 1) {
    detections.push({
      label: "face",
      score: faceValue(faces, i, 14),
      box: {
        x: faceValue(faces, i, 0),
        y: faceValue(faces, i, 1),
        w: faceValue(faces, i, 2),
        h: faceValue(faces, i, 3),
      },
    });
  }
  return detections;
}

async function ensureYuNet() {
  if (detector) {
    return;
  }
  const res = await fetch("/models/yunet");
  if (!res.ok) {
    throw new Error("Could not download YuNet weights");
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  cv.FS.writeFile("/yunet.onnx", bytes);
  detector = new cv.FaceDetectorYN("/yunet.onnx", "", new cv.Size(320, 320), 0.7, 0.3, 5000);
}

function process(imageData, pipeline) {
  const started = performance.now();
  const src = cv.matFromImageData(imageData);
  const out = new cv.Mat();
  let detections = [];
  try {
    if (pipeline === "grayscale") {
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.cvtColor(gray, out, cv.COLOR_GRAY2RGBA);
      gray.delete();
    } else if (pipeline === "edges") {
      const gray = new cv.Mat();
      const edges = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, 80, 160);
      cv.cvtColor(edges, out, cv.COLOR_GRAY2RGBA);
      gray.delete();
      edges.delete();
    } else if (pipeline === "blur") {
      cv.GaussianBlur(src, out, new cv.Size(21, 21), 0);
    } else {
      if (!detector) {
        throw new Error("YuNet is not loaded");
      }
      const bgr = new cv.Mat();
      cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR);
      detector.setInputSize(new cv.Size(bgr.cols, bgr.rows));
      const facesMat = new cv.Mat();
      const detected = detector.detect(bgr, facesMat);
      const faces = detected && typeof detected === "object" && "rows" in detected ? detected : facesMat;
      detections = readFaces(faces);
      const color = new cv.Scalar(66, 180, 245, 255);
      for (const det of detections) {
        const x = Math.round(det.box.x);
        const y = Math.round(det.box.y);
        const w = Math.round(det.box.w);
        const h = Math.round(det.box.h);
        cv.rectangle(bgr, new cv.Point(x, y), new cv.Point(x + w, y + h), color, 2);
      }
      cv.cvtColor(bgr, out, cv.COLOR_BGR2RGBA);
      bgr.delete();
      facesMat.delete();
    }
    const copy = new Uint8ClampedArray(out.data);
    return {
      buffer: copy.buffer,
      width: out.cols,
      height: out.rows,
      detections,
      elapsedMs: performance.now() - started,
    };
  } finally {
    src.delete();
    out.delete();
  }
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === "init") {
      await init();
      return;
    }
    if (msg.type === "process") {
      const data = new Uint8ClampedArray(msg.buffer);
      const imageData = new ImageData(data, msg.width, msg.height);
      if (msg.pipeline === "faces") {
        await ensureYuNet();
      }
      if (msg.pipeline === "objects") {
        self.postMessage({
          id: msg.id,
          type: "done",
          buffer: msg.buffer,
          width: msg.width,
          height: msg.height,
          detections: [],
          elapsedMs: 0,
          model: "skip",
        });
        return;
      }
      const result = process(imageData, msg.pipeline);
      self.postMessage(
        {
          id: msg.id,
          type: "done",
          buffer: result.buffer,
          width: result.width,
          height: result.height,
          detections: result.detections,
          elapsedMs: result.elapsedMs,
          model: msg.pipeline === "faces" ? "yunet" : "opencv.js",
        },
        [result.buffer],
      );
    }
  } catch (err) {
    self.postMessage({
      id: msg.id,
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
