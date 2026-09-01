"use client";

import { BRAINROT_CHARACTERS } from "../lib/characters";
import { originKind, shortName } from "../lib/studio";
import { OriginPip } from "./graphics";

export function RosterStrip({
  axis,
  activeId,
  onPlay,
}: {
  axis: "x" | "y";
  activeId?: string;
  onPlay: (id: string) => void;
}) {
  return (
    <ul className={`film film-${axis}`}>
      {BRAINROT_CHARACTERS.map((character) => {
        const kind = originKind(character.origin);
        return (
          <li key={character.id}>
            <button
              type="button"
              className="ticket"
              data-on={activeId === character.id ? "1" : "0"}
              data-kind={kind}
              onClick={() => onPlay(character.id)}
            >
              <span className="ticket-notch" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.image} alt="" />
              <OriginPip kind={kind} />
              <span className="ticket-name">{shortName(character.name)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
