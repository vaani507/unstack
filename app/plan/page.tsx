import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Session, Step } from "@/lib/types";
import PlanView from "./plan-view";

export const dynamic = "force-dynamic";

interface PlanPageProps {
  searchParams: Promise<{ session?: string }>;
}

async function loadPlan(sessionId: string): Promise<{ session: Session; steps: Step[] } | null> {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select()
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return null;
  }

  const { data: steps, error: stepsError } = await supabase
    .from("steps")
    .select()
    .eq("session_id", sessionId)
    .order("step_number", { ascending: true });

  if (stepsError || !steps || steps.length === 0) {
    return null;
  }

  return { session: session as Session, steps: steps as Step[] };
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
      <PlanView sessionId={plan.session.id} goal={plan.session.goal} steps={plan.steps} />
    </main>
  );
}