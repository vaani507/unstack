"use client";

import { useEffect, useRef, useState } from "react";
import {
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  useSensoryMode,
  type SensoryMode,
} from "@/lib/sensory-mode";

const MODES: { value: SensoryMode; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "focus", label: "Focus" },
  { value: "low", label: "Low stimulation" },
];

const MODE_PILL_CLASSES =
  "group inline-flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-full border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors " +
  "has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-foreground " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2";

function CheckIndicator() {
  return (
    <span aria-hidden className="flex h-4 w-4 items-center justify-center">
      <svg
        viewBox="0 0 12 12"
        className="h-3 w-3 opacity-0 transition-opacity group-has-[:checked]:opacity-100"
        fill="none"
      >
        <path
          d="M2 6.5 4.8 9l5.2-6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function AppearanceMenu() {
  const {
    mode,
    setMode,
    systemReducedMotion,
    textScale,
    setTextScale,
    breakSound,
    setBreakSound,
  } = useSensoryMode();
  const [open, setOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);

  // Close on outside click or Escape; return focus to the toggle on close.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      firstRadioRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="absolute right-4 top-4 z-50">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="appearance-menu"
        aria-haspopup="true"
        aria-label="Appearance settings"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground transition-colors hover:bg-surface"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
          <circle cx="7" cy="5.5" r="1.6" fill="var(--background)" />
          <circle cx="13" cy="10" r="1.6" fill="var(--background)" />
          <circle cx="8.5" cy="14.5" r="1.6" fill="var(--background)" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id="appearance-menu"
          role="region"
          aria-label="Appearance settings"
          className="absolute right-0 top-14 w-64 rounded-2xl border border-border bg-background p-4 shadow-md"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Sensory mode
          </p>
          <div role="radiogroup" aria-label="Sensory mode" className="mt-3 flex flex-col gap-2">
            {MODES.map((option, index) => (
              <label key={option.value} className={MODE_PILL_CLASSES}>
                <input
                  ref={index === 0 ? firstRadioRef : undefined}
                  type="radio"
                  name="sensory-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  className="sr-only"
                />
                <CheckIndicator />
                {option.label}
              </label>
            ))}
          </div>

          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Text size
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTextScale(textScale - TEXT_SCALE_STEP)}
              disabled={textScale <= TEXT_SCALE_MIN}
              aria-label="Decrease text size"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              A−
            </button>
            <span aria-live="polite" className="min-w-16 flex-1 text-center text-sm tabular-nums text-muted">
              {Math.round(textScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setTextScale(textScale + TEXT_SCALE_STEP)}
              disabled={textScale >= TEXT_SCALE_MAX}
              aria-label="Increase text size"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              A+
            </button>
          </div>

          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Break sound
          </p>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm text-foreground">Chime when a break starts</span>
            <span
              aria-hidden
              role="switch"
              aria-checked={breakSound}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors ${
                breakSound ? "bg-accent" : "bg-surface"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-foreground transition-transform ${
                  breakSound ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
            <input
              type="checkbox"
              checked={breakSound}
              onChange={(event) => setBreakSound(event.target.checked)}
              className="sr-only"
            />
          </label>

          {systemReducedMotion && (
            <p className="mt-4 text-xs text-muted">
              Motion is reduced — set by your system preferences.
            </p>
          )}
        </div>
      )}
    </div>
  );
}