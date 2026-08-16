import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { findNextPendingStep, logFeedback } from "@/lib/steps";
import type { Step } from "@/lib/types";

// POST /api/step/complete
// Body: { stepId }
// Marks the step "done" with completed_at = now, logs feedback_type "done",
// and returns the next pending step — or a session-complete flag if none remain.

interface CompleteRequestBody {
  stepId?: unknown;
}

export async function POST(request: NextRequest) {
  let body: CompleteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stepId = typeof body.stepId === "string" ? body.stepId.trim() : "";
  if (!stepId) {
    return NextResponse.json({ error: "`stepId` is required" }, { status: 400 });
  }

  const { data: step, error: stepError } = await supabase
    .from("steps")
    .select()
    .eq("id", stepId)
    .single();

  if (stepError || !step) {
    console.error("[api/step/complete] step not found", stepError);
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("steps")
    .update({ status: "done", completed_at: now })
    .eq("id", step.id);

  if (updateError) {
    console.error("[api/step/complete] failed to mark done", updateError);
    return NextResponse.json({ error: "Failed to update step" }, { status: 500 });
  }

  try {
    await logFeedback(step.id, "done");
  } catch {
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  const sessionId = (step as Step).session_id;

  let nextStep: Step | null;
  try {
    nextStep = await findNextPendingStep(sessionId);
  } catch {
    return NextResponse.json({ error: "Failed to load session steps" }, { status: 500 });
  }

  if (!nextStep) {
    await supabase.from("sessions").update({ completed_at: now }).eq("id", sessionId);
    return NextResponse.json({ step: null, sessionComplete: true });
  }

  return NextResponse.json({ step: nextStep, sessionComplete: false });
}