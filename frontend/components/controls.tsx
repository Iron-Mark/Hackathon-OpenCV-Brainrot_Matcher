"use client";

import type { MatcherApi } from "../lib/use-matcher";

export function HiddenFile({
  api,
  inputId,
}: {
  api: MatcherApi;
  inputId: string;
}) {
  return (
    <input
      id={inputId}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/bmp"
      hidden
      disabled={api.live}
      onChange={(event) => void api.onPickFile(event.target.files?.[0] ?? null)}
    />
  );
}

export function CameraBtn({ api }: { api: MatcherApi }) {
  return (
    <button
      type="button"
      className="btn"
      data-on={api.live ? "1" : "0"}
      aria-label={api.live ? "Stop camera" : "Open camera"}
      aria-pressed={api.live}
      onClick={() => (api.live ? api.stopCamera() : void api.startCamera())}
    >
      {api.live ? "Stop" : "Camera"}
    </button>
  );
}

export function PhotoBtn({ inputId, disabled }: { inputId: string; disabled: boolean }) {
  return (
    <label className="btn" htmlFor={inputId} aria-disabled={disabled}>
      Photo
    </label>
  );
}

export function MatchBtn({ api }: { api: MatcherApi }) {
  const ready = api.hasFrame && api.galleryReady && !api.busy;
  return (
    <button
      type="button"
      className="btn btn-go"
      disabled={!ready}
      aria-label={api.busy ? "Matching" : "Match"}
      onClick={() => void api.analyze()}
    >
      {api.busy ? "…" : "Match"}
    </button>
  );
}

export function MoreBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn" aria-label="More" aria-pressed={open} onClick={onClick}>
      More
    </button>
  );
}
