# Esports-Ranglisten & Orden-System — Konzept

> Ausarbeitung der Idee: **Alle Pokémon-Orden können erspielt werden.**
> Alle Arenen (Gyms) aller Pokémon-Regionen bilden eine große Rangliste von
> „Staffel 1" bis zur letzten Region. Wer in einer Arena unter die **Top 3**
> kommt, erhält den **Orden** und **steigt in die nächste Liga (Arena)** auf.

Dieses Dokument beschreibt das Spiel-Design, die Datenmodelle und einen
Umsetzungsplan, wie das bestehende **Pokémon Duell-Arena** TCG-Spiel um einen
kompetitiven Esports-Modus erweitert wird. Es ist bewusst so geschrieben, dass
es an die vorhandene Architektur (React 19 + Zustand + `localStorage`,
serverloses PeerJS-Multiplayer, reine TS-Regel-Engine) andockt.

---

## 1. Vision in einem Satz

> Der Spieler durchläuft als aufstrebender Trainer alle Arenen der
> Pokémon-Welt — Region für Region, Staffel für Staffel — sammelt dabei jeden
> einzelnen Orden, klettert über Ranglisten nach oben und wird am Ende
> **Champion der Champions**.

Die App bekommt damit ein **Langzeit-Ziel** (Meta-Progression) über die
einzelnen Duelle hinaus. Statt nur „ein Match gegen die CPU" gibt es eine
Karriere mit Auf- und Abstieg, Saisons und einer Trophäen-Wand voller Orden.

---

## 2. Kernmechanik: Die Arena-Pyramide

Alle Arenen werden zu einem **Ligensystem** (wie im Fußball oder in klassischen
Esports-Ranglisten) gestapelt:

```
        ┌─────────────────────────┐
        │   CHAMPION-LIGA (Top)   │   ← Elite Four + Champs aller Regionen
        └─────────────────────────┘
                    ▲ Aufstieg (Top 3)
        ┌─────────────────────────┐
        │   Arena 8  (z. B. Erdorden) │
        └─────────────────────────┘
                    ▲
                   ...
                    ▲
        ┌─────────────────────────┐
        │   Arena 1  (z. B. Felsorden) │   ← Einstieg für neue Trainer
        └─────────────────────────┘
```

- Jede **Arena = eine Liga-Stufe (Tier)**.
- Innerhalb einer Arena spielen mehrere Trainer in einer **Rangliste**
  gegeneinander (Punkte / ELO, siehe §6).
- Am Ende einer **Staffel** (Season, §5) werden die **Top 3** jeder Arena
  belohnt: Sie erhalten den **Orden dieser Arena** und **steigen eine Liga
  auf**. Die untersten Ränge **steigen ab** (§7).
- Reihenfolge der Arenen orientiert sich am kanonischen Schwierigkeitsgrad der
  jeweiligen Region (Arena 1 = leichtester Gym-Leiter, Arena 8 = stärkster),
  danach folgt die Champion-Liga der Region und schließlich der Übergang zur
  nächsten Region.

### Warum „Staffel 1 bis zur letzten"?

Die Regionen der Hauptspiele werden als **Staffeln** interpretiert. So entsteht
eine durchgehende Aufstiegs-Kampagne über alle „Pokémon-Teile":

| Staffel | Region  | Herkunft (Spiele)              | Arenen |
|--------:|---------|--------------------------------|:------:|
| 1       | Kanto   | Rot/Blau/Gelb                  | 8      |
| 2       | Johto   | Gold/Silber/Kristall           | 8      |
| 3       | Hoenn   | Rubin/Saphir/Smaragd           | 8      |
| 4       | Sinnoh  | Diamant/Perl/Platin            | 8      |
| 5       | Einall  | Schwarz/Weiß (+ 2)             | 8      |
| 6       | Kalos   | X/Y                            | 8      |
| 7       | Alola   | Sonne/Mond — Inselprüfungen*   | 7*     |
| 8       | Galar   | Schwert/Schild                 | 8      |
| 9       | Paldea  | Karmesin/Purpur                | 8      |

\* Alola hat statt Arenen die **Inselprüfungen / Z-Kristalle** — im System als
eigener „Arena"-Typ modelliert (Belohnung = Z-Kristall statt Orden), damit die
Region trotzdem vollständig abgebildet ist.

---

## 3. Das Orden-Katalog (alle Orden erspielbar)

Ziel der Idee: **Jeder Orden aus jeder Region ist einsammelbar.** Die App führt
eine **Orden-Vitrine** („Badge Case"), die den kompletten Fortschritt zeigt.
Jeder Orden ist ein Datensatz mit Region, Gym-Leiter, Typ-Thema, Farbe/Icon und
Freischalt-Status.

Vollständiger Katalog (Hauptreihe):

### Staffel 1 — Kanto
| # | Orden | Arena-Leiter | Typ-Thema |
|---|-------|--------------|-----------|
| 1 | Felsorden | Rocko | Gestein |
| 2 | Wasserorden | Misty | Wasser |
| 3 | Donnerorden | Major Bob | Elektro |
| 4 | Farborden | Erika | Pflanze |
| 5 | Seelenorden | Koga | Gift |
| 6 | Sumpforden | Sabrina | Psycho |
| 7 | Vulkanorden | Pyro | Feuer |
| 8 | Erdorden | Giovanni | Boden |

### Staffel 2 — Johto
Zephyrorden, Käferorden, Faustorden, Nebelorden, Sturmorden, Mineralorden,
Gletscherorden, Risingorden (Aufsteiger-Orden).

### Staffel 3 — Hoenn
Steinorden, Faustorden, Dynamoorden, Hitzeorden, Balanceorden, Federorden,
Wissenorden, Regenorden.

### Staffel 4 — Sinnoh
Kohleorden, Waldorden, Redlichkeitsorden, Moororden, Reliktorden, Bergorden,
Eiszapfenorden, Leuchtorden.

### Staffel 5 — Einall
Trio-Orden, Basisorden, Käferorden, Voltorden, Bebenorden, Jetorden,
Legendenorden, Toxikorden (+ Freeze-Orden in der Fortsetzung).

### Staffel 6 — Kalos
Käferorden, Steilorden, Rumpelorden, Pflanzenorden, Spannungsorden, Feenorden,
Psychoorden, Eisbergorden.

### Staffel 7 — Alola (Inselprüfungen)
Z-Kristalle statt Orden: Elektrium Z, Feurium Z, Aquium Z, Steinium Z, u. a.
— plus die **Große Prüfung** je Insel als „Arena-Boss".

### Staffel 8 — Galar
Grasorden, Wasserorden, Feuerorden, Kampforden, Geisterorden, Feenorden,
Gesteinsorden, Drachen-/Finsterorden (Verzweigung Schwert/Schild).

### Staffel 9 — Paldea
Käferorden, Grasorden, Elektroorden, Wasserorden, Normalorden, Geisterorden,
Psychoorden, Eisorden (Arenen frei anwählbar — im System als offene Gruppe
modellierbar, siehe §5 „Offene vs. lineare Staffeln").

> **Sammel-Metrik:** „X von Y Orden" pro Staffel und ein Gesamtzähler. Ein
> vollständig gefüllter Staffel-Satz schaltet die **Champion-Liga** der Staffel
> frei. Alle Champion-Ligen zusammen ergeben die **Meister-Liga** (Endgame).

---

## 4. Der Spielerpfad (Karriere-Modus)

1. **Einstieg:** Neuer Trainer startet in **Staffel 1 / Arena 1** mit dem
   bestehenden Starter-Deck.
2. **Ranglisten-Duelle:** Innerhalb der Arena bestreitet er Matches (gegen CPU
   mit einem **typ-thematischen Deck** des Gym-Leiters, oder gegen andere
   Spieler via PeerJS) und sammelt Ranglistenpunkte.
3. **Saison-Ende / Aufstiegs-Duell:** Erreicht er die Top 3, gibt es ein
   **Orden-Match** gegen den Gym-Leiter (Boss-Fight). Sieg = **Orden** +
   **Aufstieg** in Arena 2.
4. **Region abschließen:** Alle 8 Orden einer Region → **Champion-Liga** (Top 4
   + Champion als aufeinanderfolgende Boss-Duelle).
5. **Nächste Staffel:** Champion besiegt → Wechsel in die nächste Region
   (Staffel 2), Rangliste dort startet frisch, Orden bleiben in der Vitrine.
6. **Endgame:** Alle Staffeln durch → **Meister-Liga** mit ewiger Rangliste,
   Seasons-Resets und Prestige (§8).

### Gym-Leiter als thematische Gegner (bindet die Regel-Engine ein)

Jede Arena bekommt ein **typ-fokussiertes CPU-Deck** (z. B. Rocko = Gestein/
Boden). Das nutzt die vorhandene `ai.ts` + `deckBuilder.ts`: statt eines
zufälligen legalen Decks wird ein **nach Typ gefiltertes** Deck generiert und
die KI-Schwierigkeit skaliert mit der Arena-Nummer (mehr Vorausschau /
aggressiveres Anhängen von Energie in höheren Ligen).

---

## 5. Staffeln (Seasons) — zwei Bedeutungen sauber getrennt

Der Begriff „Staffel" wird im Konzept auf **zwei Ebenen** benutzt — beide
gewollt:

- **Story-Staffel = Region** (Kanto … Paldea). Statisch, definiert den Inhalt.
- **Ladder-Season = Zeitfenster** (z. B. 14 oder 28 Tage). Nach Ablauf werden
  Ranglisten gewertet (Top 3 → Aufstieg), Belohnungen verteilt und die Punkte
  zurückgesetzt (Soft-Reset, §7). Das erzeugt den „immer-wieder-reinschauen"-
  Loop, den die täglichen Gratis-Packs schon andeuten.

**Offene vs. lineare Staffeln:** Frühe Regionen sind linear (Arena 1→8). Für
Paldea (im Original frei anwählbar) kann eine Staffel als **offene Gruppe**
konfiguriert werden: alle 8 Arenen gleichzeitig verfügbar, Aufstieg = alle 8
Orden gesammelt. Das Datenmodell (§9) unterstützt beides über ein Feld
`unlockMode: 'linear' | 'open'`.

---

## 6. Ranglisten-Wertung (Punkte / ELO)

- Jeder Spieler hat pro Arena einen **Rangwert** (RP). Sieg = +RP, Niederlage =
  −RP, skaliert nach Gegnerstärke (ELO-artig, K-Faktor pro Liga).
- Die **Arena-Rangliste** sortiert alle Teilnehmer (Spieler + „Ghost"-CPU-
  Trainer mit Namen/Elo, damit die Liste auch offline gefüllt ist).
- **Top 3 = Aufstiegsplätze** (grün), Mittelfeld = Halten, unterste Ränge =
  Abstiegsplätze (rot) — wie eine Bundesliga-Tabelle.
- Zusätzlich eine **globale Rangliste** über alle Ligen (Prestige-Elo), damit
  auch Endgame-Spieler eine Bestenliste haben.

**Offline-First:** Da es kein Backend gibt, werden Ranglisten lokal simuliert:
CPU-„Ghost"-Trainer bekommen jede Season plausible Ergebnisse (basierend auf
einer Ziel-Elo), sodass die Tabelle lebendig wirkt. Optional später ein leicht-
gewichtiges Leaderboard-Backend, wenn gewünscht (§10, Phase 4).

---

## 7. Auf- und Abstieg (das Herz der Idee)

Am **Ende jeder Ladder-Season**:

| Platzierung in der Arena | Ergebnis |
|--------------------------|----------|
| **Platz 1–3**            | **Orden** verliehen + **Aufstieg** in die nächsthöhere Arena |
| Mittelfeld               | Verbleib in der Arena, RP-Soft-Reset |
| Unterste ~20 %           | **Abstieg** in die tiefere Arena (in Arena 1: kein Abstieg) |

Regeln:
- **Orden-Absicherung:** Einmal errungene Orden bleiben **dauerhaft** in der
  Vitrine, auch bei späterem Abstieg. Aufstieg ist an den Orden gekoppelt, der
  Orden selbst ist nicht mehr verlierbar — Sammel-Fortschritt fühlt sich fair
  an.
- **Aufstiegs-Duell (optional):** Statt reiner Tabellen-Platzierung kann der
  Aufstieg an ein **Boss-Match gegen den Gym-Leiter** gekoppelt werden (mehr
  „Pokémon-Feeling"). Empfehlung: Top 3 qualifizieren sich, das Orden-Match
  entscheidet endgültig.
- **Promotion-Serie:** Wer 3 Seasons in Folge Aufstiegsplatz hält, aber das
  Boss-Match verliert, bekommt einen garantierten Aufstieg (Anti-Frust).

---

## 8. Belohnungen & Prestige

Aufstieg und Orden sollen sich lohnen und in die bestehende Sammel-Ökonomie
greifen:

- **Orden** → schaltet ein exklusives **Arena-Booster-Pack** frei (thematische
  Karten des Gym-Typs) — nutzt das vorhandene Pack-Opening.
- **Aufstieg** → **Gratis-Pack-Bonus** oder ein garantiertes Rare/Holo.
- **Staffel komplett (8 Orden)** → **Champion-Sleeve/Skin** fürs Spielbrett +
  Titel („Kanto-Champion").
- **Meister-Liga (Endgame)** → **Prestige-Sterne**: Season-Reset auf Wunsch,
  behält Orden, startet Ladder neu für Rang-Kosmetik (Rahmen, Avatare).
- **Orden-Vitrine** als eigener Screen: 9 Regionen-Regale, jeder Orden mit
  Datum, Gegner und finaler Platzierung — die „Trophäen-Wand" der Karriere.

---

## 9. Datenmodell (dockt an `src/game/types.ts` an)

Vorschlag für neue Typen in einem Modul `src/game/ranked/` (rein, testbar,
`localStorage`-persistiert wie `collectionStore`):

```ts
// Statische Definition (Content, ausgeliefert)
interface Region {          // = Staffel / Story-Season
  id: string                // 'kanto'
  season: number            // 1
  name: string              // 'Kanto'
  unlockMode: 'linear' | 'open'
  arenas: ArenaDef[]        // Länge i. d. R. 8
  championLeague: ChampionDef
}

interface ArenaDef {
  id: string                // 'kanto-pewter'
  tier: number              // 1..8 (Position in der Pyramide)
  leader: string            // 'Rocko'
  badge: Badge              // Belohnung
  typeTheme: PokemonType[]  // ['fighting','rock'] → CPU-Deck & Pack-Thema
  aiLevel: number           // skaliert mit tier
}

interface Badge {
  id: string                // 'boulder'
  name: string              // 'Felsorden'
  region: string
  icon: string              // Emoji/SVG-Key
  color: string             // Tailwind-Klasse
}

// Dynamischer Fortschritt (pro Spieler, persistiert)
interface RankedProfile {
  currentRegion: string
  currentArenaId: string
  earnedBadges: EarnedBadge[]        // dauerhaft
  ladder: Record<string, ArenaStanding> // arenaId -> Rangstand
  prestige: number
  globalElo: number
}

interface ArenaStanding {
  rp: number                // Ranglistenpunkte / Elo
  rank: number              // aktueller Tabellenplatz
  seasonId: string
}

interface EarnedBadge {
  badgeId: string
  earnedAt: number          // Zeitstempel
  finalRank: number
}
```

**Wiederverwendung:**
- CPU-Deck je Arena → `deckBuilder.ts` um einen Typ-Filter erweitern.
- Match-Ergebnis → bestehende Sieg/Niederlage-Erkennung aus `engine.ts`, danach
  RP-Update über eine reine Funktion `applyMatchResult(profile, arenaId, won)`.
- Season-Ende → reine Funktion `resolveSeason(profile, standings)` → gibt
  Aufsteiger/Absteiger + verliehene Orden zurück (voll unit-testbar, wie
  `dailyPacks.ts`).

---

## 10. Umsetzungs-Roadmap (inkrementell)

**Phase 1 — Content & Vitrine (kein Gameplay-Risiko)**
- Statischen Regionen/Orden-Katalog als Daten anlegen (`ranked/regions.ts`).
- **Orden-Vitrine**-Screen (read-only), erreichbar über das Hauptmenü-Grid
  neben „Packs" und „Deck-Builder".
- `RankedProfile` im Store + `localStorage`-Persist.

**Phase 2 — Arena-Duelle & Aufstieg (Single-Player)**
- Arena-Auswahl-Screen (Pyramide/Ladder-Ansicht).
- Typ-thematische Gym-Leiter-Decks + skalierte KI.
- RP-System + „Orden-Match" → Orden verleihen + Aufstieg. Reine Funktionen mit
  Vitest-Tests (`resolveSeason`, `applyMatchResult`).

**Phase 3 — Season-Loop & Ranglisten-UI**
- Ghost-Trainer für gefüllte Arena-Tabellen (offline).
- Ladder-Season-Timer (analog zum Gratis-Pack-Midnight-Reset), Auf-/Abstiegs-
  Wertung, Belohnungs-Pop-ups.
- Belohnungs-Kopplung an Pack-Opening (Arena-Packs).

**Phase 4 — Kompetitiv/Multiplayer (optional)**
- Gewertete PeerJS-Duelle mit Elo-Austausch.
- Optionales Leaderboard-Backend, falls echte globale Ranglisten gewünscht.

**Phase 5 — Endgame & Prestige**
- Meister-Liga, Prestige-Sterne, Kosmetik, „Champion-der-Champions"-Titel.

---

## 11. Offene Design-Entscheidungen (für Rückfragen)

1. **Aufstieg per Tabelle oder per Boss-Match?** Empfehlung: Top 3 qualifizieren
   sich, ein Orden-Match entscheidet (mehr Pokémon-Gefühl).
2. **Season-Länge** der Ladder (14 vs. 28 Tage) — hängt an gewünschter
   Spielfrequenz.
3. **Multiplayer-Wertung** jetzt oder erst nach dem Single-Player-Kern.
4. **Alola-Sonderfall** (Z-Kristalle) als voller Orden-Ersatz oder als
   optionales Bonus-Kapitel.
5. **Abstieg an/aus** — manche Spieler mögen keinen Verlust; alternativ nur
   „Aufstieg ODER Halten" ohne echten Abstieg.

---

*Dieses Dokument ist die Ideen-Ausarbeitung. Es enthält noch keinen
Feature-Code — die konkrete Implementierung folgt den Phasen aus §10, sobald die
offenen Entscheidungen aus §11 geklärt sind.*
