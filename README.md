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
```

## Features

### Deck & Kartenmanagement
- Beim ersten Start wird automatisch ein zufälliges 60-Karten-Starter-Deck
  generiert und aktiviert
- Pack-Opening: Set wählen (Base Set, Jungle, Fossil, …), Pack mit 11 Karten
  öffnen (6 Common, 3 Uncommon, 1 Rare/Holo-Rare, 1 Basis-Energie), mit
  Flip-Animation, Holo-Glow und Pack-Verlauf
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

- **Trainer-/Item-Karten und Spezial-Energie** werden gesammelt und im Pack-
  Opening angezeigt, sind im Deck-Builder aber aktuell nicht spielbar (nur
  Pokémon + Basis-Energie sind deck-legal) — die Regel-Engine implementiert
  keine Karten-Texteffekte für Trainer.
- **Set-Auswahl** ist auf die klassischen „Base“-Ära-Sets (Base Set, Jungle,
  Fossil, Base Set 2, Team Rocket, Gym Heroes) beschränkt, da diese ein
  einfaches 4-stufiges Rarity-System (Common/Uncommon/Rare/Holo Rare) und
  keine Sondermechaniken wie EX/GX/V (inkl. deren Extra-Prize-Regeln) haben.
- **Status-Effekte** werden per Stichwort-Erkennung aus dem echten
  Angriffstext abgeleitet (z. B. „poison“, „paralyze“, „flip a coin“ →
  50%-Chance), nicht durch exaktes Parsen jeder individuellen Karten-Regel.
- Pro Pokémon nur eine Attacke pro Zug, ein Energie-Attachment pro Zug, ein
  Retreat pro Zug — wie im echten Spiel.
