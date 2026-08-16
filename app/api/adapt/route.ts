import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { validateStep, type PlannerStep } from "@/lib/planner";
import { supabase } from "@/lib/supabase";
import { findNextPendingStep, logFeedback } from "@/lib/steps";
import type { Step } from "@/lib/types";

// POST /api/adapt
// Body: { sessionId, stepId, feedbackType: "too_hard" | "skip" }
//
// too_hard: generates a smaller sub-step for the current step via OpenAI,
//   runs it through the Phase 1 validator, inserts it as the next step
//   (shifting later step_numbers), logs feedback_type "too_hard", and
//   returns the new step.
// skip: marks the current step "skipped", logs feedback_type "skip", and
//   returns the next pending step (or null if none remain).

const ADAPT_MODEL = process.env.OPENAI_PLANNER_MODEL || "gpt-4o-mini";
const MAX_RETRIES = 2;

const FEEDBACK_TYPES = ["too_hard", "skip"] as const;
type AdaptFeedbackType = (typeof FEEDBACK_TYPES)[number];

interface AdaptRequestBody {
  sessionId?: unknown;
  stepId?: unknown;
  feedbackType?: unknown;
}

function buildAdaptPrompt(action: string, reason?: string): string {
  const base = `The user found this step too hard: '${action}'. Generate ONE even smaller sub-step that takes 30-60 seconds and requires near-zero effort to start. It should be a physically or cognitively trivial first move toward the original step. Return ONLY JSON: { action: string, duration_seconds: number }`;
  return reason ? `${base} Previous attempt was rejected: ${reason}` : base;
}

function coerceSubStep(raw: unknown): PlannerStep {
  if (typeof raw !== "object" || raw === null) {
    return { action: "", duration_seconds: Number.NaN };
  }
  const { action, duration_seconds } = raw as Record<string, unknown>;
  return {
    action: typeof action === "string" ? action.trim() : "",
    duration_seconds: typeof duration_seconds === "number" ? duration_seconds : Number.NaN,
  };
}

async function generateSubStep(action: string, reason?: string): Promise<PlannerStep> {
  const completion = await openai.chat.completions.create({
    model: ADAPT_MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildAdaptPrompt(action, reason) }],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Adapt model returned an empty response");
  }

  try {
    return coerceSubStep(JSON.parse(raw));
  } catch {
    throw new Error("Adapt model returned invalid JSON");
  }
}

async function fetchStepInSession(sessionId: string, stepId: string): Promise<Step | null> {
  const { data, error } = await supabase
    .from("steps")
    .select()
    .eq("id", stepId)
    .eq("session_id", sessionId)
    .single();

  if (error) {
    console.error("[api/adapt] failed to fetch step", error);
    return null;
  }
  return (data as Step | null) ?? null;
}

export async function POST(request: NextRequest) {
  let body: AdaptRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const stepId = typeof body.stepId === "string" ? body.stepId.trim() : "";
  const feedbackType = body.feedbackType as AdaptFeedbackType;

  if (!sessionId) {
    return NextResponse.json({ error: "`sessionId` is required" }, { status: 400 });
  }
  if (!stepId) {
    return NextResponse.json({ error: "`stepId` is required" }, { status: 400 });
  }
  if (!FEEDBACK_TYPES.includes(feedbackType)) {
    return NextResponse.json(
      { error: `\`feedbackType\` must be one of: ${FEEDBACK_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const currentStep = await fetchStepInSession(sessionId, stepId);
  if (!currentStep) {
    return NextResponse.json({ error: "Step not found in this session" }, { status: 404 });
  }

  if (feedbackType === "skip") {
    const { error: updateError } = await supabase
      .from("steps")
      .update({ status: "skipped" })
      .eq("id", currentStep.id);

    if (updateError) {
      console.error("[api/adapt] failed to mark step skipped", updateError);
      return NextResponse.json({ error: "Failed to update step" }, { status: 500 });
    }

    try {
      await logFeedback(currentStep.id, "skip");
    } catch {
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    let nextStep: Step | null;
    try {
      nextStep = await findNextPendingStep(sessionId);
    } catch {
      return NextResponse.json({ error: "Failed to load session steps" }, { status: 500 });
    }

    return NextResponse.json({ step: nextStep });
  }

  // feedbackType === "too_hard"
  let candidate: PlannerStep;
  try {
    candidate = await generateSubStep(currentStep.action);
  } catch (err) {
    console.error("[api/adapt] sub-step generation failed", err);
    return NextResponse.json({ error: "Failed to generate a smaller sub-step" }, { status: 502 });
  }

  let result = validateStep(candidate);
  let attempts = 0;
  while (!result.valid && attempts < MAX_RETRIES) {
    attempts++;
    try {
      candidate = await generateSubStep(currentStep.action, result.reason ?? "invalid step");
    } catch {
      // Generation retry failed (network/parsing) — stop retrying and fail below.
      result = { valid: false, reason: "regeneration call failed" };
      break;
    }
    result = validateStep(candidate);
  }

  if (!result.valid) {
    console.error("[api/adapt] sub-step failed validation", result.reason);
    return NextResponse.json({ error: "Generated sub-step failed validation" }, { status: 502 });
  }

  // Make room for the new step right after the current one.
  const { data: laterSteps, error: shiftReadError } = await supabase
    .from("steps")
    .select("id, step_number")
    .eq("session_id", sessionId)
    .gt("step_number", currentStep.step_number);

  if (shiftReadError) {
    console.error("[api/adapt] failed to read later steps", shiftReadError);
    return NextResponse.json({ error: "Failed to adapt step" }, { status: 500 });
  }

  for (const step of laterSteps ?? []) {
    const { error: shiftError } = await supabase
      .from("steps")
      .update({ step_number: step.step_number + 1 })
      .eq("id", step.id);
    if (shiftError) {
      console.error("[api/adapt] failed to shift step numbers", shiftError);
      return NextResponse.json({ error: "Failed to adapt step" }, { status: 500 });
    }
  }

  const { data: newStep, error: insertError } = await supabase
    .from("steps")
    .insert({
      session_id: sessionId,
      step_number: currentStep.step_number + 1,
      action: candidate.action,
      duration_seconds: candidate.duration_seconds,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !newStep) {
    console.error("[api/adapt] failed to insert sub-step", insertError);
    return NextResponse.json({ error: "Failed to save sub-step" }, { status: 500 });
  }

  // The current step was deemed too hard — take it out of the pending queue
  // so the new sub-step is what the session picks up next.
  const { error: markError } = await supabase
    .from("steps")
    .update({ status: "too_hard" })
    .eq("id", currentStep.id);

  if (markError) {
    console.error("[api/adapt] failed to mark step too_hard", markError);
    return NextResponse.json({ error: "Failed to update step" }, { status: 500 });
  }

  try {
    await logFeedback(currentStep.id, "too_hard");
  } catch {
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ step: newStep });
}