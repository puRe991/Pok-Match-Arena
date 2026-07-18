import type { GameState, InPlayPokemon, PokemonCardDef, Side } from './types'

/**
 * Unterstützte Poké-Powers/Bodies. Nur Fähigkeiten mit implementierter Regel
 * sind aktivierbar – erkannt am (normalisierten) Fähigkeits- oder Kartennamen.
 */
export type PowerId = 'rainDance'

export interface PowerDef {
  id: PowerId
  label: string
  description: string
  /** Braucht der Effekt die Auswahl eines Ziel-Pokémon auf dem Brett? */
  needsTarget: boolean
  /** Text im Zielauswahl-Banner. */
  prompt: string
}

export const POWER_DEFS: Record<PowerId, PowerDef> = {
  rainDance: {
    id: 'rainDance',
    label: 'Regentanz',
    description: 'Hänge beliebig oft eine Basis-Wasser-Energie aus deiner Hand an ein Wasser-Pokémon an.',
    needsTarget: true,
    prompt: 'Wähle ein Wasser-Pokémon für die zusätzliche Wasser-Energie.',
  },
}

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const POWER_NAME_TO_ID: Record<string, PowerId> = {
  raindance: 'rainDance',
}

// Fallback: Erkennung über den Kartennamen (falls die Fähigkeits-Metadaten
// fehlen, etwa im Offline-Kartensatz).
const CARD_NAME_TO_POWER: Record<string, PowerId> = {
  blastoise: 'rainDance',
}

/** Liefert den spielbaren Power-Effekt einer Pokémon-Karte oder `null`. */
export function getPokemonPower(card: PokemonCardDef): PowerDef | null {
  const byPower = card.power ? POWER_NAME_TO_ID[normalize(card.power.name)] : undefined
  const byName = CARD_NAME_TO_POWER[normalize(card.name)]
  const id = byPower ?? (card.power ? byName : undefined)
  return id ? POWER_DEFS[id] : null
}

function topStage(mon: InPlayPokemon): PokemonCardDef {
  return mon.stages[mon.stages.length - 1]
}

function inPlay(state: GameState, side: Side): InPlayPokemon[] {
  const p = state.players[side]
  return p.active ? [p.active, ...p.bench] : [...p.bench]
}

function hasBasicWaterEnergyInHand(state: GameState, side: Side): boolean {
  return state.players[side].hand.some((c) => c.kind === 'energy' && c.isBasicEnergy && c.energyType === 'Water')
}

/** Die Pokémon, auf die Regentanz Energie legen darf (alle Wasser-Pokémon in Spiel). */
export function rainDanceTargets(state: GameState, side: Side): InPlayPokemon[] {
  return inPlay(state, side).filter((m) => topStage(m).pokemonType === 'Water')
}

/**
 * Kann die Fähigkeit dieser Pokémon-Instanz gerade genutzt werden? (Quelle in
 * Spiel, nicht durch Zustand blockiert, gültige Voraussetzungen für den Effekt.)
 */
export function powerIsUsable(state: GameState, side: Side, sourceInstanceId: string): boolean {
  const source = inPlay(state, side).find((m) => m.instanceId === sourceInstanceId)
  if (!source) return false
  const def = getPokemonPower(topStage(source))
  if (!def) return false
  // Poké-Powers wirken nicht bei Schlaf/Verwirrung/Paralyse des Trägers.
  if (source.statuses.some((s) => s === 'asleep' || s === 'confused' || s === 'paralyzed')) return false

  switch (def.id) {
    case 'rainDance':
      return hasBasicWaterEnergyInHand(state, side) && rainDanceTargets(state, side).length > 0
  }
}

/** Alle Pokémon-Instanzen mit einer aktuell nutzbaren, unterstützten Fähigkeit. */
export function usablePowerSources(state: GameState, side: Side): InPlayPokemon[] {
  return inPlay(state, side).filter(
    (m) => getPokemonPower(topStage(m)) !== null && powerIsUsable(state, side, m.instanceId),
  )
}
