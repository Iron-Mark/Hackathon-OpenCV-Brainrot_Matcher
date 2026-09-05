'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRAINROT_CHARACTERS } from "../lib/characters";
import { warmupClip } from "../lib/clip-match";
import { detectForMatch, detectObjectsOverlay } from "../lib/detect-match";
import { generateHybrid } from "../lib/hybrid";
import { warmupIsolation } from "../lib/isolate";
import { ensureGallery, matchBrainrot, rerankWithVision, type MatchRow } from "../lib/match-brainrot";
import { generateMashup } from "../lib/mashup";
import {
  playMatchComplete,
  setSoundEnabled,
  soundEnabled,
  unlockMatchAudio,
} from "../lib/match-sound";
import { ensureNanoDet } from "../lib/nanodet";
import {
  type PipelineId,
  drawToCanvas,
  fileToImageData,
  isOpenCvReady,
  preloadOpenCv,
  runBrowserPipeline,
} from "../lib/opencv-browser";
import { paintDetections } from "../lib/overlay";
import type { Detection } from "../lib/types";

const SCANS: { id: PipelineId; label: string }[] = [
  { id: "faces", label: "Faces" },
  { id: "objects", label: "Objects" },
  { id: "edges", label: "Edges" },
  { id: "grayscale", label: "Gray" },
  { id: "blur", label: "Blur" },
];

export default function Page() {
  const [engine, setEngine] = useState<"off" | "loading" | "browser" | "failed">("off");
  const [galleryReady, setGalleryReady] = useState(false);
  const [scan, setScan] = useState<PipelineId>("faces");
  const [fileLabel, setFileLabel] = useState("Drop a PNG, JPEG, or WebP");
  const [busy, setBusy] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [scanNote, setScanNote] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [hybridUrl, setHybridUrl] = useState("");
  const [hybridName, setHybridName] = useState("");
  const [hybridKind, setHybridKind] = useState<"sticker" | "ai" | "">("");
  const [hybridBusy, setHybridBusy] = useState(false);
  const [hybridError, setHybridError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const stillRef = useRef<ImageData | null>(null);
  const detectionsRef = useRef<Detection[]>([]);
  const hasFrameRef = useRef(false);
  const cvReadyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const lastUiRef = useRef(0);
  const lastObjectsRef = useRef(0);
  const inferringRef = useRef(false);
  const scanRef = useRef(scan);
  scanRef.current = scan;

  const loadCv = useCallback(() => {
    if (cvReadyRef.current || engine === "browser") {
      return;
    }
    setEngine("loading");
    void preloadOpenCv()
      .then(() => {
        cvReadyRef.current = true;
        setEngine("browser");
      })
      .catch(() => {
        cvReadyRef.current = false;
        setEngine("failed");
      });
  }, [engine]);

  useEffect(() => {
    setSoundOn(soundEnabled());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ensureGallery()
      .then(() => {
        if (!cancelled) {
          setGalleryReady(true);
        }
        warmupIsolation();
        warmupClip();
        void ensureNanoDet().catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Character gallery failed to load");
        }
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
    if (!video || !canvas || video.readyState < 2) {
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
    stillRef.current = frame;
    if (!hasFrameRef.current) {
      hasFrameRef.current = true;
      setHasFrame(true);
    }
    if (inferringRef.current) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    inferringRef.current = true;
    const current = scanRef.current;
    void (async () => {
      try {
        if (current === "objects") {
          const now = performance.now();
          if (now - lastObjectsRef.current > 380) {
            lastObjectsRef.current = now;
            const objects = await detectObjectsOverlay(frame);
            detectionsRef.current = objects;
            paintDetections(canvas, frame, objects);
            if (now - lastUiRef.current > 200) {
              lastUiRef.current = now;
              setFps(Math.round(1000 / Math.max(1, now - lastObjectsRef.current + 380)));
            }
          } else {
            paintDetections(canvas, frame, detectionsRef.current);
          }
        } else if (isOpenCvReady()) {
          const processed = await runBrowserPipeline(frame, current);
          drawToCanvas(canvas, processed.imageData);
          if (current === "faces") {
            detectionsRef.current = processed.detections;
          }
          const now = performance.now();
          if (now - lastUiRef.current > 200) {
            lastUiRef.current = now;
            setFps(processed.elapsedMs > 0 ? Math.round(1000 / processed.elapsedMs) : 0);
          }
        } else {
          drawToCanvas(canvas, frame);
        }
      } catch {
        drawToCanvas(canvas, frame);
      } finally {
        inferringRef.current = false;
      }
    })();
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  async function startCamera() {
    setError("");
    setMatches(null);
    setHybridUrl("");
    setHybridName("");
    setHybridKind("");
    setHybridError("");
    stillRef.current = null;
    detectionsRef.current = [];
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
      setHasFrame(false);
      hasFrameRef.current = false;
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission denied");
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function onPickFile(next: File | null) {
    if (!next) {
      return;
    }
    stopCamera();
    setMatches(null);
    setHybridUrl("");
    setHybridName("");
    setHybridKind("");
    setHybridError("");
    setError("");
    setFileLabel(next.name);
    try {
      const input = await fileToImageData(next);
      stillRef.current = input;
      hasFrameRef.current = true;
      setHasFrame(true);
      const canvas = canvasRef.current;
      if (canvas && scanRef.current === "objects") {
        const objects = await detectObjectsOverlay(input);
        detectionsRef.current = objects;
        paintDetections(canvas, input, objects);
      } else if (canvas && isOpenCvReady() && scanRef.current !== "objects") {
        try {
          const processed = await runBrowserPipeline(input, scanRef.current);
          drawToCanvas(canvas, processed.imageData);
          if (scanRef.current === "faces") {
            detectionsRef.current = processed.detections;
          }
        } catch {
          drawToCanvas(canvas, input);
        }
      } else if (canvas) {
        drawToCanvas(canvas, input);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image");
    }
  }

  async function analyze() {
    const frame = stillRef.current;
    if (!frame) {
      setError("Start the camera or upload a photo first.");
      return;
    }
    setBusy(true);
    setError("");
    setHybridUrl("");
    setHybridName("");
    setHybridKind("");
    setHybridError("");
    setScanNote("On-device match: clothes, pose zones, silhouette. No AI credits.");
    void unlockMatchAudio();
    let winner: MatchRow | undefined;
    try {
      const detections = await Promise.race([
        detectForMatch(frame),
        new Promise<Detection[]>((resolve) => {
          window.setTimeout(() => resolve([]), 6000);
        }),
      ]);
      detectionsRef.current = detections;
      const rows = await Promise.race([
        matchBrainrot(frame, detections),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Match timed out. Try Analyze again.")), 18000);
        }),
      ]);
      setMatches(rows);
      winner = rows[0];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
    if (winner) {
      setSoundPlayed(playMatchComplete(winner.character));
    }
  }

  async function askAi() {
    const frame = stillRef.current;
    if (!frame || !matches) {
      setError("Analyze a photo first, then ask AI to rerank.");
      return;
    }
    setVisionBusy(true);
    setError("");
    setScanNote("Asking AI to rerank — uses AI Gateway credits and is rate limited.");
    try {
      const rows = await rerankWithVision(frame, matches);
      setMatches(rows);
      if (rows[0]) {
        setSoundPlayed(playMatchComplete(rows[0].character));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI rerank failed");
    } finally {
      setVisionBusy(false);
    }
  }

  async function makeSticker(id: string) {
    const frame = stillRef.current;
    if (!frame) {
      setHybridError("Start the camera or upload a photo first.");
      return;
    }
    setHybridBusy(true);
    setHybridError("");
    try {
      const result = await generateMashup(frame, id, detectionsRef.current);
      setHybridUrl(result.image);
      setHybridName(result.name);
      setHybridKind("sticker");
    } catch (err) {
      setHybridError(err instanceof Error ? err.message : "Sticker mashup failed");
    } finally {
      setHybridBusy(false);
    }
  }

  async function brewPaid(id: string) {
    const frame = stillRef.current;
    if (!frame) {
      setHybridError("Start the camera or upload a photo first.");
      return;
    }
    setHybridBusy(true);
    setHybridError("");
    try {
      const result = await generateHybrid(frame, id);
      setHybridUrl(result.image);
      setHybridName(result.name);
      setHybridKind("ai");
    } catch (err) {
      setHybridError(err instanceof Error ? err.message : "AI brew failed");
    } finally {
      setHybridBusy(false);
    }
  }

  const top = matches?.[0];
  const rest = matches?.slice(1, 4);
  const weak = Boolean(top?.reasons.some((reason) => /weak vibe|not a strong lock/i.test(reason)));
  const status = useMemo(() => {
    if (live) {
      return engine === "browser" ? "Live scan" : "Live camera";
    }
    if (!galleryReady) {
      return "Loading character gallery";
    }
    if (engine === "browser") {
      return "Ready to match";
    }
    if (engine === "failed") {
      return "Matcher ready (OpenCV overlay off)";
    }
    return "Matcher ready";
  }, [engine, galleryReady, live]);

  return (
    <main className="shell" data-sound-played={soundPlayed ? "yes" : "no"}>
      <header className="top">
        <div>
          <p className="kicker">brainrot-matcher</p>
          <h1>Which brainrot character is this?</h1>
          <p className="lede">
            Point a camera or drop a photo. Analyze matches clothes, hair, and vibe to the
            costume — not your face — then save a free on-device sticker of you as that mascot.
          </p>
        </div>
        <div className={`status ${galleryReady ? "ok" : ""}`}>
          <strong>{status}</strong>
          {galleryReady ? `${BRAINROT_CHARACTERS.length} characters loaded` : "Fetching gallery…"}
          {live ? <span> · ~{fps} fps</span> : null}
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <h2>Input</h2>
          <div className="live-row">
            <button
              className="run secondary"
              type="button"
              onClick={() => (live ? stopCamera() : startCamera())}
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
              onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
            />
            {live ? "Camera is live — hit Analyze on a pose" : fileLabel}
          </label>

          <p className="scan-label">OpenCV scan overlay</p>
          <div className="scans">
            {SCANS.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="scan"
                  value={item.id}
                  checked={scan === item.id}
                  onChange={() => {
                    setScan(item.id);
                    if (item.id !== "objects") {
                      void loadCv();
                    } else {
                      void ensureNanoDet().catch(() => undefined);
                    }
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>

          <button
            className="run"
            type="button"
            onClick={() => void analyze()}
            disabled={busy || !hasFrame || !galleryReady}
          >
            {busy ? "Analyzing…" : "Analyze match"}
          </button>
          <button
            className="run quiet"
            type="button"
            onClick={() => void askAi()}
            disabled={visionBusy || busy || !matches}
          >
            {visionBusy ? "Asking AI…" : "Ask AI to rerank"}
          </button>
          <p className="hint">
            Analyze is free and on-device. AI rerank uses your Gateway credits and is rate limited.
          </p>
          <button
            className="sound-toggle"
            type="button"
            aria-pressed={soundOn}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              if (next) {
                void unlockMatchAudio();
              }
            }}
          >
            {soundOn ? "Sound on · sting + Italian chant" : "Sound off"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="panel">
          <h2>Scan</h2>
          <div className="stage">
            <video ref={videoRef} playsInline muted hidden />
            <canvas ref={canvasRef} className={hasFrame ? "show" : "hide"} />
            {!hasFrame ? <p className="lede">Start the camera or drop a still.</p> : null}
          </div>
        </section>
      </div>

      {top ? (
        <section className="panel match-panel" data-sound={soundOn ? "on" : "off"} data-weak={weak ? "yes" : "no"}>
          <h2>Match</h2>
          <div className="match-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={top.character.image} alt={top.character.name} />
            <div>
              <p className="kicker">{top.character.origin}</p>
              <h3>{top.character.name}</h3>
              <p className="percent">{top.percent}%</p>
              <p className="lede">{top.character.blurb}</p>
              {weak ? (
                <p className="weak">Closest vibe in the roster — not a confident costume lock.</p>
              ) : null}
              <p className="meta why">
                {top.reasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </p>
              {scanNote ? <p className="meta">{scanNote}</p> : null}
              <div className="match-actions">
                <button
                  className="replay"
                  type="button"
                  data-chant={top.character.id}
                  disabled={!soundOn}
                  onClick={() => {
                    void unlockMatchAudio();
                    setSoundPlayed(playMatchComplete(top.character));
                  }}
                >
                  Replay {top.character.name}
                </button>
                <button
                  className="replay"
                  type="button"
                  disabled={hybridBusy || !hasFrame}
                  onClick={() => void makeSticker(top.character.id)}
                >
                  {hybridBusy && hybridKind !== "ai" ? "Making sticker…" : `Free sticker · ${top.character.name}`}
                </button>
                <button
                  className="replay secondary"
                  type="button"
                  disabled={hybridBusy || !hasFrame}
                  onClick={() => void brewPaid(top.character.id)}
                >
                  {hybridBusy && hybridKind === "ai" ? "Brewing…" : "Brew AI hybrid (credits)"}
                </button>
              </div>
            </div>
          </div>
          {rest && rest.length > 0 ? (
            <ol className="runners">
              {rest.map((row) => (
                <li key={row.character.id}>
                  <button
                    type="button"
                    className="runner-play"
                    onClick={() => {
                      void unlockMatchAudio();
                      playMatchComplete(row.character);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.character.image} alt="" />
                    <span>
                      {row.character.name}
                      <small>{row.percent}%</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          {hybridError ? <p className="error">{hybridError}</p> : null}
          {hybridUrl ? (
            <div className="hybrid">
              <p className="kicker">
                {hybridKind === "ai" ? "AI brew" : "Free sticker"} · you as {hybridName}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hybridUrl} alt={`${hybridName} mashup`} />
              <a className="download" href={hybridUrl} download={`${hybridName || "brainrot"}-mashup.png`}>
                Download mashup
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel roster">
        <h2>Roster</h2>
        <p className="lede">Tap a character to hear the sting and original Italian chant.</p>
        <ul className="roster-grid">
          {BRAINROT_CHARACTERS.map((character) => (
            <li key={character.id}>
              <button
                type="button"
                className="roster-play"
                onClick={() => {
                  void unlockMatchAudio();
                  playMatchComplete(character);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={character.image} alt="" />
                <span>{character.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
