"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppearanceMenu from "./session/[id]/appearance-menu";

type Energy = "low" | "medium" | "high";
type TimeAvailable = "5min" | "15min" | "30min" | "1hour";

const GOAL_QUESTION = "What's feeling impossible right now?";
const GOAL_PLACEHOLDER = "e.g. I have an exam next week and haven't started studying";
const ENERGY_QUESTION = "How much energy do you have right now?";
const TIME_QUESTION = "How much time do you have?";
const TAGLINE = "Turn overwhelming tasks into one doable thing at a time.";

const ENERGY_OPTIONS: { value: Energy; label: string }[] = [
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
];

const TIME_OPTIONS: { value: TimeAvailable; label: string }[] = [
  { value: "5min", label: "5 min" },
  { value: "15min", label: "15 min" },
  { value: "30min", label: "30 min" },
  { value: "1hour", label: "1 hour" },
];

const PILL_STYLES =
  "group inline-flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-full border border-border bg-transparent px-5 text-sm font-medium text-foreground transition-colors " +
  "has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-foreground " +
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background";

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

export default function Home() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [time, setTime] = useState<TimeAvailable | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const isReady = goal.trim().length > 0 && energy !== null && time !== null;
  const isLoading = status === "loading";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isReady || isLoading) return;

    setStatus("loading");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, energyLevel: energy, timeAvailable: time }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.sessionId) {
        throw new Error("Plan request failed");
      }

      router.push(`/plan?session=${encodeURIComponent(data.sessionId)}`);
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-6 py-16">
      <AppearanceMenu />

      <header className="mb-14">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-accent">
          Unstack
        </p>
        <p className="mt-3 text-sm text-muted">{TAGLINE}</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-10" noValidate>
        <div>
          <label htmlFor="goal" className="mb-3 block text-sm text-muted">
            {GOAL_QUESTION}
          </label>
          <textarea
            id="goal"
            name="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder={GOAL_PLACEHOLDER}
            maxLength={1000}
            required
            className="min-h-40 w-full resize-y rounded-2xl border border-border bg-transparent px-5 py-4 text-base leading-relaxed text-foreground transition-colors placeholder:text-muted/70 focus:border-accent"
          />
        </div>

        <fieldset>
          <legend className="mb-3 text-sm text-muted">{ENERGY_QUESTION}</legend>
          <div className="flex flex-wrap gap-2">
            {ENERGY_OPTIONS.map((option) => (
              <label key={option.value} className={PILL_STYLES}>
                <input
                  type="radio"
                  name="energy"
                  value={option.value}
                  checked={energy === option.value}
                  onChange={() => setEnergy(option.value)}
                  required
                  className="sr-only"
                />
                <CheckIndicator />
                <span className="uppercase">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm text-muted">{TIME_QUESTION}</legend>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((option) => (
              <label key={option.value} className={PILL_STYLES}>
                <input
                  type="radio"
                  name="time"
                  value={option.value}
                  checked={time === option.value}
                  onChange={() => setTime(option.value)}
                  required
                  className="sr-only"
                />
                <CheckIndicator />
                <span className="uppercase">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col items-start gap-4">
          <button
            type="submit"
            disabled={!isReady || isLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-8 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted"
          >
            {isLoading ? (
              <>
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full bg-current animate-pulse [animation-duration:2.4s] motion-reduce:animate-none"
                />
                <span className="sr-only">Creating your plan…</span>
              </>
            ) : (
              "Make it doable"
            )}
          </button>

          {status === "error" && (
            <p role="alert" className="text-sm text-red-700/80 dark:text-red-300/80">
              Something went wrong while creating your plan. Please try again.
            </p>
          )}
        </div>
      </form>

      <Link
        href="/history"
        className="mt-16 self-center text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Past sessions
      </Link>
    </main>
  );
}