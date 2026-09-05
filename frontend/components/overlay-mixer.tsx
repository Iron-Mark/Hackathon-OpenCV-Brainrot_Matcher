"use client";

import { SCANS } from "../lib/studio";
import type { PipelineId } from "../lib/opencv-browser";

export function OverlayMixer({
  scan,
  onPick,
}: {
  scan: PipelineId;
  onPick: (id: PipelineId) => void;
}) {
  return (
    <div className="looks" role="radiogroup" aria-label="Look">
      {SCANS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={scan === item.id}
          className="look"
          data-on={scan === item.id ? "1" : "0"}
          onClick={() => onPick(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
