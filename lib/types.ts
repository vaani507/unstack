// Core domain types — mirror the Supabase schema (sessions, steps, feedback).
// Keep these in sync with the SQL in the project README / migration files.

export type SensoryMode = "calm" | "focus" | "energize";

export type EnergyLevel = "low" | "medium" | "high";

export type TimeAvailable = "5min" | "15min" | "30min" | "1hour";

export type StepStatus = "pending" | "done" | "skipped" | "too_hard";

export type FeedbackType = "done" | "too_hard" | "skip";

export interface Session {
  id: string;
  user_id: string | null;
  goal: string;
  energy_level: EnergyLevel | string | null;
  time_available: TimeAvailable | string | null;
  sensory_mode: SensoryMode | string;
  created_at: string;
  completed_at: string | null;
}

export interface Step {
  id: string;
  session_id: string;
  step_number: number;
  action: string;
  duration_seconds: number;
  status: StepStatus;
  difficulty: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Feedback {
  id: string;
  step_id: string;
  feedback_type: FeedbackType;
  created_at: string;
}

// Convenience shape for a session with its steps loaded together,
// useful for the plan/session screens.
export interface SessionWithSteps extends Session {
  steps: Step[];
}
