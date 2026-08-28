"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Detection,
  type PipelineId,
  drawToCanvas,
  ensureYuNet,
  fileToImageData,
  imageDataToUrl,
  loadOpenCv,
  processImageData,
} from "../lib/opencv-browser";

type Pipeline = {
  id: PipelineId;
  label: string;
  needs_model: string | null;
  live: boolean;
};

const PIPELINES: Pipeline[] = [
  { id: "faces", label: "Detect faces", needs_model: "yunet", live: true },
  { id: "objects", label: "Detect objects", needs_model: "yolox", live: false },
  { id: "edges", label: "Canny edges", needs_model: null, live: true },
  { id: "grayscale", label: "Grayscale", needs_model: null, live: true },
  { id: "blur", label: "Gaussian blur", needs_model: null, live: true },
];

type ProcessResponse = {
  pipeline: string;
  width: number;
  height: number;
  elapsed_ms: number;
  model: string | null;
  image: string;
  detections: Detection[];
};

export default function Page() {
  const [engine, setEngine] = useState<"loading" | "browser" | "failed">("loading");
  const [backend, setBackend] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineId>("faces");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const cvRef = useRef<Awaited<ReturnType<typeof loadOpenCv>> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const lastUiRef = useRef(0);
  const pipelineRef = useRef(pipeline);
  pipelineRef.current = pipeline;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cv = await loadOpenCv();
        await ensureYuNet(cv);
        cvRef.current = cv;
        if (!cancelled) {
          setEngine("browser");
        }
      } catch (err) {
        if (!cancelled) {
          setEngine("failed");
          setError(err instanceof Error ? err.message : "OpenCV.js failed to load");
        }
      }
    })();
    fetch("/api/health")
      .then((res) => res.ok)
      .then((ok) => {
        if (!cancelled) setBackend(ok);
      })
      .catch(() => {
        if (!cancelled) setBackend(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
    setFps(0);
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const cv = cvRef.current;
    if (!video || !canvas || !cv || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const scale = Math.min(1, 640 / w);
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    if (!scratchRef.current) {
      scratchRef.current = document.createElement("canvas");
    }
    const scratch = scratchRef.current;
    scratch.width = width;
    scratch.height = height;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const frame = ctx.getImageData(0, 0, width, height);
    try {
      const current = pipelineRef.current === "objects" ? "faces" : pipelineRef.current;
      const processed = processImageData(cv, frame, current);
      drawToCanvas(canvas, processed.imageData);
      const now = performance.now();
      if (now - lastUiRef.current > 200) {
        lastUiRef.current = now;
        setFps(processed.elapsedMs > 0 ? Math.round(1000 / processed.elapsedMs) : 0);
        setResult({
          pipeline: current,
          width,
          height,
          elapsed_ms: Math.round(processed.elapsedMs * 10) / 10,
          model: current === "faces" ? "yunet" : "opencv.js",
          image: "",
          detections: processed.detections,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live frame failed");
      stopCamera();
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [stopCamera]);

  async function startCamera() {
    setError("");
    setResult(null);
    if (pipeline === "objects") {
      setPipeline("faces");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission denied");
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera]);

  const fileLabel = useMemo(() => (file ? file.name : "Drop a PNG, JPEG, or WebP"), [file]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (live) {
      return;
    }
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (pipeline === "objects") {
        const body = new FormData();
        body.set("file", file);
        body.set("pipeline", pipeline);
        const res = await fetch("/api/v1/process", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail ?? "Object detection needs the Python backend");
        }
        setResult(data as ProcessResponse);
        return;
      }
      const cv = await loadOpenCv();
      if (pipeline === "faces") {
        await ensureYuNet(cv);
      }
      const input = await fileToImageData(file);
      const processed = processImageData(cv, input, pipeline);
      setResult({
        pipeline,
        width: processed.imageData.width,
        height: processed.imageData.height,
        elapsed_ms: Math.round(processed.elapsedMs * 10) / 10,
        model: pipeline === "faces" ? "yunet" : "opencv.js",
        image: imageDataToUrl(processed.imageData),
        detections: processed.detections,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="top">
        <div>
          <p className="kicker">opencv-cloud</p>
          <h1>Live OpenCV in the Vercel build</h1>
          <p className="lede">
            Webcam and stills run in the browser with OpenCV.js and YuNet. The Python backend is
            optional and only needed for YOLOX objects.
          </p>
        </div>
        <div className={`status ${engine === "browser" ? "ok" : engine === "failed" ? "bad" : ""}`}>
          <strong>
            {engine === "browser"
              ? live
                ? "Live camera"
                : "Browser OpenCV ready"
              : engine === "failed"
                ? "OpenCV.js failed"
                : "Loading OpenCV.js"}
          </strong>
          {backend ? "Python API reachable" : "Vercel-only mode · no container API"}
        </div>
      </header>

      <div className="grid">
        <form className="panel" onSubmit={onSubmit}>
          <h2>Input</h2>
          <div className="live-row">
            <button
              className="run secondary"
              type="button"
              onClick={() => (live ? stopCamera() : startCamera())}
              disabled={engine !== "browser"}
            >
              {live ? "Stop camera" : "Start live camera"}
            </button>
          </div>
          <label className="file">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp"
              hidden
              disabled={live}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                setResult(null);
              }}
            />
            {live ? "Camera is live" : fileLabel}
          </label>

          <div className="pipelines">
            {PIPELINES.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="pipeline"
                  value={item.id}
                  checked={pipeline === item.id}
                  disabled={live && !item.live}
                  onChange={() => setPipeline(item.id)}
                />
                <span>
                  {item.label}
                  {item.live ? " · live" : " · server"}
                </span>
              </label>
            ))}
          </div>

          <button className="run" type="submit" disabled={busy || live || engine !== "browser"}>
            {busy ? "Running…" : "Run on still image"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="panel">
          <h2>Result</h2>
          <div className="stage">
            <video ref={videoRef} playsInline muted hidden />
            <canvas ref={canvasRef} className={live ? "show" : "hide"} />
            {!live && result?.image ? (
              <img src={result.image} alt="Pipeline output" />
            ) : null}
            {!live && !result?.image ? <p className="lede">Start the camera or run a still.</p> : null}
          </div>
          {result ? (
            <p className="meta">
              <span>
                {result.width}×{result.height}
              </span>
              <span>{result.elapsed_ms} ms</span>
              {live ? <span>~{fps} fps</span> : null}
              <span>{result.model ?? "opencv.js"}</span>
              <span>{result.detections.length} detections</span>
            </p>
          ) : null}

          {result && result.detections.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Score</th>
                  <th>Box</th>
                </tr>
              </thead>
              <tbody>
                {result.detections.slice(0, 12).map((det, index) => (
                  <tr key={`${det.label}-${index}`}>
                    <td>{det.label}</td>
                    <td>{det.score.toFixed(2)}</td>
                    <td>
                      {Math.round(det.box.x)},{Math.round(det.box.y)} {Math.round(det.box.w)}×
                      {Math.round(det.box.h)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </main>
  );
}
