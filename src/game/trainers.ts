import type { CardDef, GameState, InPlayPokemon, Side } from './types'

/**
 * Wo eine Trainer-Karte ihr Ziel wählt:
 * - `none`               – kein Ziel, wirkt sofort
 * - `own-pokemon`        – eines deiner Pokémon (aktiv oder Bank)
 * - `own-bench`          – eines deiner Bank-Pokémon
 * - `opp-pokemon`        – ein Pokémon des Gegners (aktiv oder Bank)
 * - `opp-bench`          – ein Bank-Pokémon des Gegners
 */
export type TrainerTargeting = 'none' | 'own-pokemon' | 'own-bench' | 'opp-pokemon' | 'opp-bench'

export type TrainerEffectId =
  | 'bill'
  | 'oak'
  | 'potion'
  | 'superPotion'
  | 'fullHeal'
  | 'switch'
  | 'pokemonCenter'
  | 'energyRemoval'
  | 'gustOfWind'
  | 'energyRetrieval'
  | 'plusPower'
  | 'energySearch'
  | 'gambler'
  | 'revive'

export interface TrainerEffect {
  id: TrainerEffectId
  /** Kanonischer Anzeigename der Karte. */
  label: string
  /** Kurzbeschreibung des Effekts (Tooltip / Deck-Builder). */
  description: string
  targeting: TrainerTargeting
  /** Text im Zielauswahl-Banner. */
  prompt: string
}

export const TRAINER_EFFECTS: Record<TrainerEffectId, TrainerEffect> = {
  bill: {
    id: 'bill',
    label: 'Bill',
    description: 'Ziehe 2 Karten.',
    targeting: 'none',
    prompt: '',
  },
  oak: {
    id: 'oak',
    label: 'Professor Oak',
    description: 'Wirf deine Hand ab und ziehe 7 Karten.',
    targeting: 'none',
    prompt: '',
  },
  potion: {
    id: 'potion',
    label: 'Trank',
    description: 'Heile 20 Schaden bei einem deiner Pokémon.',
    targeting: 'own-pokemon',
    prompt: 'Wähle ein Pokémon, das geheilt werden soll.',
  },
  superPotion: {
    id: 'superPotion',
    label: 'Supertrank',
    description: 'Wirf 1 Energie ab und heile 40 Schaden bei einem deiner Pokémon.',
    targeting: 'own-pokemon',
    prompt: 'Wähle ein Pokémon mit Energie zum Heilen.',
  },
  fullHeal: {
    id: 'fullHeal',
    label: 'Vollheilung',
    description: 'Entferne alle Spezial-Zustände von einem deiner Pokémon.',
    targeting: 'own-pokemon',
    prompt: 'Wähle ein Pokémon, dessen Zustände geheilt werden.',
  },
  switch: {
    id: 'switch',
    label: 'Wechsel',
    description: 'Tausche dein aktives Pokémon gegen ein Bank-Pokémon (ohne Rückzugskosten).',
    targeting: 'own-bench',
    prompt: 'Wähle ein Bank-Pokémon, das aktiv werden soll.',
  },
  pokemonCenter: {
    id: 'pokemonCenter',
    label: 'Pokémon-Center',
    description: 'Heile all deine Pokémon vollständig, wirf dafür ihre gesamte Energie ab.',
    targeting: 'none',
    prompt: '',
  },
  energyRemoval: {
    id: 'energyRemoval',
    label: 'Energie-Entzug',
    description: 'Wirf 1 Energie von einem Pokémon des Gegners ab.',
    targeting: 'opp-pokemon',
    prompt: 'Wähle ein gegnerisches Pokémon, dem Energie entzogen wird.',
  },
  gustOfWind: {
    id: 'gustOfWind',
    label: 'Windstoß',
    description: 'Ziehe ein Bank-Pokémon des Gegners in die aktive Position.',
    targeting: 'opp-bench',
    prompt: 'Wähle ein gegnerisches Bank-Pokémon, das aktiv werden soll.',
  },
  energyRetrieval: {
    id: 'energyRetrieval',
    label: 'Energie-Rückgewinnung',
    description: 'Nimm bis zu 2 Basis-Energie aus deiner Ablage zurück auf die Hand.',
    targeting: 'none',
    prompt: '',
  },
  plusPower: {
    id: 'plusPower',
    label: 'PlusPower',
    description: 'Deine nächste Attacke in diesem Zug verursacht 10 Schaden mehr.',
    targeting: 'none',
    prompt: '',
  },
  energySearch: {
    id: 'energySearch',
    label: 'Energiesuche',
    description: 'Hole eine Basis-Energie aus deinem Deck auf die Hand und mische das Deck.',
    targeting: 'none',
    prompt: '',
  },
  gambler: {
    id: 'gambler',
    label: 'Zocker',
    description: 'Mische deine Hand ins Deck. Münzwurf: Kopf = 8 Karten, Zahl = 1 Karte ziehen.',
    targeting: 'none',
    prompt: '',
  },
  revive: {
    id: 'revive',
    label: 'Wiederbelebung',
    description: 'Lege ein Basis-Pokémon aus deiner Ablage mit halbem Schaden auf die Bank.',
    targeting: 'none',
    prompt: '',
  },
}

function normalizeName(name: string): string {
  // Diakritika entfernen (z. B. „Pokémon" → „pokemon"), dann alles außer
  // Buchstaben/Ziffern verwerfen.
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Ordnet einem Kartennamen den passenden Trainer-Effekt zu (falls unterstützt). */
const NAME_TO_EFFECT: Record<string, TrainerEffectId> = {
  bill: 'bill',
  professoroak: 'oak',
  potion: 'potion',
  superpotion: 'superPotion',
  fullheal: 'fullHeal',
  switch: 'switch',
  pokemoncenter: 'pokemonCenter',
  energyremoval: 'energyRemoval',
  gustofwind: 'gustOfWind',
  energyretrieval: 'energyRetrieval',
  pluspower: 'plusPower',
  energysearch: 'energySearch',
  energiesuche: 'energySearch',
  gambler: 'gambler',
  zocker: 'gambler',
  revive: 'revive',
  wiederbelebung: 'revive',
}

/**
 * Liefert den spielbaren Effekt einer Trainer-Karte oder `null`, wenn die Karte
 * (noch) keine implementierte Regel hat. Nur unterstützte Trainer sind
 * deck-legal – so bleiben Decks garantiert spielbar.
 */
export function getTrainerEffect(card: CardDef): TrainerEffect | null {
  if (card.kind !== 'trainer') return null
  const id = NAME_TO_EFFECT[normalizeName(card.name)]
  return id ? TRAINER_EFFECTS[id] : null
}

function topStage(mon: InPlayPokemon) {
  return mon.stages[mon.stages.length - 1]
}

function currentHp(mon: InPlayPokemon): number {
  return Math.max(0, topStage(mon).hp - mon.damage)
}

function otherSide(side: Side): Side {
  return side === 'p1' ? 'p2' : 'p1'
}

function inPlay(state: GameState, side: Side): InPlayPokemon[] {
  const p = state.players[side]
  return p.active ? [p.active, ...p.bench] : [...p.bench]
}

export interface TrainerTarget {
  instanceId: string
  side: Side
}

/**
 * Alle Pokémon-Instanzen, auf die eine Trainer-Karte gerade angewendet werden
 * kann. Für zielfreie Trainer (`targeting === 'none'`) ist die Liste leer.
 */
export function trainerValidTargets(state: GameState, side: Side, effect: TrainerEffect): TrainerTarget[] {
  const opp = otherSide(side)
  switch (effect.targeting) {
    case 'none':
      return []
    case 'own-pokemon': {
      const mons =
        effect.id === 'potion'
          ? inPlay(state, side).filter((m) => m.damage > 0)
          : effect.id === 'superPotion'
            ? inPlay(state, side).filter((m) => m.damage > 0 && m.attachedEnergy.length > 0)
            : /* fullHeal */ inPlay(state, side).filter((m) => m.statuses.length > 0)
      return mons.map((m) => ({ instanceId: m.instanceId, side }))
    }
    case 'own-bench':
      return state.players[side].bench.map((m) => ({ instanceId: m.instanceId, side }))
    case 'opp-pokemon':
      return inPlay(state, opp)
        .filter((m) => m.attachedEnergy.length > 0)
        .map((m) => ({ instanceId: m.instanceId, side: opp }))
    case 'opp-bench':
      return state.players[opp].bench.map((m) => ({ instanceId: m.instanceId, side: opp }))
  }
}

/**
 * Ist die Trainer-Karte gerade sinnvoll spielbar? (Für zielbehaftete Karten:
 * gibt es mindestens ein gültiges Ziel; für zielfreie: hat der Effekt eine
 * Wirkung.)
 */
export function trainerIsPlayable(state: GameState, side: Side, card: CardDef): boolean {
  const effect = getTrainerEffect(card)
  if (!effect) return false
  const player = state.players[side]

  switch (effect.id) {
    case 'bill':
    case 'oak':
      return player.deck.length > 0
    case 'pokemonCenter':
      return inPlay(state, side).some((m) => m.damage > 0)
    case 'energyRetrieval':
      return player.discard.some((c) => c.kind === 'energy' && c.isBasicEnergy)
    case 'plusPower':
      return !!player.active
    case 'energySearch':
      return player.deck.some((c) => c.kind === 'energy' && c.isBasicEnergy)
    case 'gambler':
      return player.deck.length + player.hand.length > 0
    case 'revive':
      return (
        player.bench.length < 5 &&
        player.discard.some((c) => c.kind === 'pokemon' && c.stage === 'basic')
      )
    case 'switch':
      return !!player.active && player.bench.length > 0
    default:
      return trainerValidTargets(state, side, effect).length > 0
  }
}

export { currentHp as trainerCurrentHp }
