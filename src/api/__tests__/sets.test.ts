import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshSets() {
  vi.resetModules()
  return import('../sets')
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('loadPackSets', () => {
  it('maps a successful API response into TcgSet objects', async () => {
    const { loadPackSets } = await freshSets()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'base1',
            name: 'Base Set',
            series: 'Base',
            total: 102,
            releaseDate: '1999/01/09',
            images: { logo: 'logo.png', symbol: 'symbol.png' },
          },
        ],
      }),
    } as Response)

    const sets = await loadPackSets()
    expect(sets).toEqual([
      {
        id: 'base1',
        name: 'Base Set',
        series: 'Base',
        total: 102,
        releaseDate: '1999/01/09',
        logo: 'logo.png',
        symbol: 'symbol.png',
      },
    ])
  })

  it('falls back to the built-in set list when the response is not ok', async () => {
    const { loadPackSets } = await freshSets()
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ data: [] }) } as Response)

    const sets = await loadPackSets()
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.some((s) => s.id === 'base1')).toBe(true)
  })

  it('falls back to the built-in set list when fetch throws (offline)', async () => {
    const { loadPackSets } = await freshSets()
    vi.mocked(fetch).mockRejectedValue(new Error('network unreachable'))

    const sets = await loadPackSets()
    expect(sets.some((s) => s.id === 'base1')).toBe(true)
  })

  it('caches the result and only calls fetch once across repeated calls', async () => {
    const { loadPackSets } = await freshSets()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    await loadPackSets()
    await loadPackSets()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('loadSetCards', () => {
  it('returns the raw card list from a successful response', async () => {
    const { loadSetCards } = await freshSets()
    const data = [{ id: 'base1-1', name: 'Bulbasaur', supertype: 'Pokémon', number: '1', images: { small: 's', large: 'l' } }]
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data }) } as Response)

    const cards = await loadSetCards('base1')
    expect(cards).toEqual(data)
  })

  it('returns an empty array when the request fails', async () => {
    const { loadSetCards } = await freshSets()
    vi.mocked(fetch).mockRejectedValue(new Error('boom'))

    const cards = await loadSetCards('base1')
    expect(cards).toEqual([])
  })

  it('returns an empty array on a non-ok HTTP response', async () => {
    const { loadSetCards } = await freshSets()
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ data: [] }) } as Response)

    const cards = await loadSetCards('base1')
    expect(cards).toEqual([])
  })

  it('caches per set id and only fetches once for repeated calls to the same set', async () => {
    const { loadSetCards } = await freshSets()
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response)

    await loadSetCards('base1')
    await loadSetCards('base1')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
