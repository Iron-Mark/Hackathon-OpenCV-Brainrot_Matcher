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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gate gate-l" src="/graphics/gate.svg" alt="" />
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="standby" src="/graphics/standby.svg" alt="" />
            </div>
          ) : null}
          <div className="crt-scan" aria-hidden="true" />
          <div className="crt-glass" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="crt-ch" src="/graphics/ch17.svg" alt="" />
          {busy ? <div className="scanlines" aria-hidden="true" /> : null}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gate gate-r" src="/graphics/gate.svg" alt="" />
    </div>
  );
}
