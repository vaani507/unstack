/**
 * Standalone sanity-check script for the planner pipeline (lib/planner.ts).
 * Runs 10 representative goals through generate -> validate -> regenerate ->
 * fallback and prints the resulting steps for manual quality review.
 *
 * Does NOT touch Supabase — only exercises the OpenAI planning pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-planner.ts
 *   npx tsx --env-file=.env.local scripts/test-planner.ts --goal "I have an exam next week"
 *   npx tsx --env-file=.env.local scripts/test-planner.ts --goal "Clean my desk" --energy low --time 5min
 *
 * Flags:
 *   --goal    Run a single goal instead of the default list
 *   --energy  Energy level for the single-goal run (low | medium | high, default medium)
 *   --time    Time budget for the single-goal run (5min | 15min | 30min | 1hour, default 15min)
 *
 * Requires OPENAI_API_KEY to be set (in .env.local or the environment).
 */

import { planGoal, type EnergyLevel, type PlannerInput, type TimeAvailable } from "../lib/planner";

const TEST_GOALS: string[] = [
  "I have a DBMS exam next week and haven't started studying",
  "Clean my room and organize my study desk",
  "I need to apply for three internships",
  "I need to cook dinner but don't know where to start",
  "I have to prepare a presentation for tomorrow",
  "I need to reply to 15 unread emails",
  "I haven't done laundry in two weeks",
  "I need to start exercising but keep putting it off",
  "I have a coding assignment due and haven't opened the file",
  "I need to fix my resume before applying to jobs",
];

const DEFAULT_ENERGY: EnergyLevel = "medium";
const DEFAULT_TIME: TimeAvailable = "15min";

function parseArgs(argv: string[]): {
  goal: string | null;
  energy: EnergyLevel;
  time: TimeAvailable;
} {
  let goal: string | null = null;
  let energy: EnergyLevel = DEFAULT_ENERGY;
  let time: TimeAvailable = DEFAULT_TIME;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === "--goal" && value) {
      goal = value;
      i++;
    } else if (arg === "--energy" && value) {
      if (value === "low" || value === "medium" || value === "high") {
        energy = value;
      } else {
        console.warn(`Unknown --energy value "${value}" — using "${DEFAULT_ENERGY}"`);
      }
      i++;
    } else if (arg === "--time" && value) {
      if (value === "5min" || value === "15min" || value === "30min" || value === "1hour") {
        time = value;
      } else {
        console.warn(`Unknown --time value "${value}" — using "${DEFAULT_TIME}"`);
      }
      i++;
    }
  }

  return { goal, energy, time };
}

async function main() {
  const { goal: singleGoal, energy, time } = parseArgs(process.argv.slice(2));

  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "OPENAI_API_KEY is not set.\n" +
        "Copy .env.local.example to .env.local, fill in your key, then run:\n" +
        "  npx tsx --env-file=.env.local scripts/test-planner.ts"
    );
    process.exit(1);
  }

  const goals = singleGoal ? [singleGoal] : TEST_GOALS;

  console.log(`Running planner against ${goals.length} goal${goals.length === 1 ? "" : "s"}`);
  console.log(`(energyLevel=${energy}, timeAvailable=${time})\n`);

  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const input: PlannerInput = {
      goal,
      energyLevel: energy,
      timeAvailable: time,
    };

    console.log("=".repeat(80));
    console.log(`#${i + 1}  ${goal}`);
    console.log("=".repeat(80));

    try {
      const steps = await planGoal(input);
      steps.forEach((step, idx) => {
        console.log(`  ${idx + 1}. [${step.duration_seconds}s] ${step.action}`);
      });
    } catch (err) {
      console.error("  FAILED:", err instanceof Error ? err.message : err);
    }

    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
