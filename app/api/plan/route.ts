import { NextRequest, NextResponse } from "next/server";
import { planGoal, type EnergyLevel, type PlannerInput, type TimeAvailable } from "@/lib/planner";
import { supabase } from "@/lib/supabase";

// POST /api/plan
// Body: { goal: string, energyLevel: "low"|"medium"|"high", timeAvailable: "5min"|"15min"|"30min"|"1hour" }
// Runs the AI planning pipeline (lib/planner.ts), persists a session + its
// steps to Supabase, and returns { sessionId, steps }.

const ENERGY_LEVELS: EnergyLevel[] = ["low", "medium", "high"];
const TIME_OPTIONS: TimeAvailable[] = ["5min", "15min", "30min", "1hour"];

interface PlanRequestBody {
  goal?: unknown;
  energyLevel?: unknown;
  timeAvailable?: unknown;
}

export async function POST(request: NextRequest) {
  let body: PlanRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const energyLevel = body.energyLevel as EnergyLevel;
  const timeAvailable = body.timeAvailable as TimeAvailable;

  if (!goal) {
    return NextResponse.json({ error: "`goal` is required" }, { status: 400 });
  }
  if (!ENERGY_LEVELS.includes(energyLevel)) {
    return NextResponse.json(
      { error: `\`energyLevel\` must be one of: ${ENERGY_LEVELS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!TIME_OPTIONS.includes(timeAvailable)) {
    return NextResponse.json(
      { error: `\`timeAvailable\` must be one of: ${TIME_OPTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const input: PlannerInput = { goal, energyLevel, timeAvailable };

  let steps;
  try {
    steps = await planGoal(input);
  } catch (err) {
    console.error("[api/plan] planner pipeline failed", err);
    return NextResponse.json({ error: "Failed to generate a plan" }, { status: 502 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      goal,
      energy_level: energyLevel,
      time_available: timeAvailable,
    })
    .select()
    .single();

  if (sessionError || !session) {
    console.error("[api/plan] failed to create session", sessionError);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }

  const stepRows = steps.map((step, index) => ({
    session_id: session.id,
    step_number: index + 1,
    action: step.action,
    duration_seconds: step.duration_seconds,
    status: "pending" as const,
  }));

  const { data: savedSteps, error: stepsError } = await supabase
    .from("steps")
    .insert(stepRows)
    .select();

  if (stepsError || !savedSteps) {
    console.error("[api/plan] failed to save steps", stepsError);
    // Best-effort cleanup so we don't leave an orphaned, step-less session.
    await supabase.from("sessions").delete().eq("id", session.id);
    return NextResponse.json({ error: "Failed to save steps" }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    steps: savedSteps,
  });
}
