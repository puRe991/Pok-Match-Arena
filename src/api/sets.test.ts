import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// loadPackSets/loadSetCards cache their promise at module scope, so each test
// that cares about network behavior needs a fresh module instance.
async function freshSetsModule() {
  vi.resetModules()
  return import('./sets')
}

describe('loadPackSets', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps the API response into TcgSet objects', async () => {
    const { loadPackSets } = await freshSetsModule()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { id: 'base1', name: 'Base Set', series: 'Base', total: 102, releaseDate: '1999/01/09', images: { logo: 'logo.png', symbol: 'symbol.png' } },
          ],
        }),
      })),
    )
    const sets = await loadPackSets()
    expect(sets).toEqual([
      { id: 'base1', name: 'Base Set', series: 'Base', total: 102, releaseDate: '1999/01/09', logo: 'logo.png', symbol: 'symbol.png' },
    ])
  })

  it('falls back to the built-in set list when the request fails', async () => {
    const { loadPackSets } = await freshSetsModule()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const sets = await loadPackSets()
    expect(sets.length).toBeGreaterThan(0)
    expect(sets[0].id).toBe('base1')
  })

  it('falls back when the response is not ok', async () => {
    const { loadPackSets } = await freshSetsModule()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    )
    const sets = await loadPackSets()
    expect(sets.length).toBeGreaterThan(0)
  })

  it('caches the result so a second call does not refetch', async () => {
    const { loadPackSets } = await freshSetsModule()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    await loadPackSets()
    await loadPackSets()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('loadSetCards', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the raw card data on success', async () => {
    const { loadSetCards } = await freshSetsModule()
    const rawCard = { id: 'base1-1', name: 'Bulbasaur', supertype: 'Pokémon', number: '1', images: { small: '', large: '' } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [rawCard] }) })),
    )
    const cards = await loadSetCards('base1')
    expect(cards).toEqual([rawCard])
  })

  it('returns an empty array when the request fails', async () => {
    const { loadSetCards } = await freshSetsModule()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom')
      }),
    )
    const cards = await loadSetCards('base1')
    expect(cards).toEqual([])
  })

  it('caches per set id independently', async () => {
    const { loadSetCards } = await freshSetsModule()
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }))
    vi.stubGlobal('fetch', fetchMock)
    await loadSetCards('base1')
    await loadSetCards('base1')
    await loadSetCards('base2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('PACK_SET_IDS', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('is the curated list of classic Base-era sets', async () => {
    const { PACK_SET_IDS } = await import('./sets')
    expect(PACK_SET_IDS).toEqual(['base1', 'base2', 'base3', 'base4', 'base5', 'base6'])
  })
})
