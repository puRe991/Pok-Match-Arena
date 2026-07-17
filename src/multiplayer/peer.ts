import Peer, { type DataConnection } from 'peerjs'
import type { GameAction, GameState } from '../game/types'

export type WireMessage =
  | { type: 'hello'; name: string }
  | { type: 'state'; state: GameState }
  | { type: 'action'; action: GameAction }

const ROOM_PREFIX = 'pma-duel-'

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export class MultiplayerLink {
  peer: Peer | null = null
  conn: DataConnection | null = null
  onData: ((msg: WireMessage) => void) | null = null
  onPeerConnected: (() => void) | null = null
  onPeerDisconnected: (() => void) | null = null
  onErrorMsg: ((msg: string) => void) | null = null

  private bindConn(conn: DataConnection) {
    this.conn = conn
    conn.on('data', (data) => {
      this.onData?.(data as WireMessage)
    })
    conn.on('close', () => {
      this.onPeerDisconnected?.()
    })
    conn.on('error', (err) => {
      this.onErrorMsg?.(String(err))
    })
  }

  hostSession(): Promise<string> {
    return new Promise((resolve, reject) => {
      const code = randomCode()
      const peer = new Peer(`${ROOM_PREFIX}${code}`)
      this.peer = peer
      peer.on('open', (id) => {
        resolve(code)
        void id
      })
      peer.on('connection', (conn) => {
        this.bindConn(conn)
        conn.on('open', () => this.onPeerConnected?.())
      })
      peer.on('error', (err) => {
        this.onErrorMsg?.(String(err))
        reject(err)
      })
    })
  }

  joinSession(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer()
      this.peer = peer
      peer.on('open', () => {
        const conn = peer.connect(`${ROOM_PREFIX}${code.trim().toUpperCase()}`, { reliable: true })
        this.bindConn(conn)
        conn.on('open', () => {
          this.onPeerConnected?.()
          resolve()
        })
        conn.on('error', (err) => {
          this.onErrorMsg?.(String(err))
          reject(err)
        })
      })
      peer.on('error', (err) => {
        this.onErrorMsg?.(String(err))
        reject(err)
      })
    })
  }

  send(msg: WireMessage) {
    if (this.conn?.open) this.conn.send(msg)
  }

  destroy() {
    this.conn?.close()
    this.peer?.destroy()
    this.peer = null
    this.conn = null
  }
}
