"use client";

import type { StudioStep } from "../lib/studio";
import type { MatcherApi } from "../lib/use-matcher";
import { Breadcrumbs, ChannelBug, LoadMark, SoundFab, Tally, Ticker, Wordmark } from "./chrome";
import { CamToggle, HiddenFile, Shutter, playRoster } from "./controls";
import { Drawer } from "./drawer";
import { LowerThird, MatchActions, RunnerTicks, StickerReel } from "./match-board";
import { OverlayMixer } from "./overlay-mixer";
import { RosterStrip } from "./roster-strip";
import { Stage } from "./stage";

export function StudioDesktop({ api }: { api: MatcherApi }) {
  function onStep(id: StudioStep) {
    if (id === "print") {
      api.setDrawer(api.hybridUrl ? "sticker" : null);
    } else {
      api.setDrawer(null);
    }
  }

  return (
    <div className="studio studio-desktop">
      <header className="desk-top">
        <Wordmark />
        <Breadcrumbs step={api.step} onStep={onStep} />
        <div className="desk-meta">
          <Tally live={api.live} />
          <ChannelBug api={api} />
          <SoundFab api={api} />
        </div>
      </header>

      <div className="desk-grid">
        <aside className="desk-mixer">
          <CamToggle api={api} />
          <label className="dock-btn tall" htmlFor="drop-desktop" aria-disabled={api.live}>
            <span className="glyph drop" aria-hidden="true" />
            <em>DROP</em>
          </label>
          <HiddenFile api={api} inputId="drop-desktop" />
          <OverlayMixer layout="rail" scan={api.scan} onPick={api.chooseScan} />
          <Shutter api={api} />
        </aside>

        <div className="desk-stage">
          <div className="desk-crt">
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
          {api.top ? (
            <div className="desk-under">
              <MatchActions api={api} />
              <RunnerTicks api={api} />
            </div>
          ) : null}
        </div>

        <aside className="desk-cast">
          <span className="cast-spine">CAST</span>
          <RosterStrip axis="y" activeId={api.top?.character.id} onPlay={playRoster} />
        </aside>
      </div>

      <Ticker api={api} />
      {api.error ? <p className="toast">{api.error}</p> : null}
      {api.hybridError ? <p className="toast">{api.hybridError}</p> : null}

      <Drawer open={api.drawer === "sticker"} side="right" label="Print" onClose={() => api.setDrawer(null)}>
        <StickerReel api={api} />
      </Drawer>
    </div>
  );
}
