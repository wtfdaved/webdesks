-- Daily Shutdown log: one row per user per day, written by the dashboard's
-- "Shut down day" button (desks.js). Keeps a focus history that outlives the
-- Desk's rolling local data and powers future weekly reviews / paid tiers.
--
-- Same model as desks: the browser writes with the anon key and row-level
-- security only lets a signed-in user reach their own rows. Safe to run twice.

create table if not exists public.daily_logs (
    user_id        uuid not null references auth.users (id) on delete cascade,
    day            date not null,
    focus_minutes  integer not null default 0 check (focus_minutes between 0 and 1440),
    sessions       integer not null default 0 check (sessions between 0 and 500),
    tasks_done     integer not null default 0 check (tasks_done between 0 and 10000),
    tasks_rolled   integer not null default 0 check (tasks_rolled between 0 and 10000),
    summary        text check (char_length(summary) <= 8000),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    primary key (user_id, day)
);

alter table public.daily_logs enable row level security;

drop policy if exists "Daily logs: read own" on public.daily_logs;
create policy "Daily logs: read own" on public.daily_logs
    for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Daily logs: insert own" on public.daily_logs;
create policy "Daily logs: insert own" on public.daily_logs
    for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Daily logs: update own" on public.daily_logs;
create policy "Daily logs: update own" on public.daily_logs
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Daily logs: delete own" on public.daily_logs;
create policy "Daily logs: delete own" on public.daily_logs
    for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists daily_logs_touch on public.daily_logs;
create trigger daily_logs_touch before update on public.daily_logs
    for each row execute function public.touch_updated_at();

revoke all on public.daily_logs from anon;
grant select, insert, update, delete on public.daily_logs to authenticated;
