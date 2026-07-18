-- Esports Multiplayer-Liga — Datenbank-Schema (Supabase / Postgres)
-- Siehe docs/esports-multiplayer-liga-konzept.md
--
-- Wichtiges Sicherheitsprinzip: Elo/Division/Orden werden NIE direkt vom
-- Client geschrieben, sondern nur serverseitig (Edge Function mit
-- service_role). Clients dürfen lesen (Bestenliste) und ihr eigenes Profil-
-- Handle sowie Match-Ergebnis-MELDUNGEN setzen.

-- ── Profile ──────────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  handle     text unique not null,
  elo        int  not null default 1000,
  division   int  not null default 1,
  badges     int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Jeder darf die Bestenliste lesen.
create policy "profiles are readable by everyone"
  on profiles for select using (true);

-- Ein Nutzer darf seine eigene Profilzeile anlegen …
create policy "users can insert their own profile"
  on profiles for insert with check (auth.uid () = id);

-- … und nur das Handle bearbeiten. Elo/Division/Badges bleiben clientseitig
-- unveränderbar (werden per Edge Function / service_role gesetzt, die RLS
-- umgeht). Der Spaltenschutz erfolgt über einen Trigger.
create policy "users can update their own handle"
  on profiles for update using (auth.uid () = id) with check (auth.uid () = id);

create or replace function protect_ranked_columns ()
  returns trigger language plpgsql as $$
begin
  if auth.role () <> 'service_role' then
    new.elo := old.elo;
    new.division := old.division;
    new.badges := old.badges;
  end if;
  new.updated_at := now ();
  return new;
end;
$$;

drop trigger if exists trg_protect_ranked_columns on profiles;
create trigger trg_protect_ranked_columns
  before update on profiles
  for each row execute function protect_ranked_columns ();

-- ── Erspielte Orden ─────────────────────────────────────────────────────
create table if not exists earned_badges (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references profiles (id) on delete cascade,
  badge_id   text not null,
  season_id  bigint,
  final_rank int,
  earned_at  timestamptz not null default now(),
  unique (player_id, badge_id)
);

alter table earned_badges enable row level security;
create policy "earned badges are readable by everyone"
  on earned_badges for select using (true);
-- Schreiben nur serverseitig (service_role) → keine INSERT/UPDATE-Policy.

-- ── Seasons ──────────────────────────────────────────────────────────────
create table if not exists seasons (
  id        bigint generated always as identity primary key,
  name      text not null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  status    text not null default 'active' -- active | resolving | closed
);

alter table seasons enable row level security;
create policy "seasons are readable by everyone"
  on seasons for select using (true);

-- ── Matchmaking-Warteschlange ───────────────────────────────────────────
create table if not exists matchmaking_queue (
  player_id   uuid primary key references profiles (id) on delete cascade,
  elo         int not null,
  division    int not null,
  enqueued_at timestamptz not null default now()
);

alter table matchmaking_queue enable row level security;
create policy "queue is readable by everyone"
  on matchmaking_queue for select using (true);
create policy "users manage their own queue entry"
  on matchmaking_queue for all
  using (auth.uid () = player_id) with check (auth.uid () = player_id);

-- ── Gemeldete Matches ────────────────────────────────────────────────────
create table if not exists matches (
  id            bigint generated always as identity primary key,
  season_id     bigint references seasons (id),
  player_a      uuid references profiles (id),
  player_b      uuid references profiles (id),
  reported_by_a text,          -- 'a' | 'b' (Ergebnis-Sicht von Spieler A)
  reported_by_b text,          -- 'a' | 'b' (Ergebnis-Sicht von Spieler B)
  winner        uuid,          -- gesetzt, wenn beide Meldungen übereinstimmen
  elo_delta_a   int,
  elo_delta_b   int,
  log_hash      text,
  status        text not null default 'pending', -- pending | confirmed | disputed
  created_at    timestamptz not null default now()
);

alter table matches enable row level security;
create policy "participants can read their matches"
  on matches for select using (auth.uid () in (player_a, player_b));
create policy "participants can report their result"
  on matches for update
  using (auth.uid () in (player_a, player_b))
  with check (auth.uid () in (player_a, player_b));

-- Elo-Verrechnung, Bestätigung, Badge-Vergabe und Season-Auflösung laufen in
-- Edge Functions (confirm_match, resolve_season) mit service_role.
