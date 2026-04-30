import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

const isProduction = process.env.NODE_ENV === 'production';

export type WsEventType =
  | 'costs:updated'
  | 'session:new'
  | 'alert:new'
  | 'device:changed'
  | 'desktop:close-requested';

export interface WsEvent {
  type: WsEventType;
  data?: unknown;
  timestamp: string;
}

let wss: WebSocketServer | null = null;

function sanitizeError(err: Error): string {
  if (isProduction) {
    return 'Unknown WebSocket error';
  }
  return err.message;
}

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('error', (err) => {
      if (!isProduction) {
        console.error('WebSocket client error:', sanitizeError(err));
      }
    });

    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
  });

  console.log('WebSocket server initialized at /ws');
  return wss;
}

export function broadcast(event: WsEvent): void {
  if (!wss) return;

  const message = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function broadcastCostsUpdated(): void {
  const timestamp = new Date().toISOString();
  const message = JSON.stringify({ type: 'costs:updated', timestamp });
  broadcastRaw(message);
}

export function broadcastNewSession(sessionId: string): void {
  const timestamp = new Date().toISOString();
  const message = JSON.stringify({ type: 'session:new', data: { sessionId }, timestamp });
  broadcastRaw(message);
}

export function broadcastNewAlert(alertId: number, severity: string): void {
  const timestamp = new Date().toISOString();
  const message = JSON.stringify({ type: 'alert:new', data: { alertId, severity }, timestamp });
  broadcastRaw(message);
}

export function broadcastDeviceChanged(deviceId: string): void {
  const timestamp = new Date().toISOString();
  const message = JSON.stringify({ type: 'device:changed', data: { deviceId }, timestamp });
  broadcastRaw(message);
}

export function broadcastDesktopCloseRequested(): void {
  const timestamp = new Date().toISOString();
  const message = JSON.stringify({ type: 'desktop:close-requested', timestamp });
  broadcastRaw(message);
}

function broadcastRaw(message: string): void {
  if (!wss) return;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function closeWebSocket(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
}
