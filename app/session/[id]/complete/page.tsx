import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MICRO_LABEL = "Micro-actions completed";
const MINUTES_LABEL = "Minutes spent";
const BREAKS_LABEL = "Breaks taken";
const REASSURANCE =
  "Your original goal is still there. You don't need to finish everything today.";

// Mirrors the break cadence on the session screen (a break after every N
// completed steps). Breaks are derived here because they aren't persisted.
const BREAK_EVERY = 3;

interface CompletePageProps {
  params: Promise<{ id: string }>;
}

interface Stats {
  goal: string;
  completed: number;
  focusedMinutes: number;
  breaks: number;
  splits: number;
  skips: number;
}

async function loadStats(sessionId: string): Promise<Stats | null> {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("goal")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    console.error("[complete] session not found", sessionError);
    return null;
  }

  const { data: steps, error: stepsError } = await supabase
    .from("steps")
    .select("id, status, duration_seconds, created_at, completed_at")
    .eq("session_id", sessionId);

  if (stepsError) {
    console.error("[complete] failed to load steps", stepsError);
    return null;
  }

  const done = (steps ?? []).filter((step) => step.status === "done");
  const completed = done.length;

  // Real wall-clock span: from the session's earliest step to its last done
  // step. Falls back to the sum of step durations when timestamps are odd.
  const focusedSeconds = done.reduce(
    (sum, step) => sum + (Number(step.duration_seconds) || 0),
    0
  );
  const earliestStart = Math.min(
    ...(steps ?? []).map((step) => Date.parse(step.created_at)).filter(Number.isFinite)
  );
  const latestDone = Math.max(
    ...done.map((step) => Date.parse(step.completed_at)).filter(Number.isFinite)
  );
  let focusedMinutes = 0;
  if (completed > 0) {
    if (Number.isFinite(earliestStart) && Number.isFinite(latestDone)) {
      focusedMinutes = Math.max(1, Math.ceil((latestDone - earliestStart) / 60_000));
    } else {
      focusedMinutes = Math.max(1, Math.round(focusedSeconds / 60));
    }
  }

  const breaks = Math.floor(completed / BREAK_EVERY);

  // Surface the adaptation story: how many steps were split/skipped.
  let splits = 0;
  let skips = 0;
  const stepIds = (steps ?? []).map((step) => step.id);
  if (stepIds.length > 0) {
    const { data: feedback, error: feedbackError } = await supabase
      .from("feedback")
      .select("feedback_type")
      .in("step_id", stepIds);
    if (!feedbackError && feedback) {
      splits = feedback.filter((row) => row.feedback_type === "too_hard").length;
      skips = feedback.filter((row) => row.feedback_type === "skip").length;
    }
  }

  return { goal: session.goal, completed, focusedMinutes, breaks, splits, skips };
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-2xl font-medium tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

export default async function CompletePage({ params }: CompletePageProps) {
  const { id } = await params;
  const stats = await loadStats(id);

  if (!stats) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
          Unstack
        </p>
        <h1 className="mt-12 text-xl font-medium text-foreground">
          We couldn&apos;t find that session.
        </h1>
        <p className="mt-3 text-sm text-muted">It may have been removed.</p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-11 items-center justify-center self-center rounded-full bg-accent px-8 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted"
        >
          Continue later
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
        Unstack
      </p>

      <h1 className="mt-12 text-4xl font-semibold leading-snug text-foreground">
        You moved forward.
      </h1>

      <div className="mt-12 flex items-start justify-center gap-8">
        <Stat value={stats.completed} label={MICRO_LABEL} />
        <Stat value={stats.focusedMinutes} label={MINUTES_LABEL} />
        <Stat value={stats.breaks} label={BREAKS_LABEL} />
      </div>

      {stats.splits > 0 && (
        <p className="mt-10 max-w-md text-sm leading-relaxed text-muted">
          {stats.splits} step{stats.splits === 1 ? "" : "s"} felt too hard, so we split{" "}
          {stats.splits === 1 ? "it" : "them"} into smaller ones. That&apos;s the plan working
          with you.
        </p>
      )}
      {stats.skips > 0 && (
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          You skipped {stats.skips} step{stats.skips === 1 ? "" : "s"}. That&apos;s okay too.
        </p>
      )}

      <p className="mt-12 text-sm text-muted">{REASSURANCE}</p>

      <Link
        href="/"
        className="mt-12 inline-flex min-h-11 items-center justify-center self-center rounded-full bg-accent px-8 text-sm font-medium uppercase tracking-wide text-accent-foreground transition-colors"
      >
        Continue later
      </Link>
    </main>
  );
}