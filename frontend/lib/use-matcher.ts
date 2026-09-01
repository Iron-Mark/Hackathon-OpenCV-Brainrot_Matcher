"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRAINROT_CHARACTERS } from "./characters";
import { warmupClip } from "./clip-match";
import { detectForMatch, detectObjectsOverlay } from "./detect-match";
import { generateHybrid } from "./hybrid";
import { warmupIsolation } from "./isolate";
import { ensureGallery, matchBrainrot, rerankWithVision, type MatchRow } from "./match-brainrot";
import { generateMashup } from "./mashup";
import {
  playMatchComplete,
  setSoundEnabled,
  soundEnabled,
  unlockMatchAudio,
} from "./match-sound";
import { ensureNanoDet } from "./nanodet";
import {
  type PipelineId,
  drawToCanvas,
  fileToImageData,
  isOpenCvReady,
  preloadOpenCv,
  runBrowserPipeline,
} from "./opencv-browser";
import { paintDetections } from "./overlay";
import { studioStep, type StudioDrawer, type StudioStep } from "./studio";
import type { Detection } from "./types";

export function useMatcher() {
  const [engine, setEngine] = useState<"off" | "loading" | "browser" | "failed">("off");
  const [galleryReady, setGalleryReady] = useState(false);
  const [scan, setScan] = useState<PipelineId>("faces");
  const [fileLabel, setFileLabel] = useState("");
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
  const [drawer, setDrawerState] = useState<StudioDrawer>(null);
  const setDrawer = useCallback((next: StudioDrawer) => {
    setDrawerState(next);
  }, []);
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
          setError(err instanceof Error ? err.message : "Gallery failed");
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
      setError(err instanceof Error ? err.message : "Camera denied");
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

  function chooseScan(id: PipelineId) {
    setScan(id);
    if (id !== "objects") {
      void loadCv();
    } else {
      void ensureNanoDet().catch(() => undefined);
    }
    const frame = stillRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas || live) {
      return;
    }
    void (async () => {
      if (id === "objects") {
        const objects = await detectObjectsOverlay(frame);
        detectionsRef.current = objects;
        paintDetections(canvas, frame, objects);
      } else if (isOpenCvReady()) {
        try {
          const processed = await runBrowserPipeline(frame, id);
          drawToCanvas(canvas, processed.imageData);
        } catch {
          drawToCanvas(canvas, frame);
        }
      }
    })();
  }

  async function analyze() {
    const frame = stillRef.current;
    if (!frame) {
      setError("Arm the camera or drop a still first.");
      return;
    }
    setBusy(true);
    setError("");
    setHybridUrl("");
    setHybridName("");
    setHybridKind("");
    setHybridError("");
    setScanNote("local");
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
          window.setTimeout(() => reject(new Error("Match timed out.")), 18000);
        }),
      ]);
      setMatches(rows);
      winner = rows[0];
      setDrawer("match");
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
      setError("Lock a match first.");
      return;
    }
    setVisionBusy(true);
    setError("");
    setScanNote("ai");
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
      setHybridError("Need a frame first.");
      return;
    }
    setHybridBusy(true);
    setHybridError("");
    try {
      const result = await generateMashup(frame, id, detectionsRef.current);
      setHybridUrl(result.image);
      setHybridName(result.name);
      setHybridKind("sticker");
      setDrawer("sticker");
    } catch (err) {
      setHybridError(err instanceof Error ? err.message : "Sticker failed");
    } finally {
      setHybridBusy(false);
    }
  }

  async function brewPaid(id: string) {
    const frame = stillRef.current;
    if (!frame) {
      setHybridError("Need a frame first.");
      return;
    }
    setHybridBusy(true);
    setHybridError("");
    try {
      const result = await generateHybrid(frame, id);
      setHybridUrl(result.image);
      setHybridName(result.name);
      setHybridKind("ai");
      setDrawer("sticker");
    } catch (err) {
      setHybridError(err instanceof Error ? err.message : "AI brew failed");
    } finally {
      setHybridBusy(false);
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      void unlockMatchAudio();
    }
  }

  function replay(row?: MatchRow) {
    const character = row?.character ?? matches?.[0]?.character;
    if (!character) {
      return;
    }
    void unlockMatchAudio();
    setSoundPlayed(playMatchComplete(character));
  }

  const top = matches?.[0];
  const rest = matches?.slice(1, 4) ?? [];
  const weak = Boolean(top?.reasons.some((reason) => /weak vibe|not a strong lock/i.test(reason)));
  const step: StudioStep = studioStep({
    hasFrame,
    live,
    matched: Boolean(top),
    printed: Boolean(hybridUrl),
  });
  const channel = useMemo(() => {
    if (!galleryReady) {
      return { pip: "load" as const, label: "LOAD", detail: "17" };
    }
    if (busy) {
      return { pip: "busy" as const, label: "LOCK", detail: "…" };
    }
    if (live) {
      return { pip: "live" as const, label: "LIVE", detail: fps ? `${fps}` : "CAM" };
    }
    if (hasFrame) {
      return { pip: "still" as const, label: "STILL", detail: fileLabel.slice(0, 18) || "DROP" };
    }
    return { pip: "ready" as const, label: "RDY", detail: `${BRAINROT_CHARACTERS.length}` };
  }, [busy, fileLabel, fps, galleryReady, hasFrame, live]);

  return {
    engine,
    galleryReady,
    scan,
    fileLabel,
    busy,
    visionBusy,
    live,
    hasFrame,
    fps,
    error,
    matches,
    scanNote,
    soundOn,
    soundPlayed,
    hybridUrl,
    hybridName,
    hybridKind,
    hybridBusy,
    hybridError,
    drawer,
    setDrawer,
    videoRef,
    canvasRef,
    top,
    rest,
    weak,
    step,
    channel,
    startCamera,
    stopCamera,
    onPickFile,
    chooseScan,
    analyze,
    askAi,
    makeSticker,
    brewPaid,
    toggleSound,
    replay,
  };
}

export type MatcherApi = ReturnType<typeof useMatcher>;
