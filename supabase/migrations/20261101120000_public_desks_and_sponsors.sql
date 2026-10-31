-- Public Desks (webdesks.app/u/<username>) and Desk Sponsor stats.
-- Safe to run twice.

-- ── Public Desk ─────────────────────────────────────────────────────────
-- A member picks a username and switches sharing on. The app writes a small
-- summary (Focus Town level, streak badges, favourite Sounds preset) into
-- public_stats; nothing else from the Desk is ever exposed. Anonymous
-- visitors read it only through get_public_desk(), never the table.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists is_public boolean not null default false;
alter table public.profiles add column if not exists public_stats jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists public_updated_at timestamptz;

do $$ begin
    alter table public.profiles add constraint profiles_username_format
        check (username is null or username ~ '^[a-z0-9_]{3,24}$');
exception when duplicate_object then null; end $$;

do $$ begin
    alter table public.profiles add constraint profiles_username_reserved
        check (username is null or username not in (
            'admin', 'administrator', 'root', 'support', 'help', 'api', 'app', 'www', 'mail', 'webdesks',
            'login', 'signup', 'settings', 'account', 'tools', 'blog', 'games', 'about', 'privacy', 'terms',
            'contact', 'u', 'me', 'null', 'undefined', 'anonymous', 'official', 'staff', 'moderator', 'ads'));
exception when duplicate_object then null; end $$;

do $$ begin
    alter table public.profiles add constraint profiles_public_stats_object
        check (jsonb_typeof(public_stats) = 'object' and pg_column_size(public_stats) <= 8192);
exception when duplicate_object then null; end $$;

create unique index if not exists profiles_username_key on public.profiles (username);

-- Read-only public view of one Desk. Returns null unless the owner has
-- switched sharing on.
create or replace function public.get_public_desk(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'username', p.username,
        'display_name', p.display_name,
        'avatar_emoji', p.avatar_emoji,
        'stats', p.public_stats,
        'updated_at', p.public_updated_at,
        'member_since', p.created_at
    )
    from public.profiles p
    where p.username = lower(p_username) and p.is_public
    limit 1;
$$;

revoke all on function public.get_public_desk(text) from public;
grant execute on function public.get_public_desk(text) to anon, authenticated;

-- ── Desk Sponsor stats ──────────────────────────────────────────────────
-- Daily view / click counters for the curated sponsor card, so sponsors can
-- get a report. No user or device identifiers are stored.
create table if not exists public.sponsor_stats (
    day         date not null default current_date,
    sponsor_id  text not null check (sponsor_id ~ '^[a-z0-9-]{2,40}$'),
    views       bigint not null default 0,
    clicks      bigint not null default 0,
    primary key (day, sponsor_id)
);

alter table public.sponsor_stats enable row level security;
-- No policies: only the security-definer function below writes, and only
-- the project owner (dashboard / service role) reads.
revoke all on public.sponsor_stats from anon, authenticated;

create or replace function public.log_sponsor_event(p_sponsor text, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_kind not in ('view', 'click') or p_sponsor !~ '^[a-z0-9-]{2,40}$' then
        return;
    end if;
    insert into public.sponsor_stats as s (day, sponsor_id, views, clicks)
    values (current_date, p_sponsor, (p_kind = 'view')::int, (p_kind = 'click')::int)
    on conflict (day, sponsor_id) do update
        set views = s.views + excluded.views,
            clicks = s.clicks + excluded.clicks;
end;
$$;

revoke all on function public.log_sponsor_event(text, text) from public;
grant execute on function public.log_sponsor_event(text, text) to anon, authenticated;
