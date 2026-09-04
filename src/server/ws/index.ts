import type { Server } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import {
  isTrustedRequest,
  type RequestTrustConfig,
} from '../security/request-trust.js'

const isProduction = process.env.NODE_ENV === 'production'

const WS_HEARTBEAT_INTERVAL_MS = 30000
// Clients only ever send handshake/control frames here; keep the payload cap
// small so a rogue client cannot pressure the main process with huge frames.
const WS_MAX_PAYLOAD_BYTES = 64 * 1024
const WS_MAX_CONNECTIONS = 32

export type WsEventType =
  | 'costs:updated'
  | 'analytics:status'
  | 'session:new'
  | 'alert:new'
  | 'device:changed'
  | 'desktop:close-requested'

export interface WsEvent {
  type: WsEventType
  data?: unknown
  timestamp: string
}

let wss: WebSocketServer | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
// Track liveness per connected client for the ping/pong heartbeat.
const aliveClients = new WeakSet<WebSocket>()

function sanitizeError(err: Error): string {
  if (isProduction) {
    return 'Unknown WebSocket error'
  }
  return err.message
}

function startHeartbeat(): void {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (!wss) return
    for (const client of wss.clients) {
      if (!aliveClients.has(client)) {
        // No pong since the last ping - the connection is dead.
        client.terminate()
        continue
      }
      aliveClients.delete(client)
      client.ping()
    }
  }, WS_HEARTBEAT_INTERVAL_MS)
  heartbeatTimer.unref?.()
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export function initWebSocket(
  server: Server,
  trustConfig: RequestTrustConfig
): WebSocketServer {
  wss = new WebSocketServer({
    noServer: true,
    maxPayload: WS_MAX_PAYLOAD_BYTES,
  })

  server.on('upgrade', (request, socket, head) => {
    let pathname = ''
    try {
      pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    } catch {
      socket.destroy()
      return
    }
    if (pathname !== '/ws') {
      return
    }

    const requestConfig = {
      ...trustConfig,
      port: request.socket.localPort ?? trustConfig.port,
    }
    if (!isTrustedRequest(request, requestConfig)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    if (wss && wss.clients.size >= WS_MAX_CONNECTIONS) {
      socket.write(
        'HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'
      )
      socket.destroy()
      return
    }

    wss?.handleUpgrade(request, socket, head, (client) => {
      wss?.emit('connection', client, request)
    })
  })

  wss.on('connection', (ws) => {
    aliveClients.add(ws)

    ws.on('pong', () => {
      aliveClients.add(ws)
    })

    ws.on('close', () => {
      aliveClients.delete(ws)
    })

    ws.on('error', (err) => {
      if (!isProduction) {
        console.error('WebSocket client error:', sanitizeError(err))
      }
    })

    ws.send(
      JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })
    )
  })

  startHeartbeat()

  console.log('WebSocket server initialized at /ws')
  return wss
}

export function broadcast(event: WsEvent): void {
  if (!wss) return

  const message = JSON.stringify(event)
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
}

export function broadcastCostsUpdated(): void {
  const timestamp = new Date().toISOString()
  const message = JSON.stringify({ type: 'costs:updated', timestamp })
  broadcastRaw(message)
}

export function broadcastAnalyticsStatus(): void {
  const timestamp = new Date().toISOString()
  broadcastRaw(JSON.stringify({ type: 'analytics:status', timestamp }))
}

export function broadcastNewSession(sessionId: string): void {
  const timestamp = new Date().toISOString()
  const message = JSON.stringify({
    type: 'session:new',
    data: { sessionId },
    timestamp,
  })
  broadcastRaw(message)
}

export function broadcastNewAlert(alertId: number, severity: string): void {
  const timestamp = new Date().toISOString()
  const message = JSON.stringify({
    type: 'alert:new',
    data: { alertId, severity },
    timestamp,
  })
  broadcastRaw(message)
}

export function broadcastDeviceChanged(deviceId: string): void {
  const timestamp = new Date().toISOString()
  const message = JSON.stringify({
    type: 'device:changed',
    data: { deviceId },
    timestamp,
  })
  broadcastRaw(message)
}

export function broadcastDesktopCloseRequested(): void {
  const timestamp = new Date().toISOString()
  const message = JSON.stringify({ type: 'desktop:close-requested', timestamp })
  broadcastRaw(message)
}

function broadcastRaw(message: string): void {
  if (!wss) return
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
}

export function closeWebSocket(): void {
  stopHeartbeat()
  if (wss) {
    for (const client of wss.clients) {
      client.terminate()
    }
    wss.close()
    wss = null
  }
}
