# Pokémon Duell-Arena

Ein Pokémon-TCG-Duell als Web-App: echte Kartendaten von der
[Pokémon TCG API](https://pokemontcg.io/), Booster-Packs zum Sammeln, ein
Deck-Builder für 60-Karten-Decks und ein Spielbrett mit Prize Cards und
Status-Effekten.

## Tech-Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 (via `@tailwindcss/vite`) + Framer Motion
- **State Management:** Zustand (+ `zustand/middleware persist` für die Sammlung)
- **Kartendaten:** Pokemon TCG API (`api.pokemontcg.io`), mit einem eingebauten
  Offline-Fallback-Kartensatz falls die API nicht erreichbar ist
- **Multiplayer:** PeerJS (WebRTC, serverlos) mit kurzem Session-Code
- **Spiellogik:** reine TypeScript-Regeln-Engine (`src/game/engine.ts`)
- **Speicher:** Sammlung & Decks liegen in `localStorage` (kein Backend)

## Starten

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` öffnen.

```bash
npm run build   # Produktions-Build (dist/)
npm run lint    # oxlint
npm test        # Vitest (einmaliger Lauf)
npm run test:watch  # Vitest im Watch-Modus
```

## Android-App (Capacitor)

Die Web-App wird per [Capacitor](https://capacitorjs.com/) in eine native
Android-App verpackt (`appId: io.pokmatch.arena`, min. Android 7.0 / API 24).

**Dev-APK herunterladen (ohne lokales Setup):** Der GitHub-Actions-Workflow
[`Android Dev-APK`](.github/workflows/android-apk.yml) baut bei jedem Push
eine Debug-APK. Unter **Actions → Android Dev-APK → letzter Lauf → Artifacts**
liegt `pok-match-arena-dev-apk` zum Download bereit.

**APK lokal bauen** (benötigt JDK 17+ und das Android SDK, `ANDROID_HOME`
gesetzt):

```bash
npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Weitere Skripte:

```bash
npm run cap:sync       # Web-Assets → Android kopieren
npm run android:build  # Build + Sync + Android Studio öffnen
```

APK auf dem Gerät installieren: In den Android-Einstellungen „Installation aus
unbekannten Quellen" für den Browser/Dateimanager erlauben, dann die APK öffnen.

### Windows: „Cannot find module '...lightningcss.win32-ia32-msvc.node'"

Dieser Fehler bedeutet, dass eine **32-Bit-Version von Node.js** installiert
ist (`ia32`). Tailwind CSS v4 nutzt intern
[lightningcss](https://github.com/parcel-bundler/lightningcss), das für
Windows nur noch 64-Bit-Binaries (`x64`/`arm64`) veröffentlicht — ein 32-Bit-
Build existiert nicht mehr. `npm install` meldet das inzwischen sofort und
verständlich (`EBADPLATFORM`, dank der `os`/`cpu`-Felder in `package.json`),
statt erst beim Start von `vite` mit einem kryptischen Modul-Fehler
abzubrechen.

Abhilfe: die 64-Bit-Version von Node.js installieren (nicht "x86") —
https://nodejs.org/, danach `node -p process.arch` prüfen (sollte `x64` oder
`arm64` sein), `node_modules` löschen und `npm install` erneut ausführen.

## Features

### Deck & Kartenmanagement
- Beim ersten Start wird automatisch ein zufälliges 60-Karten-Starter-Deck
  generiert und aktiviert
- Pack-Opening: Set wählen (Base Set, Jungle, Fossil, …), Pack mit 11 Karten
  öffnen (6 Common, 3 Uncommon, 1 Rare/Holo-Rare, 1 Basis-Energie), mit
  Flip-Animation, Holo-Glow und Pack-Verlauf
- **Tägliche Gratis-Packs** im Stil von Pokémon TCG Pocket: Jeden Tag können
  zwei kostenlose Boosterpacks geöffnet werden. Das Kontingent wird um
  Mitternacht (lokale Zeit) zurückgesetzt – mit Live-Countdown im
  Pack-Opening-Screen und Badge im Hauptmenü, das die verbleibenden
  Gratis-Packs anzeigt
- Deck-Builder: Sammlung durchsuchen/filtern, Deck zusammenstellen
  (60 Karten, max. 4x pro Karte, Basis-Energie unbegrenzt), mehrere Decks
  verwalten und ein aktives Deck festlegen

### Spielbrett & Kampf
- Zwei Spielerseiten: aktives Pokémon, Bank (bis 5), Deck, Ablage, Hand,
  **Prize-Card-Stapel**
- Kartenziehen, Pokémon auslegen & entwickeln (Basis → Stufe 1 → Stufe 2)
- Attacken mit Energie-Kosten-System, Schwäche-Modifikator
- **Status-Effekte**: Vergiftet, Verbrannt, Schlafend, Paralysiert, Verwirrt
  (aus dem Angriffstext der echten Karten erkannt, inkl. Between-Turns-Tick
  und Münzwurf-Mechanik)
- K.o. & **Prize Cards** nach Standard-Regeln: 6 Prizes pro Spieler, bei K.o.
  zieht der Gegner eine Prize Card, Sieg bei allen genommenen Prizes (oder
  wenn der Gegner kein Pokémon mehr hat / nicht mehr ziehen kann)
- **Spielbare Trainer-Karten**: eine Auswahl klassischer Trainer wirkt echt im
  Duell – Bill (2 Karten ziehen), Professor Oak (Hand abwerfen, 7 ziehen),
  Trank / Supertrank (heilen), Vollheilung (Zustände entfernen), Wechsel &
  Windstoß (Aktives Pokémon tauschen – eigenes bzw. gegnerisches),
  Pokémon-Center (alle heilen), Energie-Entzug (gegnerische Energie abwerfen),
  Energie-Rückgewinnung, PlusPower (+10 Schaden), Energiesuche (Basis-Energie
  aus dem Deck ziehen), Zocker (Hand ins Deck mischen, Münzwurf: 8 bzw. 1 ziehen)
  und Wiederbelebung (Basis-Pokémon aus der Ablage auf die Bank). Karten mit Ziel
  öffnen eine Zielauswahl auf dem Spielbrett; die CPU spielt sie ebenfalls situativ.
- **Spezial-Energie**: Die Doppelte Farblos-Energie (liefert 2 Farblos-Symbole)
  ist deck-legal, wird in Packs gesammelt und von der Kosten- und Rückzugs-Engine
  korrekt verrechnet.

### Esports-Liga & Orden (Ranglisten-System)
- **Divisionen = Regionen**: Kanto → Paldea → Meister-Liga. Jede Region ist
  eine Division mit 8 Arenen (Sub-Rängen).
- **Alle Orden erspielbar**: gewertete Matches gegen thematische Arena-Leiter-
  Decks (Feuer, Wasser, …) sammeln Season-Punkte. Wer beim Werten der Saison
  unter die **Top 3** kommt, erhält den **Orden** und **steigt** in die nächste
  Arena / Region auf; die unteren Plätze steigen ab.
- **Orden-Vitrine** über alle 9 Regionen (72 Orden) und eine **globale
  Bestenliste** (Elo). Erreichbar über „🏆 Esports-Liga & Orden" im Hauptmenü.
- **Accounts & gewertetes PvP** (mit Supabase): Registrierung/Login per
  E-Mail + Passwort, echtes Matchmaking gegen reale Gegner (Queue-Pairing per
  SQL-Funktion + PeerJS-Duell) und **serverautoritatives Elo** (beidseitige
  Ergebnis-Bestätigung, Client kann Elo nicht fälschen) als Anti-Cheat-Basis.
- **Offline-first**: läuft ohne Backend mit lokaler Ladder-Simulation
  (Ghost-Trainer). Sind `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` gesetzt
  (siehe `.env.example` + `supabase/migrations/` + `docs/SUPABASE_SETUP.md`),
  schaltet die App auf die geteilte Online-Liga um. Konzept:
  `docs/esports-*-konzept.md`.

### Multiplayer & NPC
- Einfache heuristische CPU-KI (spielt Bank, entwickelt, hängt passende
  Energie an, greift an, zieht sich zurück, promotet nach K.o.) mit einem
  zufällig zusammengestellten, legalen Deck
- Multiplayer über einen 5-stelligen Session-Code (WebRTC/PeerJS, kein
  eigener Server nötig) — beide Spieler treten mit ihrem eigenen aktiven
  Deck an; der Host führt die Spiellogik autoritativ aus

### Sonstiges
- Responsive Layout für Desktop & Tablet, animiertes Feedback bei Angriffen

## Vereinfachte Regeln

Um das Spiel überschaubar zu halten, wurden einige Aspekte der offiziellen
Pokémon-TCG-Regeln bewusst vereinfacht:

- **Trainer-Karten** sind nur spielbar (und deck-legal), wenn die Regel-Engine
  ihren Effekt kennt – aktuell die o. g. Auswahl klassischer „Base"-Ära-Trainer,
  erkannt am Kartennamen (`src/game/trainers.ts`). Alle übrigen Trainer werden
  gesammelt und im Pack-Opening angezeigt, sind im Deck-Builder aber (noch) nicht
  auswählbar. Von der **Spezial-Energie** ist aktuell die Doppelte Farblos-Energie
  implementiert und deck-legal (`src/game/normalize.ts`); weitere Spezial-Energie
  wird gesammelt, ist aber noch nicht auswählbar.
- **Set-Auswahl** ist auf die klassischen „Base“-Ära-Sets (Base Set, Jungle,
  Fossil, Base Set 2, Team Rocket, Gym Heroes) beschränkt, da diese ein
  einfaches 4-stufiges Rarity-System (Common/Uncommon/Rare/Holo Rare) und
  keine Sondermechaniken wie EX/GX/V (inkl. deren Extra-Prize-Regeln) haben.
- **Status-Effekte** werden per Stichwort-Erkennung aus dem echten
  Angriffstext abgeleitet (z. B. „poison“, „paralyze“, „flip a coin“ →
  50%-Chance), nicht durch exaktes Parsen jeder individuellen Karten-Regel.
- Pro Pokémon nur eine Attacke pro Zug, ein Energie-Attachment pro Zug, ein
  Retreat pro Zug — wie im echten Spiel.
