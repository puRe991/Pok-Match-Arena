import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (...args: unknown[]) => void

class FakeConn {
  handlers: Record<string, Handler[]> = {}
  open = true
  sent: unknown[] = []
  on(event: string, cb: Handler) {
    ;(this.handlers[event] ??= []).push(cb)
  }
  emit(event: string, ...args: unknown[]) {
    for (const cb of this.handlers[event] ?? []) cb(...args)
  }
  send(data: unknown) {
    this.sent.push(data)
  }
  close() {}
}

class FakePeer {
  static instances: FakePeer[] = []
  handlers: Record<string, Handler[]> = {}
  id: string
  constructor(id?: string) {
    this.id = id ?? 'generated-id'
    FakePeer.instances.push(this)
  }
  on(event: string, cb: Handler) {
    ;(this.handlers[event] ??= []).push(cb)
  }
  emit(event: string, ...args: unknown[]) {
    for (const cb of this.handlers[event] ?? []) cb(...args)
  }
  connect() {
    return new FakeConn()
  }
  destroy() {}
}

vi.mock('peerjs', () => ({ default: FakePeer }))

describe('MultiplayerLink', () => {
  beforeEach(() => {
    FakePeer.instances = []
  })

  it('hostSession resolves with a 5-character room code once the peer opens', async () => {
    const { MultiplayerLink } = await import('./peer')
    const link = new MultiplayerLink()
    const promise = link.hostSession()
    const peer = FakePeer.instances[0]
    expect(peer.id).toMatch(/^pma-duel-[A-Z0-9]{5}$/)
    peer.emit('open', peer.id)
    const code = await promise
    expect(code).toHaveLength(5)
    expect(peer.id).toBe(`pma-duel-${code}`)
  })

  it('hostSession rejects when the peer errors', async () => {
    const { MultiplayerLink } = await import('./peer')
    const link = new MultiplayerLink()
    const promise = link.hostSession()
    const peer = FakePeer.instances[0]
    peer.emit('error', new Error('boom'))
    await expect(promise).rejects.toThrow('boom')
  })

  it('invokes onData with parsed messages received on the connection', async () => {
    const { MultiplayerLink } = await import('./peer')
    const link = new MultiplayerLink()
    const promise = link.hostSession()
    const peer = FakePeer.instances[0]
    peer.emit('open', peer.id)
    await promise

    const conn = new FakeConn()
    const received: unknown[] = []
    link.onData = (msg) => received.push(msg)
    peer.emit('connection', conn)
    conn.emit('data', { type: 'hello', name: 'Gast', deckCards: [] })
    expect(received).toEqual([{ type: 'hello', name: 'Gast', deckCards: [] }])
  })

  it('send only writes to the connection when it is open', async () => {
    const { MultiplayerLink } = await import('./peer')
    const link = new MultiplayerLink()
    const promise = link.hostSession()
    const peer = FakePeer.instances[0]
    peer.emit('open', peer.id)
    await promise
    const conn = new FakeConn()
    peer.emit('connection', conn)

    conn.open = false
    link.send({ type: 'action', action: { type: 'END_TURN', side: 'p1' } })
    expect(conn.sent).toHaveLength(0)

    conn.open = true
    link.send({ type: 'action', action: { type: 'END_TURN', side: 'p1' } })
    expect(conn.sent).toHaveLength(1)
  })

  it('joinSession uppercases and trims the room code before connecting', async () => {
    const { MultiplayerLink } = await import('./peer')
    const link = new MultiplayerLink()
    const promise = link.joinSession('  ab12c  ')
    const peer = FakePeer.instances[0]
    const connectSpy = vi.spyOn(peer, 'connect')
    peer.emit('open')
    const conn = connectSpy.mock.results[0].value as FakeConn
    conn.emit('open')
    await promise
    expect(connectSpy).toHaveBeenCalledWith('pma-duel-AB12C', { reliable: true })
  })
})
