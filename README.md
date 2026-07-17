# Pokémon Duell-Arena

Ein Pokémon-TCG-Duell als Web-App nach den offiziellen Spielregeln, mit echten
Kartendaten von der [Pokémon TCG API](https://pokemontcg.io/).

## Tech-Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 (via `@tailwindcss/vite`)
- **State Management:** Zustand
- **Kartendaten:** Pokemon TCG API (`api.pokemontcg.io`), mit einem eingebauten
  Offline-Fallback-Kartensatz falls die API nicht erreichbar ist
- **Multiplayer:** PeerJS (WebRTC, serverlos) mit kurzem Session-Code
- **Spiellogik:** reine TypeScript-Regeln-Engine (`src/game/engine.ts`)

## Starten

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` öffnen.

```bash
npm run build   # Produktions-Build (dist/)
npm run lint    # oxlint
```

## Features

- Spielbrett mit zwei Seiten: aktives Pokémon, Bank (bis 5), Deck, Preiskarten,
  Ablage, Hand
- Kartenziehen, Pokémon auslegen & entwickeln über alle drei Stufen
  (Basis → Stufe 1 → Stufe 2)
- Trainer-Karten (Item & Supporter, ein Supporter pro Zug) mit echten,
  ausgeführten Karteneffekten
- Sonderstatus (Gift, Verbrennung, Schlaf, Paralyse, Verwirrung) inklusive
  Checkup-Phase zwischen den Zügen
- Attacken mit Energie-Kosten-System, Schwäche- (×2) und Resistenz-Modifikator
  (−30) sowie generisch ausgeführten Karten-Texteffekten (Münzwürfe,
  Status-Zufügung, Heilung, Kartenziehen, Energie-Abwurf, Deck-Suche, …)
- Einfache Heuristik-KI für den CPU-Gegner
- Multiplayer über einen 5-stelligen Session-Code (WebRTC/PeerJS, kein eigener
  Server nötig) — ein Spieler erstellt eine Session, der andere tritt bei
- Responsive Layout für Desktop & Tablet, animiertes Feedback bei Angriffen

## Offizielle Regeln

Das Spiel folgt ausnahmslos den offiziellen Pokémon-TCG-Regeln:

- 60-Karten-Decks, maximal 4 Kopien jeder Karte (Basis-Energie ausgenommen),
  6 Preiskarten pro Spieler — man gewinnt, wenn der Gegner alle Preiskarten
  aufgenommen hat, kein Pokémon mehr im Spiel hat oder nicht mehr ziehen kann
- Alle drei Evolutionsstufen (Basis, Stufe 1, Stufe 2), Trainer-/Item- und
  Supporter-Karten mit ausgeführten Karteneffekten, echte Sonderstatus
  (Gift, Verbrennung, Schlaf, Paralyse, Verwirrung)
- Startdeck-Aufbau, Mulligan-Regel (kein Basis-Pokémon in der Starthand →
  neu mischen, Gegner darf bis zu 3 Bonuskarten ziehen), kein Ziehen im
  ersten Zug des beginnenden Spielers
- Der volle Kartenpool wird live von der Pokémon TCG API geladen (alle Typen,
  Entwicklungslinien und Trainer-Karten), ohne kuratiertes Roster — ein
  Offline-Kartensatz dient nur als Absicherung, falls die API nicht
  erreichbar ist
