import { beforeEach, describe, expect, it, vi } from 'vitest'

const { MockPeer, MockDataConnection } = vi.hoisted(() => {
  // Minimal Node/browser-agnostic event emitter so the hoisted factory
  // doesn't depend on imports (which run after vi.hoisted callbacks).
  class TinyEmitter {
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>()
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set())
      this.listeners.get(event)!.add(cb)
      return this
    }
    emit(event: string, ...args: unknown[]) {
      for (const cb of this.listeners.get(event) ?? []) cb(...args)
      return true
    }
  }

  class MockDataConnection extends TinyEmitter {
    open = true
    send = vi.fn()
    close = vi.fn(function (this: MockDataConnection) {
      this.open = false
      this.emit('close')
    })
  }

  class MockPeer extends TinyEmitter {
    static instances: MockPeer[] = []
    id: string
    destroy = vi.fn()
    connect = vi.fn(() => new MockDataConnection())
    constructor(id?: string) {
      super()
      this.id = id ?? 'generated-id'
      MockPeer.instances.push(this)
    }
  }

  return { MockPeer, MockDataConnection }
})

vi.mock('peerjs', () => ({ default: MockPeer }))

async function freshPeer() {
  vi.resetModules()
  MockPeer.instances = []
  return import('../peer')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MultiplayerLink.hostSession', () => {
  it('resolves with a 5-character room code once the peer opens', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const promise = link.hostSession()
    const peer = MockPeer.instances[0]
    expect(peer.id).toMatch(/^pma-duel-[A-Z0-9]{5}$/)
    peer.emit('open', peer.id)
    const code = await promise
    expect(code).toHaveLength(5)
    expect(peer.id).toBe(`pma-duel-${code}`)
  })

  it('rejects and forwards the error message when the peer errors', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const onErrorMsg = vi.fn()
    link.onErrorMsg = onErrorMsg
    const promise = link.hostSession()
    const peer = MockPeer.instances[0]
    peer.emit('error', new Error('boom'))
    await expect(promise).rejects.toThrow('boom')
    expect(onErrorMsg).toHaveBeenCalledWith(expect.stringContaining('boom'))
  })

  it('wires an incoming connection and notifies onPeerConnected once it opens', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const onPeerConnected = vi.fn()
    link.onPeerConnected = onPeerConnected
    const promise = link.hostSession()
    const peer = MockPeer.instances[0]
    peer.emit('open', peer.id)
    await promise

    const conn = new MockDataConnection()
    peer.emit('connection', conn)
    conn.emit('open')
    expect(onPeerConnected).toHaveBeenCalledTimes(1)

    const onData = vi.fn()
    link.onData = onData
    conn.emit('data', { type: 'action', action: { type: 'END_TURN', side: 'p1' } })
    expect(onData).toHaveBeenCalledWith({ type: 'action', action: { type: 'END_TURN', side: 'p1' } })
  })
})

describe('MultiplayerLink.joinSession', () => {
  it('connects to the host room derived from the code (trimmed/uppercased)', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const promise = link.joinSession('  abcde  ')
    const peer = MockPeer.instances[0]
    peer.emit('open')
    const conn = vi.mocked(peer.connect).mock.results[0]!.value as InstanceType<typeof MockDataConnection>
    conn.emit('open')
    await promise
    expect(peer.connect).toHaveBeenCalledWith('pma-duel-ABCDE', { reliable: true })
  })

  it('rejects when the connection errors before opening', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const promise = link.joinSession('ABCDE')
    const peer = MockPeer.instances[0]
    peer.emit('open')
    const conn = vi.mocked(peer.connect).mock.results[0]!.value as InstanceType<typeof MockDataConnection>
    conn.emit('error', new Error('conn failed'))
    await expect(promise).rejects.toThrow('conn failed')
  })

  it('notifies onPeerDisconnected when the connection closes', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const onPeerDisconnected = vi.fn()
    link.onPeerDisconnected = onPeerDisconnected
    const promise = link.joinSession('ABCDE')
    const peer = MockPeer.instances[0]
    peer.emit('open')
    const conn = vi.mocked(peer.connect).mock.results[0]!.value as InstanceType<typeof MockDataConnection>
    conn.emit('open')
    await promise
    conn.emit('close')
    expect(onPeerDisconnected).toHaveBeenCalledTimes(1)
  })
})

describe('MultiplayerLink.send', () => {
  it('does nothing when there is no open connection', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    expect(() => link.send({ type: 'action', action: { type: 'END_TURN', side: 'p1' } })).not.toThrow()
  })

  it('forwards the message once the connection is open', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const promise = link.joinSession('ABCDE')
    const peer = MockPeer.instances[0]
    peer.emit('open')
    const conn = vi.mocked(peer.connect).mock.results[0]!.value as InstanceType<typeof MockDataConnection>
    conn.emit('open')
    await promise

    const msg = { type: 'action' as const, action: { type: 'END_TURN' as const, side: 'p1' as const } }
    link.send(msg)
    expect(conn.send).toHaveBeenCalledWith(msg)
  })

  it('does not send once the connection has closed', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const promise = link.joinSession('ABCDE')
    const peer = MockPeer.instances[0]
    peer.emit('open')
    const conn = vi.mocked(peer.connect).mock.results[0]!.value as InstanceType<typeof MockDataConnection>
    conn.emit('open')
    await promise
    conn.close()

    link.send({ type: 'action', action: { type: 'END_TURN', side: 'p1' } })
    expect(conn.send).not.toHaveBeenCalled()
  })
})

describe('MultiplayerLink.destroy', () => {
  it('closes the connection and destroys the peer, clearing both references', async () => {
    const { MultiplayerLink } = await freshPeer()
    const link = new MultiplayerLink()
    const promise = link.joinSession('ABCDE')
    const peer = MockPeer.instances[0]
    peer.emit('open')
    const conn = vi.mocked(peer.connect).mock.results[0]!.value as InstanceType<typeof MockDataConnection>
    conn.emit('open')
    await promise

    link.destroy()
    expect(conn.close).toHaveBeenCalledTimes(1)
    expect(peer.destroy).toHaveBeenCalledTimes(1)
    expect(link.peer).toBeNull()
    expect(link.conn).toBeNull()
  })
})
