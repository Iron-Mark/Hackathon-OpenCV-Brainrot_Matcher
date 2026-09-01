"use client";

import { useEffect, useState } from "react";
import type { StudioViewport } from "../lib/studio";
import { useMatcher } from "../lib/use-matcher";
import { StudioDesktop } from "./studio-desktop";
import { StudioMobile } from "./studio-mobile";
import { StudioTablet } from "./studio-tablet";

function useStudioViewport(): StudioViewport {
  const [viewport, setViewport] = useState<StudioViewport>("mobile");

  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 720px)");
    const desktop = window.matchMedia("(min-width: 1100px)");
    const apply = () => {
      if (desktop.matches) {
        setViewport("desktop");
      } else if (tablet.matches) {
        setViewport("tablet");
      } else {
        setViewport("mobile");
      }
    };
    apply();
    tablet.addEventListener("change", apply);
    desktop.addEventListener("change", apply);
    return () => {
      tablet.removeEventListener("change", apply);
      desktop.removeEventListener("change", apply);
    };
  }, []);

  return viewport;
}

export function MatcherStudio() {
  const api = useMatcher();
  const viewport = useStudioViewport();

  return (
    <main className="root" data-vp={viewport} data-drawer={api.drawer ?? "none"} data-sound-played={api.soundPlayed ? "yes" : "no"}>
      {viewport === "desktop" ? <StudioDesktop api={api} /> : null}
      {viewport === "tablet" ? <StudioTablet api={api} /> : null}
      {viewport === "mobile" ? <StudioMobile api={api} /> : null}
    </main>
  );
}
