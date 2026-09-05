"use client";

import type { MatcherApi } from "../lib/use-matcher";
import { OverlayMixer } from "./overlay-mixer";

export function MoreSheet({ api }: { api: MatcherApi }) {
  return (
    <div className="more">
      <OverlayMixer scan={api.scan} onPick={api.chooseScan} />
      <button
        type="button"
        className="btn"
        aria-pressed={api.soundOn}
        onClick={api.toggleSound}
      >
        {api.soundOn ? "Sound on" : "Sound off"}
      </button>
    </div>
  );
}
