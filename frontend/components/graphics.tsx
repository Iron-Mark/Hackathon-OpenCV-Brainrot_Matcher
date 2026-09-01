export function SoundBars({ on }: { on: boolean }) {
  return (
    <span className={`bars ${on ? "on" : "off"}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function Sprocket() {
  return (
    <span className="sprocket" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function OriginPip({ kind, className = "origin-pip" }: { kind: "it" | "id"; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={kind === "id" ? "/graphics/mark-id.svg" : "/graphics/mark-it.svg"}
      alt=""
    />
  );
}

export function IdentMark({ size = 40 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ident" src="/graphics/ident.svg" alt="" width={size} height={size} />
  );
}
