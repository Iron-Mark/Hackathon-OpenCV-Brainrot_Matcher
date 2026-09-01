"use client";

import { playMatchComplete, unlockMatchAudio } from "../lib/match-sound";
import { originKind } from "../lib/studio";
import type { MatcherApi } from "../lib/use-matcher";
import { OriginPip } from "./graphics";

export function ScoreDial({ percent, weak }: { percent: number; weak: boolean }) {
  const angle = Math.max(8, Math.min(100, percent)) * 3.6;
  return (
    <div className={`dial ${weak ? "weak" : "lock"}`} style={{ "--arc": `${angle}deg` } as never}>
      <strong>{percent}</strong>
      <em>%</em>
    </div>
  );
}

export function LowerThird({ api }: { api: MatcherApi }) {
  const top = api.top;
  if (!top) {
    return null;
  }
  const kind = originKind(top.character.origin);
  return (
    <div className="lower-third" data-kind={kind} data-weak={api.weak ? "1" : "0"}>
      <ScoreDial percent={top.percent} weak={api.weak} />
      <div className="lt-copy">
        <OriginPip kind={kind} className="lt-flag" />
        <strong>{top.character.name}</strong>
      </div>
    </div>
  );
}

export function MatchActions({ api }: { api: MatcherApi }) {
  const top = api.top;
  if (!top) {
    return null;
  }
  return (
    <div className="act-row">
      <button
        type="button"
        className="act"
        data-kind="play"
        disabled={!api.soundOn}
        data-chant={top.character.id}
        onClick={() => api.replay()}
      >
        ▶
      </button>
      <button
        type="button"
        className="act"
        data-kind="print"
        disabled={api.hybridBusy || !api.hasFrame}
        onClick={() => void api.makeSticker(top.character.id)}
      >
        {api.hybridBusy && api.hybridKind !== "ai" ? "…" : "PRINT"}
      </button>
      <button
        type="button"
        className="act"
        data-kind="brew"
        disabled={api.hybridBusy || !api.hasFrame}
        onClick={() => void api.brewPaid(top.character.id)}
      >
        {api.hybridBusy && api.hybridKind === "ai" ? "…" : "BREW"}
      </button>
      <button
        type="button"
        className="act"
        data-kind="ai"
        disabled={api.visionBusy || api.busy || !api.matches}
        onClick={() => void api.askAi()}
      >
        {api.visionBusy ? "…" : "AI"}
      </button>
    </div>
  );
}

export function RunnerTicks({ api }: { api: MatcherApi }) {
  if (!api.rest.length) {
    return null;
  }
  return (
    <ol className="ticks">
      {api.rest.map((row) => (
        <li key={row.character.id}>
          <button
            type="button"
            onClick={() => {
              void unlockMatchAudio();
              playMatchComplete(row.character);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.character.image} alt="" />
            <b>{row.percent}</b>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function StickerReel({ api }: { api: MatcherApi }) {
  if (!api.hybridUrl) {
    return null;
  }
  return (
    <figure className="reel">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={api.hybridUrl} alt="" />
      <a href={api.hybridUrl} download={`${api.hybridName || "brainrot"}-mashup.png`}>
        {api.hybridKind === "ai" ? "AI" : "FREE"} ↓
      </a>
    </figure>
  );
}

export function MatchDrawerBody({ api }: { api: MatcherApi }) {
  const top = api.top;
  if (!top) {
    return <p className="empty-note">No lock yet.</p>;
  }
  return (
    <div className="match-body">
      <div className="match-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="match-still" src={top.character.image} alt="" />
        <ScoreDial percent={top.percent} weak={api.weak} />
      </div>
      <h2>{top.character.name}</h2>
      <span className="lock-pip" data-kind={originKind(top.character.origin)} />
      <MatchActions api={api} />
      <RunnerTicks api={api} />
      {api.hybridError ? <p className="err">{api.hybridError}</p> : null}
      <StickerReel api={api} />
    </div>
  );
}
