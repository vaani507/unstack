import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planGoal, validateStep } from "./planner";
import type { PlannerStep } from "./planner";

vi.mock("./openai", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import { openai } from "./openai";

const createMock = openai.chat.completions.create as unknown as ReturnType<typeof vi.fn>;

function mockContent(content: string): void {
  createMock.mockResolvedValue({ choices: [{ message: { content } }] });
}

const input = { goal: "I have an exam next week", energyLevel: "medium" as const, timeAvailable: "15min" as const };

describe("validateStep", () => {
  it("rejects an empty action", () => {
    expect(validateStep({ action: "  ", duration_seconds: 60 }).valid).toBe(false);
  });

  it("rejects a step phrased as a question", () => {
    expect(validateStep({ action: "How do I start studying?", duration_seconds: 60 }).valid).toBe(false);
  });

  it("rejects a step that asks the user to decide something", () => {
    expect(validateStep({ action: "Choose which chapter to read first", duration_seconds: 60 }).valid).toBe(
      false
    );
  });

  it("rejects a missing or invalid duration", () => {
    expect(validateStep({ action: "Open the book", duration_seconds: Number.NaN }).valid).toBe(false);
  });

  it("rejects steps longer than 3 minutes", () => {
    expect(validateStep({ action: "Open the book", duration_seconds: 181 }).valid).toBe(false);
  });

  it("rejects steps that combine multiple actions with 'and'", () => {
    expect(validateStep({ action: "Read the notes and write a summary", duration_seconds: 60 }).valid).toBe(
      false
    );
  });

  it("rejects vague verbs without specifics", () => {
    expect(validateStep({ action: "Organize my desk", duration_seconds: 60 }).valid).toBe(false);
  });

  it("accepts a small concrete single action", () => {
    expect(validateStep({ action: "Open the course page in your browser", duration_seconds: 40 }).valid).toBe(
      true
    );
  });
});

describe("planGoal (demo mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEMO_MODE = "true";
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("returns a curated plan without calling the model", async () => {
    const steps = await planGoal(input);
    expect(steps.length).toBeGreaterThan(0);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("matches common goal keywords (exam sample has 6 steps)", async () => {
    const steps = await planGoal(input);
    expect(steps.length).toBe(6);
  });
});

describe("planGoal (live pipeline)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEMO_MODE;
  });

  it("falls back to a safe generic step when the model returns no steps", async () => {
    mockContent('{"steps":[]}');
    const steps = await planGoal(input);
    expect(steps).toEqual([{ action: "Open a blank note or document", duration_seconds: 20 }]);
  });

  it("regenerates invalid steps and falls back when they stay invalid", async () => {
    // Vague verb (short) + too long — fails every validation attempt.
    mockContent('{"steps":[{"action":"Organize my things","duration_seconds":300}]}');
    const steps: PlannerStep[] = await planGoal(input);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ action: "Open a blank note or document", duration_seconds: 20 });
    // 1 initial generation + 2 regeneration retries.
    expect(createMock).toHaveBeenCalledTimes(3);
  });
});