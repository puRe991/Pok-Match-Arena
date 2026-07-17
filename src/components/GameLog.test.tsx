import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameLog } from './GameLog'
import type { LogEntry } from '../game/types'

describe('GameLog', () => {
  it('renders each entry with its turn number and text', () => {
    const entries: LogEntry[] = [
      { id: '1', turn: 1, side: 'system', text: 'Spiel gestartet.' },
      { id: '2', turn: 2, side: 'p1', text: 'Du ziehst eine Karte.' },
    ]
    render(<GameLog entries={entries} />)
    expect(screen.getByText('Spiel gestartet.')).toBeInTheDocument()
    expect(screen.getByText('Du ziehst eine Karte.')).toBeInTheDocument()
    expect(screen.getByText('[1]')).toBeInTheDocument()
    expect(screen.getByText('[2]')).toBeInTheDocument()
  })

  it('renders no entry rows when there are no entries', () => {
    const { container } = render(<GameLog entries={[]} />)
    expect(container.firstElementChild?.children).toHaveLength(0)
  })
})
