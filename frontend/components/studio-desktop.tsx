"use client";

import type { MatcherApi } from "../lib/use-matcher";
import { StatusPip, Wordmark } from "./chrome";
import { CameraBtn, HiddenFile, MatchBtn, MoreBtn, PhotoBtn } from "./controls";
import { Drawer } from "./drawer";
import { ResultBody } from "./match-board";
import { MoreSheet } from "./more-sheet";
import { Stage } from "./stage";

export function StudioDesktop({ api }: { api: MatcherApi }) {
  return (
    <div className="studio studio-desktop">
      <header className="bar">
        <Wordmark />
        <div className="actions row">
          <CameraBtn api={api} />
          <PhotoBtn inputId="drop-desktop" disabled={api.live} />
          <MatchBtn api={api} />
          <MoreBtn open={api.drawer === "more"} onClick={() => api.setDrawer(api.drawer === "more" ? null : "more")} />
        </div>
        <StatusPip api={api} />
      </header>

      <div className="desk">
        <div className="frame">
          <Stage
            videoRef={api.videoRef}
            canvasRef={api.canvasRef}
            hasFrame={api.hasFrame}
            live={api.live}
            busy={api.busy}
          />
        </div>
        {api.top ? <ResultBody api={api} /> : null}
      </div>
      <HiddenFile api={api} inputId="drop-desktop" />

      {api.error ? <p className="toast">{api.error}</p> : null}

      <Drawer open={api.drawer === "more"} side="right" label="More" onClose={() => api.setDrawer(null)}>
        <MoreSheet api={api} />
      </Drawer>
    </div>
  );
}
