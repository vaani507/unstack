import Link from "next/link";
import { findNextPendingStep } from "@/lib/steps";
import { supabase } from "@/lib/supabase";
import type { Session, Step } from "@/lib/types";

export const dynamic = "force-dynamic";

const STARTING_POINT_LABEL = "We made a starting point.";
const GOAL_LABEL = "Your goal";
const START_WITH_LABEL = "We'll start with:";
const REASSURANCE = "You don't have to finish everything right now.";

interface PlanPageProps {
  searchParams: Promise<{ session?: string }>;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.round(seconds / 60)} min`;
}

async function loadPlan(sessionId: string): Promise<{ session: Session; step: Step } | null> {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select()
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return null;
  }

  const step = await findNextPendingStep(sessionId);
  if (!step) {
    return null;
  }

  return { session: session as Session, step };
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { session: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">Unstack</p>
        <h1 className="mt-12 text-xl font-medium text-foreground">No plan to show yet.</h1>
        <p className="mt-3 text-sm text-muted">
          Start a new plan from the beginning to make something doable.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-8 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors"
        >
          Make a new plan
        </Link>
      </main>
    );
  }

  const plan = await loadPlan(sessionId);

  if (!plan) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">Unstack</p>
        <h1 className="mt-12 text-xl font-medium text-foreground">We couldn&apos;t find that plan.</h1>
        <p className="mt-3 text-sm text-muted">
          It may have been removed, or the session is already finished.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-8 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors"
        >
          Make a new plan
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
        {STARTING_POINT_LABEL}
      </p>

      <section className="mt-14">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {GOAL_LABEL}
        </h2>
        <p className="mt-3 text-lg font-normal leading-relaxed text-foreground">
          {plan.session.goal}
        </p>
      </section>

      <section className="mt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {START_WITH_LABEL}
        </p>
        <p className="mt-4 text-3xl font-semibold leading-snug text-foreground">
          {plan.step.action}
        </p>

        <p className="mt-6 inline-flex min-h-8 items-center rounded-full border border-border px-4 text-sm text-muted">
          {formatDuration(plan.step.duration_seconds)}
        </p>
      </section>

      <p className="mt-12 text-sm text-muted">{REASSURANCE}</p>

      <Link
        href={`/session/${plan.session.id}`}
        className="mt-12 inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-accent px-8 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors"
      >
        Start
      </Link>
    </main>
  );
}