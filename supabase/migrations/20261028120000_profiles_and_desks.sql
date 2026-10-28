-- WebDesks accounts: one profile and one synced Desk per user.
--
-- The browser talks to these tables directly with the public anon key, so
-- every table has row-level security and each policy only lets a signed-in
-- user touch their own row.

-- ── Profiles ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
    id            uuid primary key references auth.users (id) on delete cascade,
    display_name  text check (char_length(display_name) <= 60),
    avatar_emoji  text check (char_length(avatar_emoji) <= 16),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own" on public.profiles
    for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Profiles: insert own" on public.profiles;
create policy "Profiles: insert own" on public.profiles
    for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own" on public.profiles
    for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ── Desks ───────────────────────────────────────────────────────────────
-- `data` is { "keys": { "<localStorage key>": { "v": "<raw string>", "t": <epoch ms> } } }.
-- `t` lets two devices merge per key (newest write wins); `version` gives
-- the client optimistic concurrency so a stale tab can't clobber a newer save.
create table if not exists public.desks (
    user_id     uuid primary key references auth.users (id) on delete cascade,
    data        jsonb not null default '{"keys": {}}'::jsonb,
    version     bigint not null default 1,
    updated_at  timestamptz not null default now(),
    constraint desks_data_is_object check (jsonb_typeof(data) = 'object'),
    -- About 5 MB, the same ceiling as a browser's localStorage.
    constraint desks_data_size check (pg_column_size(data) <= 5242880)
);

alter table public.desks enable row level security;

drop policy if exists "Desks: read own" on public.desks;
create policy "Desks: read own" on public.desks
    for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Desks: insert own" on public.desks;
create policy "Desks: insert own" on public.desks
    for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Desks: update own" on public.desks;
create policy "Desks: update own" on public.desks
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Desks: delete own" on public.desks;
create policy "Desks: delete own" on public.desks
    for delete to authenticated using ((select auth.uid()) = user_id);

-- ── updated_at bookkeeping ──────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
    for each row execute function public.touch_updated_at();

drop trigger if exists desks_touch on public.desks;
create trigger desks_touch before update on public.desks
    for each row execute function public.touch_updated_at();

-- ── Create a profile for every new sign-up ──────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        left(coalesce(
            new.raw_user_meta_data ->> 'display_name',
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'name',
            split_part(new.email, '@', 1)
        ), 60)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_user();

-- ── Self-service account deletion ───────────────────────────────────────
-- Deleting the auth user cascades to profiles and desks.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not signed in' using errcode = '28000';
    end if;
    delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Data API access ─────────────────────────────────────────────────────
-- Explicit so it doesn't depend on the project's default grants. Row-level
-- security above still limits each user to their own rows.
revoke all on public.profiles, public.desks from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.desks to authenticated;
