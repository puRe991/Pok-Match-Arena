// Generic parser that turns real Pokemon TCG card text into a small set of
// executable effect primitives. Card text that doesn't match a known pattern
// simply parses to an empty effect list — the card is still playable and
// still resolves its cost/damage/weakness (for attacks), it just has no
// secondary effect (for Trainer cards such text is filtered out entirely,
// see isRecognizedTrainerText below).

export type EffectSpec =
  | { kind: 'coinFlipDamageBonus'; amount: number }
  | { kind: 'noDamageOnTails' }
  | { kind: 'selfDamage'; amount: number }
  | { kind: 'inflictStatus'; status: 'asleep' | 'paralyzed' | 'confused'; coinflip: boolean }
  | { kind: 'poison' }
  | { kind: 'burn' }
  | { kind: 'heal'; amount: number }
  | { kind: 'drawCards'; amount: number }
  | { kind: 'discardOwnEnergy'; amount: number | 'all' }
  | { kind: 'switchSelfActive' }
  | { kind: 'searchDeckForEnergy'; amount: number }
  | { kind: 'handRefresh'; shuffleBack: boolean; amount: number }

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
}

function toNumber(raw: string): number {
  const digits = raw.match(/\d+/)
  if (digits) return parseInt(digits[0], 10)
  return NUMBER_WORDS[raw.toLowerCase()] ?? 1
}

export function parseAttackEffects(text: string | undefined): EffectSpec[] {
  if (!text) return []
  const t = text.trim()
  const effects: EffectSpec[] = []

  if (/flip a coin\.?\s*if tails,?\s*this attack does nothing/i.test(t)) {
    effects.push({ kind: 'noDamageOnTails' })
  }

  const coinBonus = t.match(/flip a coin\.?\s*if heads,?[^.]*does (\d+) more damage/i)
  if (coinBonus) {
    effects.push({ kind: 'coinFlipDamageBonus', amount: parseInt(coinBonus[1], 10) })
  }

  const selfDamage = t.match(/does (\d+) damage to (?:itself|1 of your own)/i)
  if (selfDamage) {
    effects.push({ kind: 'selfDamage', amount: parseInt(selfDamage[1], 10) })
  }

  const statusMatch = t.match(
    /(?:defending pok[eé]mon|opponent'?s active pok[eé]mon) is now (asleep|paralyzed|confused)/i,
  )
  if (statusMatch) {
    const coinflip = /flip a coin\.?\s*if heads/i.test(t)
    effects.push({
      kind: 'inflictStatus',
      status: statusMatch[1].toLowerCase() as 'asleep' | 'paralyzed' | 'confused',
      coinflip,
    })
  }

  if (/is now poisoned/i.test(t)) effects.push({ kind: 'poison' })
  if (/is now burned/i.test(t)) effects.push({ kind: 'burn' })

  const heal = t.match(/heal (\d+) damage from this pok[eé]mon/i)
  if (heal) effects.push({ kind: 'heal', amount: parseInt(heal[1], 10) })

  const draw = t.match(/draw (a|an|\d+|one|two|three|four|five) cards?/i)
  if (draw) effects.push({ kind: 'drawCards', amount: toNumber(draw[1]) })

  const discard = t.match(
    /discard (all|an?|\d+|one|two|three) energy cards? (?:attached to this pok[eé]mon|from this pok[eé]mon)/i,
  )
  if (discard) {
    const amount = discard[1].toLowerCase() === 'all' ? 'all' : toNumber(discard[1])
    effects.push({ kind: 'discardOwnEnergy', amount })
  }

  return effects
}

export function parseTrainerEffects(text: string | undefined): EffectSpec[] {
  if (!text) return []
  const t = text.trim()
  const effects: EffectSpec[] = []

  const heal = t.match(/heal (\d+) damage from 1 of your pok[eé]mon/i)
  if (heal) effects.push({ kind: 'heal', amount: parseInt(heal[1], 10) })

  if (/switch your active pok[eé]mon with 1 of your benched pok[eé]mon/i.test(t)) {
    effects.push({ kind: 'switchSelfActive' })
  }

  const handRefresh = t.match(
    /(discard your hand|shuffle your hand into your deck)[^.]*draw (\d+) cards?/i,
  )
  if (handRefresh) {
    effects.push({
      kind: 'handRefresh',
      shuffleBack: /shuffle/i.test(handRefresh[1]),
      amount: parseInt(handRefresh[2], 10),
    })
  } else {
    const draw = t.match(/draw (\d+) cards?/i)
    if (draw) effects.push({ kind: 'drawCards', amount: parseInt(draw[1], 10) })
  }

  if (/search your deck for (?:a|an|up to \d+) (?:basic )?energy cards?/i.test(t)) {
    effects.push({ kind: 'searchDeckForEnergy', amount: 1 })
  }

  return effects
}

export function isRecognizedTrainerText(text: string | undefined): boolean {
  return parseTrainerEffects(text).length > 0
}
