-- GateTracker Study Leaderboard
-- Run this in Supabase SQL Editor once.
-- It aggregates daily_tracking.study_minutes across ALL students,
-- regardless of ECE/CSE branch.

begin;

alter table public.user_profiles
  add column if not exists display_name text;

create or replace function public.get_study_leaderboard()
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  branch text,
  daily_minutes bigint,
  week_minutes bigint,
  month_minutes bigint,
  rank1_days bigint
)
language sql
security definer
set search_path = public
as $$
  with dates as (
    select
      (now() at time zone 'Asia/Kolkata')::date as today,
      date_trunc('week', (now() at time zone 'Asia/Kolkata'))::date as week_start,
      date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date as month_start
  ),
  totals as (
    select
      up.user_id,
      up.display_name,
      up.branch,
      coalesce(sum(case when dt.date_str = d.today then dt.study_minutes else 0 end), 0)::bigint as daily_minutes,
      coalesce(sum(case when dt.date_str >= d.week_start and dt.date_str <= d.today then dt.study_minutes else 0 end), 0)::bigint as week_minutes,
      coalesce(sum(case when dt.date_str >= d.month_start and dt.date_str <= d.today then dt.study_minutes else 0 end), 0)::bigint as month_minutes
    from public.user_profiles up
    cross join dates d
    left join public.daily_tracking dt on dt.user_id = up.user_id
    group by up.user_id, up.display_name, up.branch
  ),
  daily_scores as (
    select
      dt.date_str,
      dt.user_id,
      sum(coalesce(dt.study_minutes, 0))::bigint as study_minutes
    from public.daily_tracking dt
    where coalesce(dt.study_minutes, 0) > 0
    group by dt.date_str, dt.user_id
  ),
  daily_ranked as (
    select
      date_str,
      user_id,
      rank() over (partition by date_str order by study_minutes desc) as daily_rank
    from daily_scores
  ),
  rank1_counts as (
    select user_id, count(*)::bigint as rank1_days
    from daily_ranked
    where daily_rank = 1
    group by user_id
  )
  select
    row_number() over (order by t.daily_minutes desc, t.week_minutes desc, t.month_minutes desc, t.user_id)::bigint as rank,
    t.user_id,
    coalesce(nullif(trim(t.display_name), ''), 'Student ' || left(t.user_id::text, 6)) as display_name,
    t.branch,
    t.daily_minutes,
    t.week_minutes,
    t.month_minutes,
    coalesce(r.rank1_days, 0)::bigint as rank1_days
  from totals t
  left join rank1_counts r on r.user_id = t.user_id
  order by t.daily_minutes desc, t.week_minutes desc, t.month_minutes desc, t.user_id;
$$;

revoke all on function public.get_study_leaderboard() from public;
grant execute on function public.get_study_leaderboard() to authenticated;

commit;
