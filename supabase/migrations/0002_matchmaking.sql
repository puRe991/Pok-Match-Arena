-- Esports-Liga — echtes PvP-Matchmaking + serverautoritative Elo
-- Baut auf 0001_league_schema.sql auf. Siehe docs/esports-multiplayer-liga-konzept.md
--
-- Anti-Cheat-Fundament: gewertete PvP-Elo wird ausschließlich serverseitig in
-- SECURITY-DEFINER-Funktionen verändert. Direkte Client-Writes auf
-- profiles.elo/division/badges bleiben durch einen Trigger blockiert; nur
-- Code-Pfade, die bewusst ein GUC-Flag setzen (die geprüften RPCs), dürfen
-- schreiben.

-- ── Schema-Ergänzungen ───────────────────────────────────────────────────
alter table matchmaking_queue add column if not exists peer_code text;
alter table matches add column if not exists host_peer_code text;

-- ── Trigger-Schutz auf GUC-Flag umstellen ───────────────────────────────
create or replace function protect_ranked_columns ()
  returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_ranked_write', true), 'off') <> 'on' then
    new.elo := old.elo;
    new.division := old.division;
    new.badges := old.badges;
  end if;
  new.updated_at := now ();
  return new;
end;
$$;

-- ── Elo-Hilfsfunktion (spiegelt src/game/ranked/elo.ts) ─────────────────
create or replace function elo_delta (p_elo int, p_opp int, p_won boolean, p_division int)
  returns int language sql immutable as $$
  select round(
    greatest(16, 40 - (greatest(p_division, 1) - 1) * 3)                    -- K-Faktor
    * ((case when p_won then 1 else 0 end)
       - 1.0 / (1.0 + power(10, (p_opp - p_elo) / 400.0)))                  -- Erwartung
  )::int;
$$;

-- ── Matchmaking: atomar einen wartenden Gegner beanspruchen ─────────────
-- Liest die eigene Elo/Division selbst aus profiles (Client liefert keine
-- Wertung → nicht manipulierbar). Rolle 'guest' erhält den Peer-Code des
-- Hosts; Rolle 'host' wartet, bis jemand beitritt.
create or replace function matchmake (p_range int default 400)
  returns table (role text, peer_code text, match_id bigint)
  language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid ();
  v_elo int;
  v_div int;
  v_opp record;
  v_match_id bigint;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  select elo, division into v_elo, v_div from profiles where id = v_me;
  if v_elo is null then raise exception 'no profile'; end if;

  select q.* into v_opp
  from matchmaking_queue q
  where q.player_id <> v_me
    and q.peer_code is not null
    and abs(q.elo - v_elo) <= p_range
  order by q.enqueued_at asc
  for update skip locked
  limit 1;

  if found then
    delete from matchmaking_queue where player_id in (v_opp.player_id, v_me);
    insert into matches (player_a, player_b, host_peer_code, status)
      values (v_opp.player_id, v_me, v_opp.peer_code, 'ready')
      returning id into v_match_id;
    return query select 'guest'::text, v_opp.peer_code, v_match_id;
  else
    insert into matchmaking_queue (player_id, elo, division, peer_code)
      values (v_me, v_elo, v_div, null)
      on conflict (player_id)
        do update set elo = excluded.elo, division = excluded.division, peer_code = null, enqueued_at = now();
    return query select 'host'::text, null::text, null::bigint;
  end if;
end;
$$;

-- Host hinterlegt seinen PeerJS-Code, sobald die Session offen ist.
create or replace function set_matchmaking_peer_code (p_code text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  update matchmaking_queue set peer_code = p_code where player_id = auth.uid ();
end;
$$;

create or replace function cancel_matchmaking ()
  returns void language plpgsql security definer set search_path = public as $$
begin
  delete from matchmaking_queue where player_id = auth.uid ();
end;
$$;

-- ── Ergebnis melden: beidseitige Bestätigung → Elo serverseitig ─────────
create or replace function report_match_result (p_i_won boolean, p_match_id bigint default null)
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid ();
  m matches%rowtype;
  v_winner uuid;
  pa profiles%rowtype;
  pb profiles%rowtype;
  da int;
  db int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;

  if p_match_id is null then
    select * into m from matches
    where v_me in (player_a, player_b) and status in ('ready', 'pending')
    order by created_at desc limit 1 for update;
  else
    select * into m from matches where id = p_match_id for update;
  end if;
  if not found then raise exception 'match not found'; end if;
  if v_me not in (m.player_a, m.player_b) then raise exception 'not a participant'; end if;

  v_winner := case when p_i_won then v_me
                   when v_me = m.player_a then m.player_b else m.player_a end;
  if v_me = m.player_a then
    update matches set reported_by_a = v_winner::text where id = m.id;
  else
    update matches set reported_by_b = v_winner::text where id = m.id;
  end if;

  select * into m from matches where id = m.id;
  if m.reported_by_a is null or m.reported_by_b is null then
    return 'pending';
  end if;
  if m.reported_by_a <> m.reported_by_b then
    update matches set status = 'disputed' where id = m.id;
    return 'disputed';
  end if;

  -- Übereinstimmung → Elo autoritativ verrechnen.
  v_winner := m.reported_by_a::uuid;
  select * into pa from profiles where id = m.player_a;
  select * into pb from profiles where id = m.player_b;
  da := elo_delta (pa.elo, pb.elo, v_winner = pa.id, pa.division);
  db := elo_delta (pb.elo, pa.elo, v_winner = pb.id, pb.division);

  perform set_config('app.allow_ranked_write', 'on', true);
  update profiles set elo = elo + da where id = pa.id;
  update profiles set elo = elo + db where id = pb.id;
  update matches set winner = v_winner, elo_delta_a = da, elo_delta_b = db, status = 'confirmed' where id = m.id;
  return 'confirmed';
end;
$$;

-- ── Rechte ───────────────────────────────────────────────────────────────
grant execute on function matchmake (int) to authenticated;
grant execute on function set_matchmaking_peer_code (text) to authenticated;
grant execute on function cancel_matchmaking () to authenticated;
grant execute on function report_match_result (boolean, bigint) to authenticated;
