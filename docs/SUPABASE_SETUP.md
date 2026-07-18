# Supabase-Anbindung — Einrichtung

Die App läuft **offline-first**: ohne Konfiguration nutzt sie eine lokale
Ladder-Simulation. Mit einem Supabase-Projekt schaltet sie auf die geteilte
Online-Liga (echte Accounts, gewertetes PvP, gemeinsame Bestenliste).

> **Status für das Projekt `thrxwzzpgkbzjkorpsrs` (Poke-match):** Schema
> `0001` + `0002` sind bereits eingespielt, E-Mail-Registrierung mit
> Auto-Bestätigung ist aktiviert. Die App ist über die `.env` verbunden und
> sofort nutzbar (registrieren → „Gegner suchen"). Die Abschnitte 2/3 sind nur
> für einen Neuaufbau relevant.

## 1. `.env` (bereits vorbereitet)

Die App liest zwei Variablen (siehe `.env.example`). Für dieses Projekt:

```
VITE_SUPABASE_URL=https://thrxwzzpgkbzjkorpsrs.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
```

> Die `.env` ist in `.gitignore` und wird **nicht** eingecheckt. Der
> `sb_publishable_…`-Key ist der öffentliche Client-Key und landet ohnehin im
> Browser-Bundle — das ist so vorgesehen. Das **DB-Passwort** und ein
> **Access-Token** gehören dagegen niemals ins Repo.

Nach dem Setzen der `.env` zeigt der Liga-Screen oben rechts „● Online-Liga".

## 2. Datenbank-Schema einspielen (nötig)

Solange die Tabellen fehlen, zeigt die App die lokale Ghost-Bestenliste. Zum
Aktivieren der echten Liga das Schema anlegen — **eine** der beiden Varianten:

### Variante A — Dashboard (am schnellsten)
1. Supabase-Dashboard → **SQL Editor** → **New query**
2. Inhalt von [`supabase/migrations/0001_league_schema.sql`](../supabase/migrations/0001_league_schema.sql)
   einfügen und **Run**.

### Variante B — Supabase CLI
```bash
supabase login                                   # öffnet Browser, setzt Access-Token
supabase link --project-ref thrxwzzpgkbzjkorpsrs # fragt nach dem DB-Passwort
supabase db push                                 # spielt supabase/migrations/ ein
```
> `supabase init` ist nur nötig, falls noch keine `supabase/config.toml`
> existiert. Der `migrations/`-Ordner in diesem Repo ist bereits im richtigen
> Format.

## 3. Anonyme Logins aktivieren (empfohlen)

Damit die App ohne E-Mail-Registrierung ein Profil in der Liga anlegen kann:

- Dashboard → **Authentication** → **Sign In / Providers** →
  **Anonymous sign-ins** aktivieren.

Ohne diesen Schritt bleibt die App im Lese-/Offline-Modus (die Bestenliste wird
gelesen, aber das eigene Profil wird nicht zentral gespeichert). Ist er aktiv,
meldet sich die App automatisch anonym an und legt/aktualisiert die
`profiles`-Zeile beim Handle-Setzen und nach Matches.

## 4. Prüfen

Nach den Schritten 2 + 3 im Liga-Screen den Tab **🌍 Meister-Liga** öffnen und
„↻ Aktualisieren" klicken — es sollten echte Profilzeilen (statt der
Ghost-Trainer) erscheinen.

## Accounts & gewertetes PvP (umgesetzt)

- **Registrierung/Login** per E-Mail + Passwort (Liga-Screen, Auth-Panel). Der
  Account wird beim Anmelden mit dem Liga-Profil verbunden (`bindAccount` →
  Upsert in `profiles`).
- **PvP-Matchmaking**: „Gegner suchen" ruft die SQL-Funktion `matchmake()` auf
  (atomares Pairing per `FOR UPDATE SKIP LOCKED`). Der Wartende hostet eine
  PeerJS-Session, der Beitretende bekommt den Code und verbindet sich → das
  Duell läuft P2P wie gehabt.
- **Serverautoritative Elo**: nach dem Match melden beide Seiten das Ergebnis
  (`report_match_result()`); bei Übereinstimmung verrechnet die Funktion das
  Elo **serverseitig** in `profiles` (Client kann Elo nicht direkt schreiben —
  Trigger-Schutz). Das ist das Anti-Cheat-Fundament.

### Nächste Ausbaustufe
- `resolve_season` als Edge Function (serverseitiger Season-Loop: Auf-/Abstieg,
  Orden-Vergabe, Soft-Reset) — aktuell läuft die Season-Wertung der
  **Solo-Kampagne** lokal.
- Signierte Match-Logs / Dispute-Auflösung für stärkeres Anti-Cheat.
- Divisions-/Elo-Sync zwischen Solo-Fortschritt und PvP-Elo.
