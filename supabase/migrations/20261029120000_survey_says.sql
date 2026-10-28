-- Survey Says: hosts create a game of 3–5 questions, share one link, people
-- answer anonymously until the game closes, then the host plays the board.
--
-- Hosts are signed-in WebDesks users and can only see their own games and
-- responses. Respondents never touch the tables directly: they go through
-- two SECURITY DEFINER functions that look a game up by its share code and
-- accept answers only while it is open.

create table if not exists public.survey_games (
    id          uuid primary key default gen_random_uuid(),
    owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
    code        text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
    title       text not null check (char_length(title) between 1 and 100),
    status      text not null default 'open' check (status in ('open', 'closed')),
    closes_at   timestamptz,
    min_count   int not null default 2 check (min_count between 1 and 50),
    -- Host's edited board per question: [{ "label": "...", "count": n, "aliases": ["..."] }, ...]
    board       jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    constraint survey_games_board_size check (pg_column_size(board) <= 262144)
);
create index if not exists survey_games_owner_idx on public.survey_games (owner, created_at desc);

create table if not exists public.survey_questions (
    id        uuid primary key default gen_random_uuid(),
    game_id   uuid not null references public.survey_games (id) on delete cascade,
    position  int not null check (position between 0 and 4),
    prompt    text not null check (char_length(prompt) between 1 and 200),
    unique (game_id, position)
);

create table if not exists public.survey_responses (
    id          bigint generated always as identity primary key,
    game_id     uuid not null references public.survey_games (id) on delete cascade,
    -- Random per-browser token so one person can't flood a game from one device.
    respondent  text not null check (char_length(respondent) between 8 and 64),
    answers     jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 5),
    created_at  timestamptz not null default now(),
    unique (game_id, respondent)
);
create index if not exists survey_responses_game_idx on public.survey_responses (game_id);

-- ── Row-level security: hosts manage only their own games ──────────────
alter table public.survey_games enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;

drop policy if exists "Survey games: owner all" on public.survey_games;
create policy "Survey games: owner all" on public.survey_games
    for all to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

drop policy if exists "Survey questions: owner all" on public.survey_questions;
create policy "Survey questions: owner all" on public.survey_questions
    for all to authenticated
    using (exists (select 1 from public.survey_games g where g.id = game_id and g.owner = (select auth.uid())))
    with check (exists (select 1 from public.survey_games g where g.id = game_id and g.owner = (select auth.uid())));

drop policy if exists "Survey responses: owner read" on public.survey_responses;
create policy "Survey responses: owner read" on public.survey_responses
    for select to authenticated
    using (exists (select 1 from public.survey_games g where g.id = game_id and g.owner = (select auth.uid())));

drop policy if exists "Survey responses: owner delete" on public.survey_responses;
create policy "Survey responses: owner delete" on public.survey_responses
    for delete to authenticated
    using (exists (select 1 from public.survey_games g where g.id = game_id and g.owner = (select auth.uid())));

revoke all on public.survey_games, public.survey_questions, public.survey_responses from anon;
grant select, insert, update, delete on public.survey_games, public.survey_questions to authenticated;
grant select, delete on public.survey_responses to authenticated;

drop trigger if exists survey_games_touch on public.survey_games;
create trigger survey_games_touch before update on public.survey_games
    for each row execute function public.touch_updated_at();

-- ── Public functions for people answering a survey ─────────────────────
-- Returns the game's title, whether it's open and its questions — nothing
-- about the host or other people's answers.
create or replace function public.get_survey(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'title', g.title,
        'open', g.status = 'open' and (g.closes_at is null or g.closes_at > now()),
        'closes_at', g.closes_at,
        'questions', coalesce((
            select jsonb_agg(q.prompt order by q.position)
            from public.survey_questions q where q.game_id = g.id
        ), '[]'::jsonb)
    )
    from public.survey_games g
    where g.code = p_code;
$$;

-- Records one person's answers. Returns 'ok', 'closed', 'duplicate' or 'not_found'.
create or replace function public.submit_survey(p_code text, p_respondent text, p_answers jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    g public.survey_games%rowtype;
    n int;
    clean jsonb;
begin
    select * into g from public.survey_games where code = p_code;
    if not found then return 'not_found'; end if;
    if g.status <> 'open' or (g.closes_at is not null and g.closes_at <= now()) then return 'closed'; end if;
    if p_respondent is null or char_length(p_respondent) not between 8 and 64 then
        raise exception 'invalid respondent' using errcode = '22023';
    end if;
    if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
        raise exception 'answers must be an array' using errcode = '22023';
    end if;
    select count(*) into n from public.survey_questions where game_id = g.id;
    -- Keep at most one short text answer per question.
    select coalesce(jsonb_agg(left(btrim(coalesce(a #>> '{}', '')), 80) order by i), '[]'::jsonb)
      into clean
      from jsonb_array_elements(p_answers) with ordinality as t(a, i)
     where i <= n;
    insert into public.survey_responses (game_id, respondent, answers)
    values (g.id, p_respondent, clean)
    on conflict (game_id, respondent) do nothing;
    if not found then return 'duplicate'; end if;
    return 'ok';
end;
$$;

revoke all on function public.get_survey(text), public.submit_survey(text, text, jsonb) from public;
grant execute on function public.get_survey(text), public.submit_survey(text, text, jsonb) to anon, authenticated;
