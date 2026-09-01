"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Side = "bottom" | "right" | "left";

export function Drawer({
  open,
  onClose,
  side,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side: Side;
  label: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const root = panelRef.current;
    const focusable = root?.querySelector<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])");
    focusable?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prior;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={`drawer drawer-${side}`} role="presentation">
      <button className="drawer-scrim" type="button" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="drawer-grip" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
