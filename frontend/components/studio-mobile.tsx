"use client";

import type { MatcherApi } from "../lib/use-matcher";
import { StatusPip, Wordmark } from "./chrome";
import { CameraBtn, HiddenFile, MatchBtn, MoreBtn, PhotoBtn } from "./controls";
import { Drawer } from "./drawer";
import { ResultBody } from "./match-board";
import { MoreSheet } from "./more-sheet";
import { Stage } from "./stage";

export function StudioMobile({ api }: { api: MatcherApi }) {
  return (
    <div className="studio studio-mobile">
      <header className="bar">
        <Wordmark />
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

      <div className="actions">
        <CameraBtn api={api} />
        <PhotoBtn inputId="drop-mobile" disabled={api.live} />
        <MoreBtn open={api.drawer === "more"} onClick={() => api.setDrawer(api.drawer === "more" ? null : "more")} />
        <MatchBtn api={api} />
      </div>
      <HiddenFile api={api} inputId="drop-mobile" />

      {api.error ? <p className="toast">{api.error}</p> : null}

      <Drawer open={api.drawer === "more"} side="bottom" label="More" onClose={() => api.setDrawer(null)}>
        <MoreSheet api={api} />
      </Drawer>
      <Drawer
        open={api.drawer === "match" || api.drawer === "sticker"}
        side="bottom"
        label="Match"
        onClose={() => api.setDrawer(null)}
      >
        <ResultBody api={api} />
      </Drawer>
    </div>
  );
}
