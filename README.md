# Pokémon Duell-Arena

Ein vereinfachtes Pokémon-TCG-Duell als Web-App, mit echten Kartendaten von der
[Pokémon TCG API](https://pokemontcg.io/).

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

- Spielbrett mit zwei Seiten: aktives Pokémon, Bank (bis 5), Deck, Ablage, Hand
- Kartenziehen, Pokémon auslegen & entwickeln (Basis → Stufe 1)
- Attacken mit Energie-Kosten-System, Schwäche-Modifikator, K.o. & Sieg­bedingung
- Einfache Heuristik-KI für den CPU-Gegner
- Multiplayer über einen 5-stelligen Session-Code (WebRTC/PeerJS, kein eigener
  Server nötig) — ein Spieler erstellt eine Session, der andere tritt bei
- Responsive Layout für Desktop & Tablet, animiertes Feedback bei Angriffen

## Vereinfachte Regeln

Um das Spiel überschaubar zu halten, wurden die offiziellen Pokémon-TCG-Regeln
bewusst vereinfacht:

- 20-Karten-Decks (12 Pokémon + 8 Energie) statt 60-Karten-Decks, keine Prize
  Cards — man gewinnt, wenn der Gegner kein Pokémon mehr im Spiel hat oder
  nicht mehr ziehen kann
- Nur eine Evolutionsstufe (Basis → Stufe 1), keine Trainer-/Item-Karten,
  keine Sonderstatus (Gift, Schlaf, …) und keine Karten-Texteffekte — nur
  Energie-Kosten, Schaden und Schwäche werden ausgewertet
- Ein festes, kuratiertes Roster von sieben Entwicklungslinien (Fire, Water,
  Grass, Lightning, Fighting, Psychic, Colorless) sorgt für ausbalancierte,
  funktionierende Attacken-Kosten trotz Live-Daten von der API
