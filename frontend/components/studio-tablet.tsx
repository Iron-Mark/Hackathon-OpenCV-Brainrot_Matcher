"use client";

import type { MatcherApi } from "../lib/use-matcher";
import { StatusPip, Wordmark } from "./chrome";
import { CameraBtn, HiddenFile, MatchBtn, MoreBtn, PhotoBtn } from "./controls";
import { Drawer } from "./drawer";
import { ResultBody } from "./match-board";
import { MoreSheet } from "./more-sheet";
import { Stage } from "./stage";

export function StudioTablet({ api }: { api: MatcherApi }) {
  return (
    <div className="studio studio-tablet">
      <header className="bar">
        <Wordmark />
        <div className="actions row">
          <CameraBtn api={api} />
          <PhotoBtn inputId="drop-tablet" disabled={api.live} />
          <MatchBtn api={api} />
        </div>
        <MoreBtn open={api.drawer === "more"} onClick={() => api.setDrawer(api.drawer === "more" ? null : "more")} />
        <StatusPip api={api} />
      </header>

      <div className="frame">
        <Stage
          videoRef={api.videoRef}
          canvasRef={api.canvasRef}
          hasFrame={api.hasFrame}
          live={api.live}
          busy={api.busy}
        />
      </div>
      <HiddenFile api={api} inputId="drop-tablet" />

      {api.error ? <p className="toast">{api.error}</p> : null}

      <Drawer open={api.drawer === "more"} side="right" label="More" onClose={() => api.setDrawer(null)}>
        <MoreSheet api={api} />
      </Drawer>
      <Drawer
        open={api.drawer === "match" || api.drawer === "sticker"}
        side="right"
        label="Match"
        onClose={() => api.setDrawer(null)}
      >
        <ResultBody api={api} />
      </Drawer>
    </div>
  );
}
