"use client";

import type { StudioStep } from "../lib/studio";
import type { MatcherApi } from "../lib/use-matcher";
import { Breadcrumbs, ChannelBug, LoadMark, SoundFab, Ticker, Wordmark } from "./chrome";
import { CamToggle, HiddenFile, Shutter, playRoster } from "./controls";
import { Drawer } from "./drawer";
import { LowerThird, MatchDrawerBody } from "./match-board";
import { OverlayMixer } from "./overlay-mixer";
import { RosterStrip } from "./roster-strip";
import { Stage } from "./stage";

export function StudioTablet({ api }: { api: MatcherApi }) {
  function onStep(id: StudioStep) {
    if (id === "lock" || id === "print") {
      api.setDrawer(api.top ? "match" : null);
    } else {
      api.setDrawer(null);
    }
  }

  return (
    <div className="studio studio-tablet">
      <header className="tab-top">
        <Wordmark />
        <Breadcrumbs step={api.step} onStep={onStep} />
        <ChannelBug api={api} />
        <SoundFab api={api} />
      </header>

      <div className="tab-body">
        <aside className="tab-rail">
          <CamToggle api={api} />
          <label className="dock-btn tall" htmlFor="drop-tablet" aria-disabled={api.live}>
            <span className="glyph drop" aria-hidden="true" />
            <em>DROP</em>
          </label>
          <HiddenFile api={api} inputId="drop-tablet" />
          <Shutter api={api} />
        </aside>
        <div className="tab-stage">
          <div className="tab-crt">
            <Stage
              videoRef={api.videoRef}
              canvasRef={api.canvasRef}
              hasFrame={api.hasFrame}
              live={api.live}
              busy={api.busy}
            />
            <LowerThird api={api} />
            <LoadMark ready={api.galleryReady} />
          </div>
          <OverlayMixer layout="pills" scan={api.scan} onPick={api.chooseScan} />
        </div>
      </div>

      <div className="tab-strip">
        <RosterStrip axis="x" compact activeId={api.top?.character.id} onPlay={playRoster} />
      </div>
      <Ticker api={api} />
      {api.error ? <p className="toast">{api.error}</p> : null}

      <Drawer
        open={api.drawer === "match" || api.drawer === "sticker"}
        side="right"
        label="Lock"
        onClose={() => api.setDrawer(null)}
      >
        <MatchDrawerBody api={api} />
      </Drawer>
    </div>
  );
}
