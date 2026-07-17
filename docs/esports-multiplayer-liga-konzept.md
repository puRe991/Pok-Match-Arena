# Esports Multiplayer-Liga — Architektur & Design

> Aufbauend auf [`esports-ranglisten-konzept.md`](./esports-ranglisten-konzept.md).
> Getroffene Entscheidungen:
> - **Infrastruktur:** dünnes Backend (**Supabase**) — P2P-Gameplay bleibt, der
>   geteilte Liga-Zustand liegt zentral.
> - **Liga-Modell:** **Divisionen = Regionen** — jede Division ist eine
>   Pokémon-Region; Aufstieg verleiht den Orden. Orden-Sammeln und
>   kompetitive Liga verschmelzen.

Dieses Dokument beschreibt, **wie** aus der aktuellen serverlosen App ein
echtes gerätübergreifendes Multiplayer-Liga-System wird, ohne die Stärken der
bestehenden Architektur (P2P-Duelle via PeerJS, reine TS-Regel-Engine)
aufzugeben.

---

## 1. Architektur: Hybrid (P2P-Spiel + dünnes Backend)

Das Teure — das Echtzeit-Duell — bleibt **serverlos peer-to-peer**. Zentral
liegt nur der **leichte, geteilte Zustand** einer Liga.

```
   Spieler A  ⇄  (PeerJS / WebRTC, Spiellogik)  ⇄  Spieler B
       │                                              │
       │  Ergebnis-Meldung + Match-Log (signiert)     │
       └──────────────┬───────────────────────────────┘
                      ▼
              ┌────────────────┐
              │    Supabase    │   Auth · Postgres · Realtime · Edge Functions
              │  ─────────────  │
              │ • Identität     │
              │ • Matchmaking   │
              │ • Elo / Ligen   │
              │ • Leaderboard   │
              │ • Seasons/Orden │
              └────────────────┘
```

**Was zentral liegt (Supabase):** Wer bin ich, wer sucht gerade ein Match, wie
ist die Tabelle, wer steigt auf/ab, welche Orden habe ich.

**Was P2P bleibt (PeerJS, unverändert):** Der eigentliche Kampf — Kartenziehen,
Attacken, Prize Cards. Die vorhandene autoritative Host-Logik wird
weiterverwendet; das Backend berührt den Spielablauf **nicht**, nur das
**Ergebnis**.

**Warum so?**
- Kein teurer, skalierender Echtzeit-Spielserver nötig.
- Supabase Free-Tier reicht für Login + Tabelle + Matchmaking locker aus.
- Anbindung in ~1 Tag; bestehender Code bleibt größtenteils erhalten.
- Später aufrüstbar auf autoritativen Server (§9), falls Cheating real wird.

---

## 2. Liga-Modell: Divisionen = Regionen

Die Elo-Ladder ist in **Divisionen** gestaffelt, und **jede Division ist eine
Region**. Wer eine Division dominiert (Top 3 am Saisonende), bekommt den
**Orden** und **steigt in die nächste Region auf**.

| Division | Region  | Elo-Fenster (Richtwert) | Orden bei Aufstieg |
|---------:|---------|-------------------------|--------------------|
| 1        | Kanto   | Start – 1099            | Kanto-Orden-Set    |
| 2        | Johto   | 1100 – 1299             | Johto-Orden-Set    |
| 3        | Hoenn   | 1300 – 1499             | Hoenn-Orden-Set    |
| 4        | Sinnoh  | 1500 – 1699             | Sinnoh-Orden-Set   |
| 5        | Einall  | 1700 – 1899             | Einall-Orden-Set   |
| 6        | Kalos   | 1900 – 2099             | Kalos-Orden-Set    |
| 7        | Alola   | 2100 – 2299             | Z-Kristalle        |
| 8        | Galar   | 2300 – 2499             | Galar-Orden-Set    |
| 9        | Paldea  | 2500+                   | Paldea-Orden-Set   |
| ★        | **Meister-Liga** | ewige globale Bestenliste | Champion-Titel |

- **Aufstieg** = Top-3-Platz der Division am Saisonende → nächste Region + Orden.
- **Abstieg** = unterste ~20 % → tiefere Division (Division 1 hat keinen
  Abstieg). Orden bleiben dauerhaft in der Vitrine, auch bei Abstieg.
- **Innerhalb einer Division**: die 8 Arenen der Region sind „Sub-Ränge"
  (z. B. Felsorden-Rang … Erdorden-Rang), die man durch Siege durchläuft — so
  bleibt das Orden-für-Orden-Gefühl auch im Multiplayer erhalten.

---

## 3. Datenbank-Schema (Supabase / Postgres)

Vorschlag für die Kern-Tabellen. Alle mit **Row Level Security** (§7).

```sql
-- Spielerprofil (1:1 mit auth.users)
create table profiles (
  id            uuid primary key references auth.users(id),
  handle        text unique not null,
  elo           int  not null default 1000,
  division      int  not null default 1,      -- Region-Index 1..9
  created_at    timestamptz default now()
);

-- Erspielte Orden (dauerhaft)
create table earned_badges (
  id         bigint generated always as identity primary key,
  player_id  uuid references profiles(id),
  badge_id   text not null,                    -- 'boulder', 'cascade', ...
  season_id  bigint references seasons(id),
  final_rank int,
  earned_at  timestamptz default now(),
  unique (player_id, badge_id)                 -- jeder Orden nur einmal
);

-- Saisons (Ladder-Season, zeitbasiert)
create table seasons (
  id         bigint generated always as identity primary key,
  name       text not null,                    -- 'Season 1'
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     text not null default 'active'    -- active | resolving | closed
);

-- Matchmaking-Warteschlange
create table matchmaking_queue (
  player_id  uuid primary key references profiles(id),
  elo        int not null,
  division   int not null,
  enqueued_at timestamptz default now()
);

-- Gemeldete Matches
create table matches (
  id           bigint generated always as identity primary key,
  season_id    bigint references seasons(id),
  player_a     uuid references profiles(id),
  player_b     uuid references profiles(id),
  reported_by_a text,        -- 'a' | 'b' | null  (Ergebnis-Meldung Spieler A)
  reported_by_b text,        -- 'a' | 'b' | null  (Ergebnis-Meldung Spieler B)
  winner       uuid,         -- gesetzt, wenn beide Meldungen übereinstimmen
  elo_delta_a  int,
  elo_delta_b  int,
  log_hash     text,         -- Hash des signierten Match-Logs
  status       text not null default 'pending', -- pending | confirmed | disputed
  created_at   timestamptz default now()
);
```

**Leaderboard** = einfach `select * from profiles order by elo desc limit N`
(pro Division filterbar). Über **Supabase Realtime** kann die Tabelle live
aktualisiert werden.

---

## 4. Matchmaking (serverlos-freundlich)

1. Spieler klickt „Gewertetes Match suchen" → Eintrag in `matchmaking_queue`.
2. Eine **Edge Function** (oder ein einfacher Client-Poll auf die Realtime-
   Queue) paart zwei Spieler mit ähnlicher Elo (`abs(a.elo - b.elo)` minimal,
   Fenster wächst mit Wartezeit).
3. Backend gibt beiden einen **PeerJS-Session-Code** (wie heute) → das
   eigentliche Duell läuft **P2P**, exakt über die bestehende Multiplayer-Logik.
4. Nach dem Match: Ergebnis-Meldung (§5).

Der Session-Code-Mechanismus existiert bereits (`multiplayer/peer.ts`) — das
Matchmaking wählt ihn nur automatisch statt manueller Eingabe.

---

## 5. Ergebnis-Meldung & Fairness (im P2P-Setup)

Da der Host die Logik lokal ausführt, wird das Ergebnis **beidseitig
bestätigt**, bevor Elo verrechnet wird:

1. Match-Ende → **beide** Clients schreiben ihre Ergebnis-Sicht (`reported_by_a`
   / `reported_by_b`) in die `matches`-Zeile.
2. **Stimmen beide überein** → Edge Function verrechnet Elo (§6), setzt
   `status = 'confirmed'`, aktualisiert `profiles.elo`.
3. **Widerspruch** → `status = 'disputed'`, keine Elo-Änderung; optional
   Auswertung des signierten **Match-Logs** (`log_hash`) oder manuelle Klärung.
4. **Timeout** (Gegner meldet nicht) → nach X Minuten Auto-Bestätigung der
   Melder-Sicht, mit leichter Anti-Abuse-Schwelle.

> **Anti-Cheat-Realismus:** Für den Start reicht „beidseitige Bestätigung +
> Report". Volle Server-Autorität (Regel-Engine serverseitig) ist der Ausbau in
> §9 — erst nötig, wenn organisiertes Cheating auftritt.

---

## 6. Elo / Wertung

- Standard-Elo mit divisionsabhängigem **K-Faktor** (höhere Divisionen =
  kleinerer K, stabilere Ränge).
- `elo_delta = K * (result - erwartung)`, `erwartung = 1/(1+10^((eloB-eloA)/400))`.
- Elo bestimmt die **Division** (Tabelle §2). Überschreitet die Elo die
  Division-Grenze **und** ist Saisonende + Top-3 → Aufstieg + Orden.
- **Season-Soft-Reset:** am Saisonende Elo Richtung Divisions-Mitte ziehen
  (`elo = mitte + (elo - mitte) * 0.5`), damit jede Season Bewegung entsteht,
  ohne Fortschritt komplett zu löschen.

---

## 7. Sicherheit (Row Level Security)

Kritisch, weil der Client direkt mit Supabase spricht:

- `profiles`: jeder darf **lesen** (Leaderboard), aber nur die **eigene** Zeile
  bearbeiten — und **Elo/Division dürfen Clients NICHT direkt schreiben**.
- **Elo-Updates ausschließlich über Edge Functions** (`service_role`), nie
  direkt vom Client → verhindert „ich setze meine Elo auf 9999".
- `matches`: ein Spieler darf nur seine eigene Ergebnis-Spalte (`reported_by_*`)
  in Matches setzen, an denen er beteiligt ist.
- `earned_badges`: nur serverseitig (Edge Function) beschreibbar.

Damit ist die einzige vertrauenswürdige Schreibinstanz für Wertungen der
Server-Code — der Client kann nur *melden*, nicht *bestimmen*.

---

## 8. Season-Loop & Auf-/Abstieg

Am `ends_at` einer Season läuft eine **Edge Function `resolve_season`**:

1. `status = 'resolving'`.
2. Pro Division: sortiere Spieler nach Elo → **Top 3 → Orden** (`earned_badges`)
   **+ Aufstieg** (`division += 1`); **unterste ~20 % → Abstieg**.
3. Season-Belohnungen buchen (Arena-Packs → koppelt an bestehendes Pack-Opening).
4. Elo-Soft-Reset (§6).
5. Neue Season anlegen, `status = 'active'`.

Timing analog zum bestehenden Gratis-Pack-Mitternachts-Reset (`dailyPacks.ts`),
nur über den Server als Wahrheitsquelle statt lokal.

---

## 9. Ausbaustufe: autoritativer Match-Server (optional, später)

Wenn die Liga ernst wird und P2P-Manipulation zum Problem:
- Regel-Engine (`engine.ts`) läuft **serverseitig** (sie ist bereits rein/
  deterministisch — gut portierbar) als Edge Function / kleiner Node-Dienst.
- Clients senden nur **Aktionen**, der Server validiert und broadcastet den
  Zustand → kein Client kann das Ergebnis fälschen.
- Deutlich mehr Aufwand/Latenz — daher bewusst als **Phase 4+**, nicht zum Start.

---

## 10. Umsetzungs-Roadmap

**Phase 0 — Supabase-Setup**
- Projekt anlegen, Schema (§3) migrieren, RLS-Policies (§7), Auth (E-Mail/
  Magic-Link oder anonym-zu-verknüpfen).
- Client: `@supabase/supabase-js` einbinden, `authStore` (Zustand) analog zu
  `collectionStore`.

**Phase 1 — Identität & Leaderboard (read-only)**
- Login/Handle, `profiles`-Zeile anlegen.
- **Leaderboard-Screen** (Realtime), erreichbar aus dem Hauptmenü-Grid neben
  „Packs" / „Deck-Builder".

**Phase 2 — Gewertetes Matchmaking**
- „Gewertetes Match suchen" → Queue → Auto-Session-Code → bestehendes
  P2P-Duell.
- Ergebnis-Meldung (§5) + Elo-Edge-Function (§6). Division-Zuordnung.

**Phase 3 — Seasons, Orden & Aufstieg**
- `seasons`, `resolve_season`-Function, Auf-/Abstieg, Orden-Verleihung →
  Orden-Vitrine (aus dem ersten Konzept) wird backend-gestützt.
- Season-Belohnungen an Pack-Opening.

**Phase 4 — Wettbewerbs-Extras**
- Wöchentliche Turniere (Bracket), Match-History, Anti-Cheat-Ausbau (§9),
  optional Team-/Clan-Ligen.

---

## 11. Nächste offene Fragen

1. **Login-Art:** E-Mail/Magic-Link, anonyme Accounts (später verknüpfbar) oder
   OAuth (Google/Discord)? Empfehlung: anonym + optionales Upgrade — niedrigste
   Einstiegshürde.
2. **Season-Länge:** 14 vs. 28 Tage.
3. **Matchmaking-Trigger:** Edge-Function-Cron vs. Client-seitiges
   Realtime-Pairing (einfacher, reicht bei kleiner Spielerzahl).
4. **Dispute-Handling:** automatisch (Log-Hash) vs. „selten & manuell" zum Start.

---

*Ideen-Ausarbeitung des Multiplayer-Liga-Teils. Kein Feature-Code — die
Umsetzung folgt den Phasen aus §10, beginnend mit dem Supabase-Setup (Phase 0).*
