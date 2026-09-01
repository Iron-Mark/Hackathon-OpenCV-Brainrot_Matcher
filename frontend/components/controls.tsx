"use client";

import { BRAINROT_CHARACTERS } from "../lib/characters";
import { playMatchComplete, unlockMatchAudio } from "../lib/match-sound";
import type { MatcherApi } from "../lib/use-matcher";

export function playRoster(id: string) {
  const character = BRAINROT_CHARACTERS.find((item) => item.id === id);
  if (!character) {
    return;
  }
  void unlockMatchAudio();
  playMatchComplete(character);
}

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

export function Shutter({ api }: { api: MatcherApi }) {
  return (
    <button
      type="button"
      className="shutter"
      disabled={api.busy || !api.hasFrame || !api.galleryReady}
      aria-label={api.busy ? "Analyzing" : "Analyze match"}
      onClick={() => void api.analyze()}
    >
      <span />
    </button>
  );
}

export function CamToggle({ api }: { api: MatcherApi }) {
  return (
    <button
      type="button"
      className="dock-btn"
      data-on={api.live ? "1" : "0"}
      aria-label={api.live ? "Cut camera" : "Open camera"}
      aria-pressed={api.live}
      onClick={() => (api.live ? api.stopCamera() : void api.startCamera())}
    >
      <span className="glyph cam" aria-hidden="true" />
      <em>{api.live ? "CUT" : "CAM"}</em>
    </button>
  );
}
