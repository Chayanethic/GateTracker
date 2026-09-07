-- Run this in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.test_series_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.test_series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  max_marks numeric not null check (max_marks > 0),
  question_count integer not null default 0,
  questions jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.test_series_keys (
  id uuid primary key default gen_random_uuid(),
  test_series_id uuid not null references public.test_series(id) on delete cascade,
  id_in_test text not null,
  number integer not null,
  answer jsonb not null default '[]'::jsonb,
  solution_html text not null default '',
  video_url text,
  unique(test_series_id,id_in_test)
);

create table if not exists public.test_series_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_series_id uuid not null references public.test_series(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  not_answered_count integer not null default 0,
  score numeric not null default 0,
  time_spent_seconds integer not null default 0,
  question_time_seconds jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_test_access_user on public.test_series_access_requests(user_id);
create index if not exists idx_test_keys_test on public.test_series_keys(test_series_id);
create index if not exists idx_test_attempt_user on public.test_series_attempts(user_id);

alter table public.test_series_access_requests enable row level security;
alter table public.test_series enable row level security;
alter table public.test_series_keys enable row level security;
alter table public.test_series_attempts enable row level security;

drop policy if exists "users read own test access" on public.test_series_access_requests;
create policy "users read own test access" on public.test_series_access_requests for select using (auth.uid() = user_id);
drop policy if exists "users create own test access" on public.test_series_access_requests;
create policy "users create own test access" on public.test_series_access_requests for insert with check (auth.uid() = user_id);
-- Re-request after rejection, but never let a user approve themselves.
drop policy if exists "users update own rejected request" on public.test_series_access_requests;
create policy "users update own rejected request" on public.test_series_access_requests for update using (auth.uid() = user_id and status = 'rejected') with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "approved users read tests" on public.test_series;
create policy "approved users read tests" on public.test_series for select using (
  is_published = true and exists (select 1 from public.test_series_access_requests a where a.user_id=auth.uid() and a.status='approved')
);

-- Answer keys are intentionally NOT readable by candidates. The submit API uses the server service-role key.
-- Do not create a SELECT policy on test_series_keys for normal users.

drop policy if exists "users insert own attempts" on public.test_series_attempts;
create policy "users insert own attempts" on public.test_series_attempts for insert with check (
  auth.uid() = user_id and exists (select 1 from public.test_series_access_requests a where a.user_id=auth.uid() and a.status='approved')
);
drop policy if exists "users read own attempts" on public.test_series_attempts;
create policy "users read own attempts" on public.test_series_attempts for select using (auth.uid() = user_id);

-- If test_series_attempts already exists, add the per-question timer column with:
alter table public.test_series_attempts add column if not exists question_time_seconds jsonb not null default '{}'::jsonb;
