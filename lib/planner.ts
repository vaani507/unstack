import { openai } from "./openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnergyLevel = "low" | "medium" | "high";
export type TimeAvailable = "5min" | "15min" | "30min" | "1hour";

export interface PlannerInput {
  goal: string;
  energyLevel: EnergyLevel;
  timeAvailable: TimeAvailable;
}

export interface PlannerStep {
  action: string;
  duration_seconds: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Step 1 — Planner prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a task decomposition engine for people experiencing executive dysfunction.
Your job is NOT to create a conventional task list.
Convert the user's goal into the smallest sequence of concrete physical or cognitive
actions that can be completed independently.
Rules:
1. Every step must take 3 minutes or less.
2. Every step must contain exactly one primary action.
3. Start with a concrete verb.
4. Never combine multiple actions with 'and'.
5. Never say 'organize', 'work on', 'study', or 'clean' without specifying exactly what to do.
6. Avoid decisions whenever possible — don't ask the user to choose between options.
7. Do not present more than one immediate action at a time in the output ordering.
8. The first action should be extremely easy to initiate (near-zero activation energy).
9. Respect the user's stated energy level — low energy gets smaller, easier first steps.
10. Respect their available time — total steps should roughly fit the time budget.
Return ONLY valid JSON: { steps: [{ action: string, duration_seconds: number }] }
No markdown, no preamble.`;

const MODEL = process.env.OPENAI_PLANNER_MODEL || "gpt-4o-mini";

const TIME_BUDGET_SECONDS: Record<TimeAvailable, number> = {
  "5min": 300,
  "15min": 900,
  "30min": 1800,
  "1hour": 3600,
};

function buildUserPrompt(input: PlannerInput): string {
  return [
    `Goal: "${input.goal}"`,
    `Energy level: ${input.energyLevel}`,
    `Time available: ${input.timeAvailable} (~${TIME_BUDGET_SECONDS[input.timeAvailable]} seconds total budget)`,
  ].join("\n");
}

/** Calls the model in JSON mode and returns the parsed JSON body (unvalidated). */
async function callPlannerModel(userPrompt: string): Promise<unknown> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Planner model returned an empty response");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Planner model returned invalid JSON");
  }
}

interface RawPlanResponse {
  steps?: Array<{ action?: unknown; duration_seconds?: unknown }>;
}

function coerceStep(raw: { action?: unknown; duration_seconds?: unknown }): PlannerStep {
  return {
    action: typeof raw.action === "string" ? raw.action.trim() : "",
    duration_seconds:
      typeof raw.duration_seconds === "number" ? raw.duration_seconds : Number.NaN,
  };
}

async function generateRawPlan(input: PlannerInput): Promise<PlannerStep[]> {
  const parsed = (await callPlannerModel(buildUserPrompt(input))) as RawPlanResponse;

  if (!parsed || !Array.isArray(parsed.steps)) {
    throw new Error("Planner model response missing a `steps` array");
  }

  return parsed.steps.map(coerceStep);
}

// ---------------------------------------------------------------------------
// Step 2 — Deterministic validator
// ---------------------------------------------------------------------------

// Concrete verbs (and short verb phrases) a step is allowed to start with.
// Not exhaustive — extend as real output surfaces gaps.
const CONCRETE_VERBS = [
  "pick up", "put down", "put away", "put back", "put on", "put",
  "set down", "set up", "set out", "set a timer",
  "open", "close", "shut", "find", "locate", "write", "write down",
  "type", "click", "tap", "press", "swipe", "scroll",
  "move", "read", "reread", "highlight", "underline", "circle", "cross out",
  "copy", "paste", "cut", "delete", "rename", "drag", "select",
  "save", "send", "reply to", "forward", "attach", "download", "upload",
  "look at", "look up", "check", "mark", "tick", "star",
  "grab", "place", "gather", "collect", "stack", "sort",
  "note", "jot down", "list", "count", "measure", "weigh",
  "fill in", "fill out", "sign", "date",
  "get", "bring", "take", "take out", "carry", "hand",
  "turn on", "turn off", "switch on", "switch off",
  "plug in", "unplug", "charge", "power on", "power off",
  "fold", "unfold", "hang", "hang up", "wash", "rinse", "wipe", "dry",
  "sweep", "vacuum", "empty", "throw away", "recycle", "toss",
  "pour", "boil", "chop", "slice", "stir", "peel", "wash",
  "walk to", "stand up", "sit down", "lie down",
  "breathe", "drink", "eat", "chew", "swallow",
  "text", "call", "email", "message", "dial",
  "unscrew", "screw", "tie", "untie", "zip", "unzip",
  "button", "unbutton", "lace", "unlace", "tear off", "peel off",
];

// Verbs the system prompt explicitly bans unless followed by real specifics.
const VAGUE_VERBS = [
  "organize", "clean", "study", "work on", "work",
  "prepare", "review", "plan", "decide", "sort out",
  "deal with", "handle", "figure out", "improve", "fix",
  "manage", "tidy up", "tidy", "sort through", "go through",
];

const QUESTION_STARTERS = [
  "what", "which", "who", "when", "where", "why", "how",
  "do you", "would you", "should you", "can you", "could you",
];

function startsWithPhrase(lowerText: string, phrase: string): boolean {
  return lowerText.startsWith(phrase.toLowerCase());
}

function checkStartsWithVerb(action: string): ValidationResult {
  const lower = action.toLowerCase();

  const vagueMatch = VAGUE_VERBS.find((v) => startsWithPhrase(lower, v + " ") || lower === v);
  if (vagueMatch) {
    // Rule 5 allows a vague verb only when it's paired with a genuinely
    // specific object + action — approximated here by requiring enough
    // trailing words to plausibly contain that detail.
    const wordCount = action.split(/\s+/).filter(Boolean).length;
    if (wordCount < 6) {
      return {
        valid: false,
        reason: `starts with vague verb "${vagueMatch}" without a specific object/action`,
      };
    }
    return { valid: true };
  }

  const concreteMatch = CONCRETE_VERBS.find((v) => startsWithPhrase(lower, v + " ") || lower === v);
  if (concreteMatch) {
    return { valid: true };
  }

  return { valid: false, reason: "does not start with a recognized concrete verb" };
}

export function validateStep(step: PlannerStep): ValidationResult {
  const action = (step.action ?? "").trim();

  if (!action) {
    return { valid: false, reason: "action is empty" };
  }

  if (action.endsWith("?")) {
    return { valid: false, reason: "action is phrased as a question" };
  }

  const lower = action.toLowerCase();
  if (QUESTION_STARTERS.some((q) => startsWithPhrase(lower, q + " "))) {
    return { valid: false, reason: "action asks the user to decide/answer something" };
  }

  if (!Number.isFinite(step.duration_seconds) || step.duration_seconds <= 0) {
    return { valid: false, reason: "missing or invalid duration_seconds" };
  }

  if (step.duration_seconds > 180) {
    return { valid: false, reason: "duration_seconds exceeds the 180s (3 min) limit" };
  }

  // Basic split-and-check heuristic: reject actions combining two verbs with "and".
  if (/\band\b/i.test(action)) {
    return { valid: false, reason: 'action combines multiple steps with "and"' };
  }

  const verbCheck = checkStartsWithVerb(action);
  if (!verbCheck.valid) {
    return verbCheck;
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Regeneration + fallback
// ---------------------------------------------------------------------------

const MAX_RETRIES_PER_STEP = 2;

// Manually-safe generic first step used only if a step still fails validation
// after all retries — deliberately goal-agnostic and trivially easy.
const FALLBACK_STEP: PlannerStep = {
  action: "Open a blank note or document",
  duration_seconds: 20,
};

// ---------------------------------------------------------------------------
// Demo mode — curated plans so the pitch runs without a working model
// ---------------------------------------------------------------------------

interface DemoSample {
  keywords: string[];
  steps: PlannerStep[];
}

const DEMO_SAMPLES: DemoSample[] = [
  {
    keywords: ["exam", "study", "test", "revision"],
    steps: [
      { action: "Open the course page in your browser", duration_seconds: 40 },
      { action: "Read the first unit heading", duration_seconds: 60 },
      { action: "Write down one exam topic on a sticky note", duration_seconds: 60 },
      { action: "Read the first two lines of the unit notes", duration_seconds: 60 },
      { action: "Highlight one key term you don't recognize", duration_seconds: 90 },
      { action: "Type that term onto a blank flashcard", duration_seconds: 90 },
    ],
  },
  {
    keywords: ["desk", "room", "clean", "tidy", "laundry", "organiz"],
    steps: [
      { action: "Set a timer on your phone for 3 minutes", duration_seconds: 20 },
      { action: "Put one empty cup or plate in the kitchen", duration_seconds: 60 },
      { action: "Throw away one item of trash from your desk", duration_seconds: 60 },
      { action: "Stack one pile of loose papers together", duration_seconds: 90 },
      { action: "Wipe the desk surface with a cloth", duration_seconds: 120 },
    ],
  },
  {
    keywords: ["email", "message", "reply", "inbox"],
    steps: [
      { action: "Open your inbox", duration_seconds: 30 },
      { action: "Sort the inbox by oldest message first", duration_seconds: 60 },
      { action: "Reply to the oldest single message with one sentence", duration_seconds: 120 },
      { action: "Mark the next unread message as read", duration_seconds: 30 },
      { action: "Forward one message you can't answer to someone who can", duration_seconds: 90 },
    ],
  },
  {
    keywords: ["resume", "cv", "apply", "internship", "job", "cover letter"],
    steps: [
      { action: "Find your most recent resume file on this computer", duration_seconds: 60 },
      { action: "Open the resume file", duration_seconds: 30 },
      { action: "Read the first bullet under your latest role", duration_seconds: 60 },
      { action: "Type one clear verb into the start of that bullet", duration_seconds: 90 },
      { action: "Save a copy of the file named with today's date", duration_seconds: 60 },
      { action: "Type the job name you're applying to into a search bar", duration_seconds: 60 },
    ],
  },
];

const DEMO_FALLBACK_STEPS: PlannerStep[] = [
  { action: "Write your goal on a sticky note", duration_seconds: 60 },
  { action: "Stick the note beside your screen", duration_seconds: 30 },
  { action: "Open a blank document on this computer", duration_seconds: 60 },
  { action: "Type one sentence describing the goal", duration_seconds: 90 },
  { action: "List three tiny things that could move this forward", duration_seconds: 120 },
];

function planInDemoMode(input: PlannerInput): PlannerStep[] {
  const lower = input.goal.toLowerCase();
  const sample = DEMO_SAMPLES.find((candidate) =>
    candidate.keywords.some((keyword) => lower.includes(keyword))
  );
  return (sample?.steps ?? DEMO_FALLBACK_STEPS).map((step) => ({ ...step }));
}

function buildRegeneratePrompt(
  input: PlannerInput,
  stepIndex: number,
  failedStep: PlannerStep,
  reason: string
): string {
  return [
    `Original goal: "${input.goal}"`,
    `Energy level: ${input.energyLevel}`,
    `Time available: ${input.timeAvailable}`,
    `This is step ${stepIndex + 1} of the plan.`,
    `The previously generated step was: "${failedStep.action}" (${failedStep.duration_seconds}s)`,
    `That step was too vague/compound. Make it smaller and more concrete.`,
    `Reason it was rejected: ${reason}`,
    `Return ONLY valid JSON for a single step: { "action": string, "duration_seconds": number }`,
    `No markdown, no preamble.`,
  ].join("\n");
}

async function regenerateStep(
  input: PlannerInput,
  stepIndex: number,
  failedStep: PlannerStep,
  reason: string
): Promise<PlannerStep> {
  const prompt = buildRegeneratePrompt(input, stepIndex, failedStep, reason);
  const parsed = (await callPlannerModel(prompt)) as { action?: unknown; duration_seconds?: unknown };
  return coerceStep(parsed);
}

// ---------------------------------------------------------------------------
// Step 3 (pipeline half) — full validated plan, no persistence
// ---------------------------------------------------------------------------

/**
 * Runs the full planner pipeline (generate -> validate -> regenerate ->
 * fallback) and returns a list of validated steps. Does NOT touch Supabase —
 * callers (API route, test scripts) decide what to do with the result.
 */
export async function planGoal(input: PlannerInput): Promise<PlannerStep[]> {
  // Demo mode short-circuits the model for presentations: no API key needed.
  if (process.env.DEMO_MODE === "true") {
    return planInDemoMode(input);
  }

  const rawSteps = await generateRawPlan(input);
  const finalSteps: PlannerStep[] = [];

  for (let i = 0; i < rawSteps.length; i++) {
    let candidate = rawSteps[i];
    let result = validateStep(candidate);
    let attempts = 0;

    while (!result.valid && attempts < MAX_RETRIES_PER_STEP) {
      attempts++;
      try {
        candidate = await regenerateStep(input, i, candidate, result.reason ?? "invalid step");
      } catch {
        // Regeneration call itself failed (network/parsing) — stop retrying
        // this step and fall through to the fallback below.
        result = { valid: false, reason: "regeneration call failed" };
        break;
      }
      result = validateStep(candidate);
    }

    finalSteps.push(result.valid ? candidate : { ...FALLBACK_STEP });
  }

  // Guarantee at least one step even if the model returned an empty array.
  if (finalSteps.length === 0) {
    finalSteps.push({ ...FALLBACK_STEP });
  }

  return finalSteps;
}
