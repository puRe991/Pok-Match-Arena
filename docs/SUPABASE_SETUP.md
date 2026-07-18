# Supabase-Anbindung — Einrichtung

Die App läuft **offline-first**: ohne Konfiguration nutzt sie eine lokale
Ladder-Simulation. Mit einem Supabase-Projekt schaltet sie auf die geteilte
Online-Liga (gemeinsame Bestenliste). Diese Anleitung führt durch die
Einrichtung.

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

## Was noch fehlt (nächste Ausbaustufe)

Für echtes **PvP-Matchmaking** und autoritative Wertung sind zwei Edge
Functions vorgesehen (im Schema-Kommentar beschrieben):
- `confirm_match` — verrechnet Elo bei beidseitig bestätigtem Ergebnis
- `resolve_season` — Auf-/Abstieg, Orden-Vergabe, Season-Soft-Reset

Diese werden serverseitig mit `service_role` ausgeführt (nicht vom Client) und
sind der nächste Implementierungsschritt, sobald das Schema steht. Aktuell
werden Matches gegen CPU-Arena-Leiter gewertet und lokal verrechnet; die
Bestenliste wird bereits aus Supabase gelesen.
