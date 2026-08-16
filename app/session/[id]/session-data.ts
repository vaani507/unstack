import { countStepsInSession, findNextPendingStep } from "@/lib/steps";
import type { Step } from "@/lib/types";

export interface SessionData {
  sessionId: string;
  stepId: string;
  action: string;
  durationSeconds: number;
  totalSteps: number;
}

export async function loadSessionData(sessionId: string): Promise<SessionData | null> {
  const step = await findNextPendingStep(sessionId);
  if (!step) {
    return null;
  }

  const totalSteps = await countStepsInSession(sessionId);
  const stepTyped = step as Step;

  return {
    sessionId,
    stepId: stepTyped.id,
    action: stepTyped.action,
    durationSeconds: stepTyped.duration_seconds,
    totalSteps,
  };
}