"use client";

import type { MatcherApi } from "../lib/use-matcher";
import { ChannelBug, LoadMark, SoundFab, StepDots, Wordmark } from "./chrome";
import { CamToggle, HiddenFile, Shutter, playRoster } from "./controls";
import { Drawer } from "./drawer";
import { MatchDrawerBody } from "./match-board";
import { OverlayMixer } from "./overlay-mixer";
import { RosterStrip } from "./roster-strip";
import { Stage } from "./stage";

export function StudioMobile({ api }: { api: MatcherApi }) {
  return (
    <div className="studio studio-mobile">
      <header className="mob-top">
        <Wordmark />
        <StepDots step={api.step} />
        <ChannelBug api={api} />
      </header>

      <div className="mob-stage">
        <Stage
          videoRef={api.videoRef}
          canvasRef={api.canvasRef}
          hasFrame={api.hasFrame}
          live={api.live}
          busy={api.busy}
        />
        <LoadMark ready={api.galleryReady} />
        <div className="mob-float">
          <Shutter api={api} />
        </div>
      </div>

      <nav className="dock" aria-label="Studio">
        <CamToggle api={api} />
        <label className="dock-btn" htmlFor="drop-mobile" data-on={api.fileLabel && !api.live ? "1" : "0"} aria-disabled={api.live}>
          <span className="glyph drop" aria-hidden="true" />
          <em>DROP</em>
        </label>
        <button
          type="button"
          className="dock-btn"
          aria-label="Open mixer"
          aria-pressed={api.drawer === "mixer"}
          data-on={api.drawer === "mixer" ? "1" : "0"}
          onClick={() => api.setDrawer(api.drawer === "mixer" ? null : "mixer")}
        >
          <span className="glyph mix" aria-hidden="true" />
          <em>{api.scan.slice(0, 4).toUpperCase()}</em>
        </button>
        <button
          type="button"
          className="dock-btn"
          aria-label="Open cast"
          aria-pressed={api.drawer === "roster"}
          data-on={api.drawer === "roster" ? "1" : "0"}
          onClick={() => api.setDrawer(api.drawer === "roster" ? null : "roster")}
        >
          <span className="glyph roster" aria-hidden="true" />
          <em>CAST</em>
        </button>
        <SoundFab api={api} />
      </nav>
      <HiddenFile api={api} inputId="drop-mobile" />

      {api.error ? <p className="toast">{api.error}</p> : null}

      <Drawer open={api.drawer === "roster"} side="bottom" label="Cast" onClose={() => api.setDrawer(null)}>
        <RosterStrip axis="x" compact activeId={api.top?.character.id} onPlay={playRoster} />
      </Drawer>
      <Drawer open={api.drawer === "mixer"} side="bottom" label="Mixer" onClose={() => api.setDrawer(null)}>
        <OverlayMixer layout="pads" scan={api.scan} onPick={api.chooseScan} />
      </Drawer>
      <Drawer
        open={api.drawer === "match" || api.drawer === "sticker"}
        side="bottom"
        label="Lock"
        onClose={() => api.setDrawer(null)}
      >
        <MatchDrawerBody api={api} />
      </Drawer>
    </div>
  );
}
