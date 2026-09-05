"use client";

import type { MatcherApi } from "../lib/use-matcher";

export function ResultBody({ api }: { api: MatcherApi }) {
  const top = api.top;
  if (!top) {
    return null;
  }
  return (
    <div className="result">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={top.character.image} alt="" />
      <div className="result-copy">
        <b>{top.percent}</b>
        <strong>{top.character.name}</strong>
      </div>
      <div className="result-acts">
        <button type="button" className="btn" data-chant={top.character.id} onClick={() => api.replay()}>
          Play
        </button>
        <button
          type="button"
          className="btn btn-go"
          disabled={api.hybridBusy || !api.hasFrame}
          onClick={() => void api.makeSticker(top.character.id)}
        >
          {api.hybridBusy && api.hybridKind !== "ai" ? "…" : "Sticker"}
        </button>
      </div>
      {api.hybridError ? <p className="toast">{api.hybridError}</p> : null}
      {api.hybridUrl ? (
        <a className="save" href={api.hybridUrl} download={`${api.hybridName || "brainrot"}-mashup.png`}>
          Save
        </a>
      ) : null}
    </div>
  );
}
