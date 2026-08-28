"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Pipeline = {
  id: string;
  label: string;
  needs_model: string | null;
};

type Detection = {
  label: string;
  score: number;
  box: { x: number; y: number; w: number; h: number };
};

type ProcessResponse = {
  pipeline: string;
  width: number;
  height: number;
  elapsed_ms: number;
  model: string | null;
  image: string;
  detections: Detection[];
};

const FALLBACK_PIPELINES: Pipeline[] = [
  { id: "faces", label: "Detect faces", needs_model: "yunet" },
  { id: "objects", label: "Detect objects", needs_model: "yolox" },
  { id: "edges", label: "Canny edges", needs_model: null },
  { id: "grayscale", label: "Grayscale", needs_model: null },
  { id: "blur", label: "Gaussian blur", needs_model: null },
];

export default function Page() {
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [opencv, setOpencv] = useState<string>("");
  const [pipelines, setPipelines] = useState<Pipeline[]>(FALLBACK_PIPELINES);
  const [pipeline, setPipeline] = useState("faces");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error("health failed");
        const body = await res.json();
        if (!cancelled) {
          setHealth("ok");
          setOpencv(body.opencv ?? "");
        }
        const listed = await fetch("/api/v1/pipelines");
        if (listed.ok) {
          const data = await listed.json();
          if (!cancelled && Array.isArray(data.pipelines)) {
            setPipelines(data.pipelines);
          }
        }
      } catch {
        if (!cancelled) setHealth("down");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = result?.image || preview;
  const fileLabel = useMemo(() => (file ? file.name : "Drop a PNG, JPEG, or WebP"), [file]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("pipeline", pipeline);
      const res = await fetch("/api/v1/process", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? `Request failed (${res.status})`);
      }
      setResult(data as ProcessResponse);
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
          <h1>Open-weight vision, split for the cloud</h1>
          <p className="lede">
            Frontend on Vercel. Backend is OpenCV plus Zoo models (YuNet, YOLOX). Classic
            filters run with no weights at all.
          </p>
        </div>
        <div className={`status ${health === "ok" ? "ok" : health === "down" ? "bad" : ""}`}>
          <strong>
            {health === "ok" ? "Backend reachable" : health === "down" ? "Backend offline" : "Checking backend"}
          </strong>
          {opencv ? `OpenCV ${opencv}` : "Set API_URL if this stays red."}
        </div>
      </header>

      <div className="grid">
        <form className="panel" onSubmit={onSubmit}>
          <h2>Input</h2>
          <label className="file">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp"
              hidden
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                setResult(null);
                setPreview(next ? URL.createObjectURL(next) : "");
              }}
            />
            {fileLabel}
          </label>

          <div className="pipelines">
            {pipelines.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="pipeline"
                  value={item.id}
                  checked={pipeline === item.id}
                  onChange={() => setPipeline(item.id)}
                />
                <span>
                  {item.label}
                  {item.needs_model ? ` · ${item.needs_model}` : ""}
                </span>
              </label>
            ))}
          </div>

          <button className="run" type="submit" disabled={busy}>
            {busy ? "Running…" : "Run pipeline"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="panel">
          <h2>Result</h2>
          <div className="stage">
            {shown ? (
              <img src={shown} alt={result ? "Pipeline output" : "Upload preview"} />
            ) : (
              <p className="lede">Output lands here.</p>
            )}
          </div>
          {result ? (
            <p className="meta">
              <span>{result.width}×{result.height}</span>
              <span>{result.elapsed_ms} ms</span>
              <span>{result.model ?? "opencv"}</span>
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
                {result.detections.map((det, index) => (
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
