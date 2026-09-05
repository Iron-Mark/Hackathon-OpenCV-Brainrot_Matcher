"use client";

import type { MatcherApi } from "../lib/use-matcher";
import { IdentMark } from "./graphics";

export function Wordmark() {
  return (
    <div className="wordmark">
      <IdentMark size={28} />
      <span>
        ROT
        <em>·</em>
        TV
      </span>
    </div>
  );
}

export function StatusPip({ api }: { api: MatcherApi }) {
  const label = api.busy ? "…" : api.top ? api.top.percent + "%" : api.channel.label === "LIVE" ? "Live" : api.channel.label === "STILL" ? "Photo" : api.galleryReady ? "Ready" : "…";
  return (
    <div className="pip" data-pip={api.top ? "lock" : api.channel.pip}>
      <i />
      <span>{label}</span>
    </div>
  );
}
