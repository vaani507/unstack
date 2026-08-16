/**
 * Standalone sanity-check script for the planner pipeline (lib/planner.ts).
 * Runs 10 representative goals through generate -> validate -> regenerate ->
 * fallback and prints the resulting steps for manual quality review.
 *
 * Does NOT touch Supabase — only exercises the OpenAI planning pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-planner.ts
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

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "OPENAI_API_KEY is not set.\n" +
        "Copy .env.local.example to .env.local, fill in your key, then run:\n" +
        "  npx tsx --env-file=.env.local scripts/test-planner.ts"
    );
    process.exit(1);
  }

  console.log(`Running planner against ${TEST_GOALS.length} goals`);
  console.log(`(energyLevel=${DEFAULT_ENERGY}, timeAvailable=${DEFAULT_TIME})\n`);

  for (let i = 0; i < TEST_GOALS.length; i++) {
    const goal = TEST_GOALS[i];
    const input: PlannerInput = {
      goal,
      energyLevel: DEFAULT_ENERGY,
      timeAvailable: DEFAULT_TIME,
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
