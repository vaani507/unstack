import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface HistoryRow {
  id: string;
  goal: string;
  created_at: string | null;
  total: number;
  completed: number;
  splits: number;
  skipped: number;
}

async function loadHistory(): Promise<HistoryRow[]> {
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, goal, created_at")
    .order("created_at", { ascending: false });

  if (sessionsError || !sessions) {
    console.error("[history] failed to load sessions", sessionsError);
    return [];
  }

  const sessionIds = sessions.map((session) => session.id);
  const counts = new Map<string, { total: number; done: number; splits: number; skipped: number }>();
  const stepToSession = new Map<string, string>();

  if (sessionIds.length > 0) {
    const { data: steps, error: stepsError } = await supabase
      .from("steps")
      .select("id, session_id, status")
      .in("session_id", sessionIds);

    if (!stepsError && steps) {
      for (const step of steps) {
        const entry = counts.get(step.session_id) ?? { total: 0, done: 0, splits: 0, skipped: 0 };
        entry.total += 1;
        if (step.status === "done") {
          entry.done += 1;
        }
        counts.set(step.session_id, entry);
        stepToSession.set(step.id, step.session_id);
      }
    }

    const stepIds = [...stepToSession.keys()];
    if (stepIds.length > 0) {
      const { data: feedback, error: feedbackError } = await supabase
        .from("feedback")
        .select("step_id, feedback_type")
        .in("step_id", stepIds);
      if (!feedbackError && feedback) {
        for (const row of feedback) {
          const sessionId = stepToSession.get(row.step_id);
          if (!sessionId) continue;
          const entry = counts.get(sessionId)!;
          if (row.feedback_type === "too_hard") {
            entry.splits += 1;
          } else if (row.feedback_type === "skip") {
            entry.skipped += 1;
          }
        }
      }
    }
  }

  return sessions.map((session) => {
    const entry = counts.get(session.id);
    return {
      id: session.id,
      goal: session.goal,
      created_at: session.created_at,
      total: entry?.total ?? 0,
      completed: entry?.done ?? 0,
      splits: entry?.splits ?? 0,
      skipped: entry?.skipped ?? 0,
    };
  });
}

export default async function HistoryPage() {
  const rows = await loadHistory();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-accent">
            Unstack
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">Past sessions</h1>
        </div>
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          Back
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="mt-12 text-sm text-muted">No past sessions yet.</p>
      ) : (
        <table className="mt-10 w-full text-left">
          <caption className="sr-only">
            Past sessions with step, completion, and adaptation counts
          </caption>
          <thead>
            <tr className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              <th scope="col" className="pb-3 pr-4 font-medium">
                Goal
              </th>
              <th scope="col" className="pb-3 pr-4 text-right font-medium">
                Steps
              </th>
              <th scope="col" className="pb-3 pr-4 text-right font-medium">
                Completed
              </th>
              <th scope="col" className="pb-3 pr-4 text-right font-medium">
                Split
              </th>
              <th scope="col" className="pb-3 text-right font-medium">
                Skipped
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="py-3 pr-4 text-sm text-foreground">{row.goal}</td>
                <td className="py-3 pr-4 text-right text-sm tabular-nums text-muted">
                  {row.total}
                </td>
                <td className="py-3 pr-4 text-right text-sm tabular-nums text-muted">
                  {row.completed}
                </td>
                <td className="py-3 pr-4 text-right text-sm tabular-nums text-muted">
                  {row.splits}
                </td>
                <td className="py-3 text-right text-sm tabular-nums text-muted">
                  {row.skipped}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}