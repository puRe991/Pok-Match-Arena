import type { ElementType } from '../types'
import type { Badge, Region } from './types'

/**
 * Katalog aller Regionen und Orden. Divisionen = Regionen: Division N ist
 * `REGIONS[N-1]`. Jede Region hat 8 Arenen (Sub-Ränge); Top-3 in einer Arena
 * verleiht deren Orden und lässt in die nächste Arena / Region aufsteigen.
 *
 * Die kanonischen Gym-Typen werden auf die 7 im Spiel verfügbaren
 * `ElementType`s gemappt (siehe `mapGymType`), damit thematische Gegner-Decks
 * und Orden-Farben konsistent sind.
 */

function mapGymType(gymType: string): ElementType {
  const t = gymType.toLowerCase()
  if (['feuer'].includes(t)) return 'Fire'
  if (['wasser', 'eis'].includes(t)) return 'Water'
  if (['elektro'].includes(t)) return 'Lightning'
  if (['pflanze', 'käfer', 'gift'].includes(t)) return 'Grass'
  if (['gestein', 'boden', 'kampf'].includes(t)) return 'Fighting'
  if (['psycho', 'geist', 'fee'].includes(t)) return 'Psychic'
  // Normal, Flug, Drache, Unlicht, Stahl → Colorless
  return 'Colorless'
}

function badge(id: string, name: string, leader: string, gymType: string): Badge {
  return { id, name, leader, gymType, themeType: mapGymType(gymType) }
}

export const REGIONS: Region[] = [
  {
    id: 'kanto',
    index: 0,
    name: 'Kanto',
    games: 'Rot / Blau / Gelb',
    badges: [
      badge('kanto-fels', 'Felsorden', 'Rocko', 'Gestein'),
      badge('kanto-wasser', 'Wasserorden', 'Misty', 'Wasser'),
      badge('kanto-donner', 'Donnerorden', 'Major Bob', 'Elektro'),
      badge('kanto-farb', 'Farborden', 'Erika', 'Pflanze'),
      badge('kanto-seele', 'Seelenorden', 'Koga', 'Gift'),
      badge('kanto-sumpf', 'Sumpforden', 'Sabrina', 'Psycho'),
      badge('kanto-vulkan', 'Vulkanorden', 'Pyro', 'Feuer'),
      badge('kanto-erd', 'Erdorden', 'Giovanni', 'Boden'),
    ],
  },
  {
    id: 'johto',
    index: 1,
    name: 'Johto',
    games: 'Gold / Silber / Kristall',
    badges: [
      badge('johto-zephyr', 'Zephyrorden', 'Falk', 'Flug'),
      badge('johto-kaefer', 'Käferorden', 'Kai', 'Käfer'),
      badge('johto-zopf', 'Zopforden', 'Bianka', 'Normal'),
      badge('johto-nebel', 'Nebelorden', 'Jens', 'Geist'),
      badge('johto-sturm', 'Sturmorden', 'Hartwig', 'Kampf'),
      badge('johto-mineral', 'Mineralorden', 'Jasmin', 'Stahl'),
      badge('johto-gletscher', 'Gletscherorden', 'Petra', 'Eis'),
      badge('johto-rising', 'Risingorden', 'Sandro', 'Drache'),
    ],
  },
  {
    id: 'hoenn',
    index: 2,
    name: 'Hoenn',
    games: 'Rubin / Saphir / Smaragd',
    badges: [
      badge('hoenn-stein', 'Steinorden', 'Rocko jr.', 'Gestein'),
      badge('hoenn-faust', 'Faustorden', 'Kamillo', 'Kampf'),
      badge('hoenn-dynamo', 'Dynamoorden', 'Walter', 'Elektro'),
      badge('hoenn-hitze', 'Hitzeorden', 'Flavia', 'Feuer'),
      badge('hoenn-balance', 'Balanceorden', 'Norman', 'Normal'),
      badge('hoenn-feder', 'Federorden', 'Wibke', 'Flug'),
      badge('hoenn-wissen', 'Wissenorden', 'Ben & Svenja', 'Psycho'),
      badge('hoenn-regen', 'Regenorden', 'Wassili', 'Wasser'),
    ],
  },
  {
    id: 'sinnoh',
    index: 3,
    name: 'Sinnoh',
    games: 'Diamant / Perl / Platin',
    badges: [
      badge('sinnoh-kohle', 'Kohleorden', 'Veit', 'Gestein'),
      badge('sinnoh-wald', 'Waldorden', 'Herbaro', 'Pflanze'),
      badge('sinnoh-redlich', 'Redlichkeitsorden', 'Norbert', 'Kampf'),
      badge('sinnoh-moor', 'Moororden', 'Marlon', 'Wasser'),
      badge('sinnoh-relikt', 'Reliktorden', 'Zyra', 'Geist'),
      badge('sinnoh-berg', 'Bergorden', 'Lucia', 'Stahl'),
      badge('sinnoh-eiszapfen', 'Eiszapfenorden', 'Frida', 'Eis'),
      badge('sinnoh-leucht', 'Leuchtorden', 'Volkner', 'Elektro'),
    ],
  },
  {
    id: 'einall',
    index: 4,
    name: 'Einall',
    games: 'Schwarz / Weiß',
    badges: [
      badge('einall-trio', 'Trio-Orden', 'Cilan', 'Pflanze'),
      badge('einall-basis', 'Basisorden', 'Kilia', 'Normal'),
      badge('einall-kaefer', 'Käferorden', 'Aloe', 'Käfer'),
      badge('einall-volt', 'Voltorden', 'Elesa', 'Elektro'),
      badge('einall-beben', 'Bebenorden', 'Kliff', 'Gestein'),
      badge('einall-jet', 'Jetorden', 'Zink', 'Flug'),
      badge('einall-legende', 'Legendenorden', 'Benga', 'Psycho'),
      badge('einall-toxik', 'Toxikorden', 'Endivia', 'Gift'),
    ],
  },
  {
    id: 'kalos',
    index: 5,
    name: 'Kalos',
    games: 'X / Y',
    badges: [
      badge('kalos-kaefer', 'Käferorden', 'Viola', 'Käfer'),
      badge('kalos-steil', 'Steilorden', 'Connie', 'Kampf'),
      badge('kalos-rumpel', 'Rumpelorden', 'Konstantin', 'Gestein'),
      badge('kalos-pflanze', 'Pflanzenorden', 'Amaro', 'Pflanze'),
      badge('kalos-spannung', 'Spannungsorden', 'Clemont', 'Elektro'),
      badge('kalos-fee', 'Feenorden', 'Valerie', 'Fee'),
      badge('kalos-psycho', 'Psychoorden', 'Astrid', 'Psycho'),
      badge('kalos-eisberg', 'Eisbergorden', 'Galantho', 'Eis'),
    ],
  },
  {
    id: 'alola',
    index: 6,
    name: 'Alola',
    games: 'Sonne / Mond (Inselprüfungen)',
    badges: [
      badge('alola-normalium', 'Normalium Z', 'Ilima', 'Normal'),
      badge('alola-feurium', 'Feurium Z', 'Kiawe', 'Feuer'),
      badge('alola-aquium', 'Aquium Z', 'Lana', 'Wasser'),
      badge('alola-grassium', 'Grassium Z', 'Mallow', 'Pflanze'),
      badge('alola-elektrium', 'Elektrium Z', 'Sophocles', 'Elektro'),
      badge('alola-steinium', 'Steinium Z', 'Mina', 'Fee'),
      badge('alola-geistrium', 'Geistrium Z', 'Akala', 'Geist'),
      badge('alola-kampfium', 'Kampfium Z', 'Hala', 'Kampf'),
    ],
  },
  {
    id: 'galar',
    index: 7,
    name: 'Galar',
    games: 'Schwert / Schild',
    badges: [
      badge('galar-gras', 'Grasorden', 'Yarro', 'Pflanze'),
      badge('galar-wasser', 'Wasserorden', 'Kate', 'Wasser'),
      badge('galar-feuer', 'Feuerorden', 'Kabu', 'Feuer'),
      badge('galar-kampf', 'Kampforden', 'Saida', 'Kampf'),
      badge('galar-geist', 'Geisterorden', 'Nio', 'Geist'),
      badge('galar-fee', 'Feenorden', 'Papella', 'Fee'),
      badge('galar-gestein', 'Gesteinsorden', 'Mac', 'Gestein'),
      badge('galar-drache', 'Drachenorden', 'Roy', 'Drache'),
    ],
  },
  {
    id: 'paldea',
    index: 8,
    name: 'Paldea',
    games: 'Karmesin / Purpur',
    badges: [
      badge('paldea-kaefer', 'Käferorden', 'Katy', 'Käfer'),
      badge('paldea-gras', 'Grasorden', 'Brassius', 'Pflanze'),
      badge('paldea-elektro', 'Elektroorden', 'Iono', 'Elektro'),
      badge('paldea-wasser', 'Wasserorden', 'Kofu', 'Wasser'),
      badge('paldea-normal', 'Normalorden', 'Larry', 'Normal'),
      badge('paldea-geist', 'Geisterorden', 'Rykon', 'Geist'),
      badge('paldea-psycho', 'Psychoorden', 'Kissara', 'Psycho'),
      badge('paldea-eis', 'Eisorden', 'Grusha', 'Eis'),
    ],
  },
]

export const ARENAS_PER_REGION = 8
export const TOTAL_BADGES = REGIONS.reduce((n, r) => n + r.badges.length, 0)

export function regionByIndex(index: number): Region | undefined {
  return REGIONS[index]
}

/** Der Orden der Arena `arenaIndex` in Region `regionIndex`, falls vorhanden. */
export function badgeAt(regionIndex: number, arenaIndex: number): Badge | undefined {
  return REGIONS[regionIndex]?.badges[arenaIndex]
}

export function badgeById(id: string): Badge | undefined {
  for (const region of REGIONS) {
    const b = region.badges.find((x) => x.id === id)
    if (b) return b
  }
  return undefined
}

/** Ist dies die letzte Arena der letzten Region? */
export function isFinalArena(regionIndex: number, arenaIndex: number): boolean {
  return regionIndex >= REGIONS.length - 1 && arenaIndex >= ARENAS_PER_REGION - 1
}
