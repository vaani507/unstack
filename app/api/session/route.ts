import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { EnergyLevel, SensoryMode, TimeAvailable } from "@/lib/types";

// POST /api/session
// Body: { goal: string, energyLevel: "low"|"medium"|"high",
//         timeAvailable: "5min"|"15min"|"30min"|"1hour", sensoryMode?: "calm"|"focus"|"energize" }
// Creates a bare session row (no steps — use /api/plan to generate + persist
// steps together). Returns { session }.
//
// GET /api/session?id=...
// Fetches a session with its steps (ordered by step_number). Returns
// { session, steps }.

const ENERGY_LEVELS: EnergyLevel[] = ["low", "medium", "high"];
const TIME_OPTIONS: TimeAvailable[] = ["5min", "15min", "30min", "1hour"];
const SENSORY_MODES: SensoryMode[] = ["calm", "focus", "energize"];

interface CreateSessionBody {
  goal?: unknown;
  energyLevel?: unknown;
  timeAvailable?: unknown;
  sensoryMode?: unknown;
}

export async function POST(request: NextRequest) {
  let body: CreateSessionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const energyLevel = body.energyLevel as EnergyLevel;
  const timeAvailable = body.timeAvailable as TimeAvailable;
  const sensoryMode = (body.sensoryMode as SensoryMode | undefined) ?? "calm";

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
  if (!SENSORY_MODES.includes(sensoryMode)) {
    return NextResponse.json(
      { error: `\`sensoryMode\` must be one of: ${SENSORY_MODES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      goal,
      energy_level: energyLevel,
      time_available: timeAvailable,
      sensory_mode: sensoryMode,
    })
    .select()
    .single();

  if (error || !session) {
    console.error("[api/session] failed to create session", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }

  return NextResponse.json({ session });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "`id` query parameter is required" },
      { status: 400 }
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select()
    .eq("id", id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: steps, error: stepsError } = await supabase
    .from("steps")
    .select()
    .eq("session_id", id)
    .order("step_number", { ascending: true });

  if (stepsError) {
    console.error("[api/session] failed to load steps", stepsError);
    return NextResponse.json({ error: "Failed to load session steps" }, { status: 500 });
  }

  return NextResponse.json({ session, steps: steps ?? [] });
}
