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
    <div className={`crt ${live ? "is-live" : ""} ${busy ? "is-busy" : ""}`} data-frame={hasFrame ? "on" : "off"}>
      <div className="crt-bezel">
        <div className="crt-screen">
          <video ref={videoRef} playsInline muted hidden />
          <canvas ref={canvasRef} className={hasFrame ? "show" : "hide"} />
          {!hasFrame ? (
            <div className="crt-idle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="bars-img" src="/graphics/bars.svg" alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="reticle" src="/graphics/reticle.svg" alt="" />
            </div>
          ) : null}
          {busy ? <div className="scanlines" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  );
}
