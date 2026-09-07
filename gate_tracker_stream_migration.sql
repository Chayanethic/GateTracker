-- GateTracker ECE/CSE stream migration
-- Run this once in the Supabase SQL Editor before deploying the updated app.

begin;

alter table public.study_materials
  add column if not exists stream text not null default 'ece';

alter table public.study_materials
  drop constraint if exists study_materials_stream_check;

alter table public.study_materials
  add constraint study_materials_stream_check
  check (stream in ('ece', 'cse'));

-- All current lectures were the original ECE curriculum.
update public.study_materials
set stream = 'ece'
where stream is null or stream = '';

create index if not exists study_materials_stream_idx
  on public.study_materials(stream);

alter table public.user_profiles
  add column if not exists branch text;

alter table public.user_profiles
  drop constraint if exists user_profiles_branch_check;

alter table public.user_profiles
  add constraint user_profiles_branch_check
  check (branch is null or branch in ('ece', 'cse'));

create index if not exists user_profiles_branch_idx
  on public.user_profiles(branch);

commit;

-- Existing lectures are now ECE automatically.
-- Manual example:
-- update public.study_materials set stream = 'cse' where id = 'LECTURE_UUID';
-- The Admin Resource Command Center also has a one-click Move button.
