import { supabase } from "./supabase";
import type { FeedbackType, Step } from "./types";

/**
 * Returns the next pending step for a session (lowest step_number first),
 * or null when none remain. Throws on a query failure so callers can decide
 * how to surface the error.
 */
export async function findNextPendingStep(sessionId: string): Promise<Step | null> {
  const { data, error } = await supabase
    .from("steps")
    .select()
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("step_number", { ascending: true })
    .limit(1);

  if (error) {
    console.error("[steps] findNextPendingStep failed", error);
    throw new Error("Failed to load session steps");
  }

  return (data?.[0] as Step | undefined) ?? null;
}

/**
 * Returns the total number of steps in a session. Used for the faint
 * "01 / 08" progress indicator. Throws on failure.
 */
export async function countStepsInSession(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("steps")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[steps] countStepsInSession failed", error);
    throw new Error("Failed to load session steps");
  }

  return count ?? 0;
}

/** Writes a row to `feedback`. Throws on failure so callers can surface it. */
export async function logFeedback(stepId: string, feedbackType: FeedbackType): Promise<void> {
  const { error } = await supabase
    .from("feedback")
    .insert({ step_id: stepId, feedback_type: feedbackType });

  if (error) {
    console.error("[steps] logFeedback failed", error);
    throw new Error("Failed to save feedback");
  }
}