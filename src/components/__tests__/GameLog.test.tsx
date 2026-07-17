import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameLog } from '../GameLog'
import type { LogEntry } from '../../game/types'

describe('GameLog', () => {
  it('renders each log entry with its turn number', () => {
    const entries: LogEntry[] = [
      { id: 'l1', turn: 1, side: 'system', text: 'Spiel gestartet.' },
      { id: 'l2', turn: 2, side: 'p1', text: 'Du ziehst eine Karte.' },
    ]
    render(<GameLog entries={entries} />)
    expect(screen.getByText('Spiel gestartet.')).toBeInTheDocument()
    expect(screen.getByText('Du ziehst eine Karte.')).toBeInTheDocument()
    expect(screen.getByText('[1]')).toBeInTheDocument()
    expect(screen.getByText('[2]')).toBeInTheDocument()
  })

  it('renders an empty log without crashing', () => {
    const { container } = render(<GameLog entries={[]} />)
    expect(container.querySelector('div')).toBeInTheDocument()
  })
})
