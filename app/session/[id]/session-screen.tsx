"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSensoryMode } from "@/lib/sensory-mode";
import type { SessionData } from "./session-data";
import type { Step } from "@/lib/types";
import AppearanceMenu from "./appearance-menu";

const RIGHT_NOW_LABEL = "Right now";
const REASSURANCE = "That's it. Nothing else.";
const SMALLER_LINE = "That's okay. Let's make it smaller.";
const SMALLER_DURATION_MS = 2000;

// Break-enforcement config.
const COMPLETED_STEPS_PER_BREAK = 3; // Show a break after every N completed steps.
const BREAK_DURATION_MS = 60_000; // Break length in ms (60 seconds).
// Safety valve: to let the user skip the break, set this to the minimum
// time (in ms) that must elapse first, e.g. 20_000 for a 20-second floor.
// null (the default) = no skip button — the break must finish first.
const BREAK_SKIP_AFTER_MS: number | null = null;

const BREAK_LINES = [
  "Look away from the screen.",
  "Stretch your shoulders.",
  "Take a sip of water.",
];

type Phase = "not-started" | "running" | "transitioning" | "break";

interface Props {
  sessionId: string;
  initialData: SessionData | null;
}

function formatClock(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function SessionScreen({ sessionId, initialData }: Props) {
  const router = useRouter();
  const { mode } = useSensoryMode();

  const isFocus = mode === "focus";
  const isLow = mode === "low";

  // Current step data. Null = no step loaded yet.
  const [stepId, setStepId] = useState<string | null>(initialData?.stepId ?? null);
  const [action, setAction] = useState<string | null>(initialData?.action ?? null);
  const [durationMs, setDurationMs] = useState((initialData?.durationSeconds ?? 0) * 1000);
  const [totalSteps, setTotalSteps] = useState(initialData?.totalSteps ?? 0);

  // Session flow state.
  const [phase, setPhase] = useState<Phase>("not-started");
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which number step we're on (for the "01 / 08" counter).
  const [stepIndex, setStepIndex] = useState(1);

  // Break-enforcement state.
  const [completedCount, setCompletedCount] = useState(0);
  const [breakRemainingMs, setBreakRemainingMs] = useState(BREAK_DURATION_MS);
  const [breakMinutes, setBreakMinutes] = useState(0);

  // Refs that mirror values the countdown loop needs without re-creating it.
  const remainingMsRef = useRef(remainingMs);
  const endRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const breakEndRef = useRef(0);
  const breakRafRef = useRef<number | null>(null);
  const breakRemainingMsRef = useRef(BREAK_DURATION_MS);
  const pendingNextRef = useRef<Step | null>(null);
  const sessionStartRef = useRef(0);

  const timeUp = remainingMs <= 0;

  const applyStep = useCallback((step: Step) => {
    setStepId(step.id);
    setAction(step.action);
    setDurationMs(step.duration_seconds * 1000);
    setRemainingMs(step.duration_seconds * 1000);
    remainingMsRef.current = step.duration_seconds * 1000;
  }, []);

  // Loads a step into the "not-started" (STATE A) view.
  const loadNext = useCallback(
    (next: Step) => {
      setStepIndex((i) => i + 1);
      applyStep(next);
      setPhase("not-started");
    },
    [applyStep]
  );

  const gotoNextOrComplete = useCallback(
    (next: Step | null) => {
      if (!next) {
        router.push(`/session/${sessionId}/complete`);
        return;
      }
      loadNext(next);
    },
    [router, sessionId, loadNext]
  );

  // Clock: drive the countdown against an end timestamp via rAF so it stays
  // accurate even if timers are throttled. Never auto-completes on zero.
  useEffect(() => {
    if (phase !== "running") {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    endRef.current = performance.now() + remainingMsRef.current;

    const tick = () => {
      const left = Math.max(0, endRef.current - performance.now());
      remainingMsRef.current = left;
      setRemainingMs(left);
      if (left > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [phase]);

  // Break countdown: 60 seconds, then automatically load the pending step
  // into STATE A. No skip by default (see BREAK_SKIP_AFTER_MS).
  useEffect(() => {
    if (phase !== "break") {
      if (breakRafRef.current !== null) {
        cancelAnimationFrame(breakRafRef.current);
        breakRafRef.current = null;
      }
      return;
    }

    breakEndRef.current = performance.now() + breakRemainingMsRef.current;

    const tick = () => {
      const left = Math.max(0, breakEndRef.current - performance.now());
      breakRemainingMsRef.current = left;
      setBreakRemainingMs(left);
      if (left > 0) {
        breakRafRef.current = requestAnimationFrame(tick);
      } else {
        breakRafRef.current = null;
        const next = pendingNextRef.current;
        pendingNextRef.current = null;
        if (next) loadNext(next);
      }
    };

    breakRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (breakRafRef.current !== null) {
        cancelAnimationFrame(breakRafRef.current);
        breakRafRef.current = null;
      }
    };
  }, [phase, loadNext]);

  function handleStart() {
    if (sessionStartRef.current === 0) sessionStartRef.current = Date.now();
    setRemainingMs(durationMs);
    remainingMsRef.current = durationMs;
    endRef.current = performance.now() + durationMs;
    setPhase("running");
  }

  function handleSkipBreak() {
    if (!showSkipBreak) return;
    if (breakRafRef.current !== null) {
      cancelAnimationFrame(breakRafRef.current);
      breakRafRef.current = null;
    }
    const next = pendingNextRef.current;
    pendingNextRef.current = null;
    if (next) loadNext(next);
  }

  async function handleDone() {
    if (!stepId || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/step/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error("complete failed");

      const next = data?.step ?? null;
      if (!next) {
        gotoNextOrComplete(null);
        return;
      }

      // Only actually completed steps count toward break enforcement.
      const newCount = completedCount + 1;
      setCompletedCount(newCount);

      if (newCount % COMPLETED_STEPS_PER_BREAK === 0) {
        pendingNextRef.current = next;
        setBreakRemainingMs(BREAK_DURATION_MS);
        breakRemainingMsRef.current = BREAK_DURATION_MS;
        setBreakMinutes(
          Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60000))
        );
        setPhase("break");
      } else {
        loadNext(next);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTooHard() {
    if (!stepId || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, stepId, feedbackType: "too_hard" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.step) throw new Error("adapt failed");

      // A new sub-step was inserted into the session.
      setTotalSteps((total) => total + 1);
      setPhase("transitioning");

      window.setTimeout(() => {
        loadNext(data.step as Step);
      }, SMALLER_DURATION_MS);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSkip() {
    if (!stepId || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, stepId, feedbackType: "skip" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error("skip failed");
      gotoNextOrComplete(data?.step ?? null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!initialData || !action || !stepId) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
          Unstack
        </p>
        <h1 className="mt-12 text-xl font-medium text-foreground">
          This session is already finished.
        </h1>
        <p className="mt-3 text-sm text-muted">There are no more steps to do here.</p>
      </main>
    );
  }

  const progressPct =
    phase === "running" && durationMs > 0
      ? Math.min(100, ((durationMs - remainingMs) / durationMs) * 100)
      : 0;

  const breakProgressPct =
    phase === "break"
      ? Math.min(100, ((BREAK_DURATION_MS - breakRemainingMs) / BREAK_DURATION_MS) * 100)
      : 0;

  const showSkipBreak =
    BREAK_SKIP_AFTER_MS !== null &&
    BREAK_DURATION_MS - breakRemainingMs >= BREAK_SKIP_AFTER_MS;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <AppearanceMenu />

      {/* Step counter — small, top corner, subordinate. Hidden before start,
          during break, and in Focus mode. */}
      <p
        aria-hidden={phase === "not-started" || phase === "break" || isFocus}
        className={`self-end text-[11px] font-medium tabular-nums text-muted/70 transition-opacity duration-300 ${
          phase === "not-started" || phase === "break" || isFocus
            ? "opacity-0"
            : "opacity-100"
        }`}
      >
        {String(stepIndex).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
      </p>

      <div className="mt-12 flex w-full max-w-lg flex-col items-center">
        {phase === "break" ? (
          <div className="flex w-full flex-col items-center text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
              Time for a break
            </p>
            <p className="mt-8 text-2xl font-medium text-foreground">
              You&apos;ve been working for {breakMinutes}{" "}
              {breakMinutes === 1 ? "minute" : "minutes"}.
            </p>
            <ul className="mt-8 flex flex-col items-center gap-3 text-base text-muted">
              {BREAK_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-10 font-mono text-5xl font-medium tabular-nums tracking-tight text-foreground">
              {formatClock(breakRemainingMs)}
            </p>
            <div
              role="progressbar"
              aria-label="Break countdown"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(breakProgressPct)}
              className="mt-8 h-1 w-full overflow-hidden rounded-full bg-surface"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear"
                style={{ width: `${breakProgressPct}%` }}
              />
            </div>
            {showSkipBreak && (
              <button
                type="button"
                onClick={handleSkipBreak}
                className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-8 text-xs font-medium uppercase tracking-wide text-muted transition-colors hover:text-foreground"
              >
                Skip break
              </button>
            )}
          </div>
        ) : phase === "transitioning" ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
              {RIGHT_NOW_LABEL}
            </p>
            <p className="mt-8 text-2xl font-medium text-foreground">{SMALLER_LINE}</p>
          </>
        ) : (
          <>
            {!isFocus && (
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
                {RIGHT_NOW_LABEL}
              </p>
            )}

            <h1
              className={`${isFocus ? "mt-6" : "mt-8"} text-3xl font-semibold leading-snug text-foreground`}
            >
              {action}
            </h1>

            {phase === "not-started" ? (
              <p className="mt-6 text-sm tabular-nums text-muted">{formatClock(durationMs)}</p>
            ) : (
              <p
                className={`mt-6 font-mono font-medium tabular-nums tracking-tight ${
                  isFocus ? "text-6xl" : "text-5xl"
                } ${isLow ? "text-foreground" : timeUp ? "text-accent" : "text-foreground"}`}
              >
                {formatClock(remainingMs)}
              </p>
            )}

            {!isFocus && (
              <>
                {/* Thin horizontal progress bar */}
                <div
                  role="progressbar"
                  aria-label="Step progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progressPct)}
                  className="mt-8 h-1 w-full overflow-hidden rounded-full bg-surface"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <p className="mt-8 text-sm text-muted">{REASSURANCE}</p>
              </>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-6 text-sm text-red-700/80 dark:text-red-300/80">
            {error}
          </p>
        )}

        {phase === "not-started" && (
          <button
            type="button"
            onClick={handleStart}
            disabled={isBusy}
            className="mt-12 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-12 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start
          </button>
        )}

        {phase === "running" && (
          <div className="mt-12 flex w-full max-w-md flex-col items-stretch gap-3">
            <button
              type="button"
              onClick={handleDone}
              disabled={isBusy}
              className={`inline-flex min-h-12 items-center justify-center rounded-full px-10 text-sm font-semibold uppercase tracking-wide text-accent-foreground transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                timeUp ? "scale-[1.02] bg-accent shadow-md" : "bg-accent shadow-sm"
              }`}
            >
              I&apos;m done
            </button>

            <button
              type="button"
              onClick={handleTooHard}
              disabled={isBusy}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-transparent px-10 text-sm font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              This is too hard
            </button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={isBusy}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-8 text-xs font-medium uppercase tracking-wide text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Skip
            </button>
          </div>
        )}
      </div>

      {/* Screen-reader: announce the new action whenever the step changes. */}
      <p aria-live="polite" className="sr-only">
        {phase === "break"
          ? "Time for a break."
          : action
            ? `Next step: ${action}`
            : ""}
      </p>
    </main>
  );
}