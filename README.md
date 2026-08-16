# Unstack

Break the freeze. One tiny step at a time.

Unstack is a calm, executive-dysfunction-friendly planning app. You describe
one overwhelming thing ("I have an exam next week and haven't started
studying"), tell it how much energy and time you have right now, and it
turns that into a sequence of small concrete micro-actions — the first one
deliberately near-zero activation energy.

Instead of a todo list, Unstack runs you through one action at a time in a
two-state session flow, forces a break every three completed steps, and
re-splits any step you flag as "too hard."

## Stack

- **Next.js 15** (App Router, server + client components)
- **OpenAI** — planning pipeline (generate → validate → regenerate → fallback)
- **Supabase** — Postgres (`sessions`, `steps`, `feedback`) via the Data API
- **Tailwind CSS v4** — custom muted palette, sensory-mode tokens

## Local setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment variables**

   ```bash
   copy .env.local.example .env.local
   ```

   Fill in:

   - `OPENAI_API_KEY` — from the [OpenAI dashboard](https://platform.openai.com/api-keys)
   - `NEXT_PUBLIC_SUPABASE_URL` — your project URL, e.g. `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable key from
     **Project Settings → API Keys** (older projects may still show the legacy
     `anon` key, which is also accepted via `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

   These are public/browser-safe; never commit `.env.local` (it's gitignored).

### Run the planner without OpenAI (Ollama)

The planner only speaks an OpenAI-compatible chat API, so you can run it
fully locally with [Ollama](https://ollama.com) — no API key, no credits:

```bash
ollama pull llama3.2       # or any instruction-following model
```

Then in `.env.local`:

```
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_PLANNER_MODEL=llama3.2
OPENAI_API_KEY=ollama
```

Keep `NEXT_PUBLIC_SUPABASE_*` as above. Bigger models (e.g. `qwen2.5:7b`)
follow the JSON + validation rules more reliably than small ones.

3. **Create the tables**

   In the Supabase dashboard SQL editor, run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). It creates the `sessions`,
   `steps`, and `feedback` tables.

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Planner sanity-check script

Exercises the OpenAI planning pipeline without touching Supabase:

```bash
npx tsx --env-file=.env.local scripts/test-planner.ts
```

Run a single goal with custom energy/time:

```bash
npx tsx --env-file=.env.local scripts/test-planner.ts --goal "Clean my desk" --energy low --time 5min
```

## API routes

| Route                 | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `POST /api/plan`      | Generate steps from a goal + energy + time, persist session + steps |
| `POST /api/session`   | Create a bare session row (no steps)                              |
| `GET /api/session`    | Fetch a session with its steps by `?id=`                         |
| `POST /api/step/complete` | Mark the current step done, advance to the next                  |
| `POST /api/adapt`     | Re-split a "too hard" step into smaller sub-steps                 |

## Architecture

The core idea: **LLM generates, deterministic rules enforce.**

1. **Planner** — LLM converts the goal into micro-actions (≤3 min each, one
   action per step, concrete verb, no "and", no questions).
2. **Validator** — rule-based check; rejected steps are regenerated, with a
   manual fallback step as a last resort.
3. **Sequencer** — picks the lowest-numbered pending step as "the one."
4. **User feedback** — done / too hard / skip.
5. **Adaptation** — "too hard" steps get split into smaller ones and re-inserted.

## Sensory modes

Top-right menu on the session screen switches between **Calm**, **Focus**, and
**Low stimulation**, and scales the root text size (100–150%). The OS
`prefers-reduced-motion` setting always wins for animations.
