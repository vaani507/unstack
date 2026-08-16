-- unstack: Supabase schema
-- Run this in the Supabase SQL editor.

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  goal text not null,
  energy_level text,
  time_available text,
  sensory_mode text default 'calm',
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  step_number int not null,
  action text not null,
  duration_seconds int not null,
  status text default 'pending', -- pending | done | skipped | too_hard
  difficulty text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  step_id uuid references steps(id) on delete cascade,
  feedback_type text not null, -- done | too_hard | skip
  created_at timestamptz default now()
);

-- Row Level Security.
-- Unstack is currently anonymous (no auth), so all tables grant the anon
-- role full access. If you add user accounts later, replace these permissive
-- policies with user-scoped ones (e.g. using (user_id = auth.uid())).

alter table sessions enable row level security;
alter table steps enable row level security;
alter table feedback enable row level security;

create policy "anon full access sessions" on sessions for all to anon using (true) with check (true);
create policy "anon full access steps" on steps for all to anon using (true) with check (true);
create policy "anon full access feedback" on feedback for all to anon using (true) with check (true);
