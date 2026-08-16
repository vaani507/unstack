"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type SensoryMode = "calm" | "focus" | "low";

const MODE_KEY = "unstack:sensory-mode";
const SCALE_KEY = "unstack:text-scale";
const BREAK_SOUND_KEY = "unstack:break-sound";

const TEXT_SCALE_MIN = 1;
const TEXT_SCALE_MAX = 1.5;
const TEXT_SCALE_STEP = 0.125;

const SENSORY_MODES: SensoryMode[] = ["calm", "focus", "low"];

function isSensoryMode(value: unknown): value is SensoryMode {
  return typeof value === "string" && (SENSORY_MODES as string[]).includes(value);
}

function clampTextScale(value: number): number {
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
}

// ---------------------------------------------------------------------------
// Tiny external store (compliant with React's purity rules): the provider
// subscribes via useSyncExternalStore and updates the store outside render.
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

let modeValue: SensoryMode = "calm";
let textScaleValue = 1;
let systemReducedValue = false;
let breakSoundValue = false;

function readStored<T>(key: string, parse: (raw: string) => T | null): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : parse(raw);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable — ignore.
  }
}

function setModeStore(next: SensoryMode): void {
  if (modeValue === next) return;
  modeValue = next;
  writeStored(MODE_KEY, next);
  emit();
}

function setTextScaleStore(next: number): void {
  const clamped = clampTextScale(next);
  if (textScaleValue === clamped) return;
  textScaleValue = clamped;
  writeStored(SCALE_KEY, String(clamped));
  emit();
}

function setBreakSoundStore(next: boolean): void {
  if (breakSoundValue === next) return;
  breakSoundValue = next;
  writeStored(BREAK_SOUND_KEY, String(next));
  emit();
}

interface SensoryModeContextValue {
  /** Current manual selection. */
  mode: SensoryMode;
  setMode: (mode: SensoryMode) => void;
  /** True when the OS prefers reduced motion OR the manual mode is "low". */
  reducedMotion: boolean;
  /** True only when the OS-level prefers-reduced-motion is active. */
  systemReducedMotion: boolean;
  /** Root font-size multiplier (100%–150%). */
  textScale: number;
  setTextScale: (multiplier: number) => void;
  /** Opt-in gentle chime when a break starts. */
  breakSound: boolean;
  setBreakSound: (enabled: boolean) => void;
}

const SensoryModeContext = createContext<SensoryModeContextValue | null>(null);

export function SensoryModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, () => modeValue, () => "calm" as const);
  const textScale = useSyncExternalStore(subscribe, () => textScaleValue, () => 1 as const);
  const breakSound = useSyncExternalStore(
    subscribe,
    () => breakSoundValue,
    () => false as const
  );
  const systemReducedMotion = useSyncExternalStore(
    subscribe,
    () => systemReducedValue,
    () => false as const
  );

  // Hydrate once from localStorage and subscribe to the OS motion preference.
  // Updating the store (not React state) notifies subscribers on re-render.
  useEffect(() => {
    const storedMode = readStored(MODE_KEY, (raw) => (isSensoryMode(raw) ? raw : null));
    if (storedMode) modeValue = storedMode;

    const storedScale = readStored(SCALE_KEY, (raw) => {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? clampTextScale(parsed) : null;
    });
    if (storedScale !== null) textScaleValue = storedScale;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    systemReducedValue = mql.matches;

    const storedSound = readStored(BREAK_SOUND_KEY, (raw) => (raw === "true" ? true : null));
    if (storedSound !== null) breakSoundValue = storedSound;

    const onChange = (event: MediaQueryListEvent) => {
      systemReducedValue = event.matches;
      emit();
    };
    mql.addEventListener("change", onChange);

    emit();

    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((next: SensoryMode) => setModeStore(next), []);
  const setTextScale = useCallback((next: number) => setTextScaleStore(next), []);
  const setBreakSound = useCallback((next: boolean) => setBreakSoundStore(next), []);

  // OS-level reduced motion wins over the manual toggle for motion settings,
  // regardless of what the user picked.
  const reducedMotion = systemReducedMotion || mode === "low";

  useEffect(() => {
    document.documentElement.dataset.sensoryMode = mode;
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * textScale}px`;
  }, [textScale]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      reducedMotion,
      systemReducedMotion,
      textScale,
      setTextScale,
      breakSound,
      setBreakSound,
    }),
    [mode, setMode, reducedMotion, systemReducedMotion, textScale, setTextScale, breakSound, setBreakSound]
  );

  return <SensoryModeContext.Provider value={value}>{children}</SensoryModeContext.Provider>;
}

export function useSensoryMode(): SensoryModeContextValue {
  const value = useContext(SensoryModeContext);
  if (!value) {
    throw new Error("useSensoryMode must be used within SensoryModeProvider");
  }
  return value;
}

export { TEXT_SCALE_MIN, TEXT_SCALE_MAX, TEXT_SCALE_STEP };