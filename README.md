# Unstack

> **Turn overwhelming tasks into one doable thing at a time.**

Unstack is an AI-powered task decomposition tool built for people with ADHD and executive dysfunction. You describe what's feeling impossible, tell it your current energy level and time available — and it breaks the goal into the smallest possible sequence of concrete, 3-minute micro-steps designed to have near-zero activation energy to begin.

No long lists. No vague instructions. No decisions required. Just: *"Pick up 3 water bottles off your desk."*

---

## Why it exists

Traditional task managers make executive dysfunction *worse*. A long list of complex items increases cognitive load and deepens task paralysis. Unstack takes a fundamentally different approach: it gives you exactly one thing to do next, phrased as a single concrete physical or cognitive action, and nothing else.

The UI is intentionally minimal. A calm, distraction-free interface gives your brain space to focus on the one step in front of you — not on navigating a complex application.

---

## Features

- **AI micro-step planner** — Converts any overwhelming goal into a validated sequence of 3-minute actions
- **Energy and time awareness** — Adjusts step difficulty and count based on your current state (low / medium / high energy, 5 min to 1 hour)
- **Two-layer AI validation** — Every generated step is checked against strict rules (concrete verb, single action, no vague language, max 3-min duration). Steps that fail are automatically regenerated before you ever see them
- **Step feedback** — Mark steps as done, skip them, or flag them as too hard
- **Session history** — Past sessions are persisted and viewable
- **Fully keyboard accessible** — Every interactive element is navigable without a mouse
- **Screen-reader optimized** — Semantic HTML and ARIA labels throughout

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI | Google Gemini via OpenAI-compatible API |
| Database | Supabase (PostgreSQL) |
| Runtime | Node.js serverless (Next.js API routes) |

---

## Project Structure

```
unstack/
├── app/
│   ├── page.tsx          # Main intake form (goal, energy, time)
│   ├── plan/             # Step-by-step plan view
│   ├── session/          # Active session runner
│   ├── history/          # Past sessions
│   └── api/plan/         # POST /api/plan — AI pipeline + Supabase persistence
├── lib/
│   ├── planner.ts        # AI pipeline: generate → validate → regenerate → fallback
│   ├── openai.ts         # Provider-agnostic OpenAI SDK client
│   ├── supabase.ts       # Lazy Supabase client
│   ├── types.ts          # Shared TypeScript types
│   └── steps.ts          # Step utilities
├── supabase/
│   └── schema.sql        # Database schema (sessions, steps, feedback)
└── scripts/
    └── test-planner.ts   # CLI script to test the planner against sample goals
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key (free)
- A [Supabase](https://supabase.com) project (free tier)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

```env
# .env.local

# Google Gemini via OpenAI-compatible endpoint (free tier available)
OPENAI_API_KEY=your_gemini_api_key
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_PLANNER_MODEL=gemini-3.5-flash

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> **Note:** `.env.local` is gitignored by default and will never be committed.

### 3. Set up the database

Run the schema in your Supabase SQL Editor:

1. Open your Supabase project dashboard
2. Go to **SQL Editor** in the left sidebar
3. Copy the contents of [`supabase/schema.sql`](supabase/schema.sql) and paste it in
4. Click **Run**

The schema creates three tables: `sessions`, `steps`, and `feedback`.

> **Tip:** When prompted, choose "Run without RLS" or disable Row Level Security on all three tables for local development.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How the AI Planner Works

The core logic lives in [`lib/planner.ts`](lib/planner.ts) and runs in three stages:

```
Goal + Energy + Time
        |
        v
  [1] LLM Generation
  Prompt with strict rules:
  - Every step is 3 minutes or less
  - Must start with a concrete verb
  - No vague verbs (organize, clean, study, work on...)
  - No compound actions with "and"
  - No decision-making prompts to the user
  - First step has near-zero activation energy
        |
        v
  [2] Deterministic Validation
  Every step is checked programmatically against the same rules.
  Invalid steps are sent back for regeneration (up to 2 retries).
  Steps that still fail get a safe fallback: "Open a blank document"
        |
        v
  [3] Validated step list saved to Supabase and returned to UI
```

### Test the planner from the terminal

```bash
npm run test:planner
```

This runs the planner against 10 sample goals and prints the generated steps — no browser required.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your AI provider API key (Gemini or OpenAI) |
| `OPENAI_BASE_URL` | Optional custom base URL to use a different AI provider |
| `OPENAI_PLANNER_MODEL` | Model name to use (default: `gpt-4o-mini`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

---

## License

MIT
