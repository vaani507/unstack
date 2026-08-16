"use client";

import { useState } from "react";
import Link from "next/link";
import type { Step } from "@/lib/types";

const STARTING_POINT_LABEL = "We made a starting point.";
const GOAL_LABEL = "Your goal";
const START_WITH_LABEL = "We'll start with:";
const REASSURANCE = "You don't have to finish everything right now.";
const SHOW_PLAN = "See the whole plan";
const HIDE_PLAN = "Hide the plan";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.round(seconds / 60)} min`;
}

interface PlanViewProps {
  sessionId: string;
  goal: string;
  steps: Step[];
}

export default function PlanView({ sessionId, goal, steps }: PlanViewProps) {
  const [showPlan, setShowPlan] = useState(false);
  const first = steps[0];

  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
        {STARTING_POINT_LABEL}
      </p>

      <section className="mt-14">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {GOAL_LABEL}
        </h2>
        <p className="mt-3 text-lg font-normal leading-relaxed text-foreground">{goal}</p>
      </section>

      <section className="mt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {START_WITH_LABEL}
        </p>
        <p className="mt-4 text-3xl font-semibold leading-snug text-foreground">
          {first.action}
        </p>
        <p className="mt-6 inline-flex min-h-8 items-center rounded-full border border-border px-4 text-sm text-muted">
          {formatDuration(first.duration_seconds)}
        </p>
      </section>

      <button
        type="button"
        aria-expanded={showPlan}
        onClick={() => setShowPlan((open) => !open)}
        className="mt-10 w-fit text-sm text-muted underline-offset-4 transition-colors hover:underline hover:text-foreground"
      >
        {showPlan ? HIDE_PLAN : SHOW_PLAN}
      </button>

      {showPlan && (
        <ol className="mt-5 flex flex-col gap-3">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex items-baseline justify-between gap-4 border-b border-border pb-3 text-sm"
            >
              <span className="flex items-baseline gap-3">
                <span className="text-[11px] font-medium tabular-nums text-muted/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-foreground">{step.action}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {formatDuration(step.duration_seconds)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-12 text-sm text-muted">{REASSURANCE}</p>

      <Link
        href={`/session/${sessionId}`}
        className="mt-12 inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-accent px-8 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors"
      >
        Start
      </Link>
    </>
  );
}