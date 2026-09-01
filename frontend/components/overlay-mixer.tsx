"use client";

import { SCANS } from "../lib/studio";
import type { PipelineId } from "../lib/opencv-browser";

export function OverlayMixer({
  scan,
  onPick,
  layout,
}: {
  scan: PipelineId;
  onPick: (id: PipelineId) => void;
  layout: "rail" | "pills" | "pads";
}) {
  return (
    <div className={`mixer mixer-${layout}`} role="radiogroup" aria-label="Scan overlay">
      {SCANS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={scan === item.id}
          className="mix-pad"
          data-on={scan === item.id ? "1" : "0"}
          onClick={() => onPick(item.id)}
        >
          <span className="mix-no">{item.mark}</span>
          <span className="mix-lb">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
