"use client";

import { BRAINROT_CHARACTERS } from "../lib/characters";
import type { StudioStep } from "../lib/studio";
import type { MatcherApi } from "../lib/use-matcher";
import { IdentMark, SoundBars, Sprocket } from "./graphics";

const STEPS: { id: StudioStep; label: string }[] = [
  { id: "cam", label: "CAM" },
  { id: "scan", label: "SCAN" },
  { id: "lock", label: "LOCK" },
  { id: "print", label: "PRINT" },
];

export function Breadcrumbs({
  step,
  onStep,
}: {
  step: StudioStep;
  onStep: (id: StudioStep) => void;
}) {
  const current = STEPS.findIndex((item) => item.id === step);
  return (
    <nav className="crumbs" aria-label="Studio path">
      <ol>
        {STEPS.map((item, index) => (
          <li key={item.id} data-on={index <= current ? "1" : "0"}>
            {index > 0 ? <span className="crumb-sep" aria-hidden="true" /> : null}
            <button type="button" onClick={() => onStep(item.id)}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              {item.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ChannelBug({ api }: { api: MatcherApi }) {
  return (
    <div className="bug" data-pip={api.channel.pip}>
      <i />
      <strong>{api.channel.label}</strong>
      <span>{api.channel.detail}</span>
    </div>
  );
}

export function Tally({ live }: { live: boolean }) {
  return (
    <span className="tally" data-on={live ? "1" : "0"} aria-hidden={!live}>
      <i />
    </span>
  );
}

export function Wordmark() {
  return (
    <div className="wordmark">
      <IdentMark size={36} />
      <span>
        ROT
        <em>·</em>
        TV
      </span>
    </div>
  );
}

export function Ticker({ api }: { api: MatcherApi }) {
  const bits = [
    api.channel.label,
    api.live ? "ON AIR" : "TAPE",
    api.scan.toUpperCase(),
    api.top ? api.top.character.name.toUpperCase() : "NO LOCK",
    api.soundOn ? "CHANT ON" : "MUTE",
    `${BRAINROT_CHARACTERS.length} MASCOTS`,
    api.scanNote === "ai" ? "AI RERANK" : "ON DEVICE",
  ];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((copy) => (
          <p key={copy}>
            {bits.map((bit) => (
              <span key={`${copy}-${bit}`}>{bit}</span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}

export function SoundFab({ api }: { api: MatcherApi }) {
  return (
    <button
      type="button"
      className="sound-fab"
      aria-pressed={api.soundOn}
      aria-label={api.soundOn ? "Mute chants" : "Enable chants"}
      onClick={api.toggleSound}
    >
      <SoundBars on={api.soundOn} />
    </button>
  );
}

export function LoadMark({ ready }: { ready: boolean }) {
  if (ready) {
    return null;
  }
  return (
    <div className="boot">
      <Sprocket />
    </div>
  );
}

export function StepDots({ step }: { step: StudioStep }) {
  return (
    <ol className="dots" aria-label="Progress">
      {STEPS.map((item) => (
        <li key={item.id} data-on={item.id === step ? "1" : "0"} title={item.label} />
      ))}
    </ol>
  );
}
