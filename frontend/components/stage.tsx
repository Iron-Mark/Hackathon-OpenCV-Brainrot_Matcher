"use client";

import type { RefObject } from "react";

export function Stage({
  videoRef,
  canvasRef,
  hasFrame,
  live,
  busy,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hasFrame: boolean;
  live: boolean;
  busy: boolean;
}) {
  return (
    <div className={`stage ${live ? "is-live" : ""} ${busy ? "is-busy" : ""}`} data-frame={hasFrame ? "on" : "off"}>
      <video ref={videoRef} playsInline muted hidden />
      <canvas ref={canvasRef} className={hasFrame ? "show" : "hide"} />
      {!hasFrame ? (
        <div className="stage-idle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/graphics/bars.svg" alt="" />
          <i className="stage-plus" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
