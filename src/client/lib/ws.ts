import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

type WsEventType =
  | 'costs:updated'
  | 'analytics:status'
  | 'session:new'
  | 'alert:new'
  | 'device:changed'
  | 'desktop:close-requested'

interface WsMessage {
  type: WsEventType | 'connected'
  data?: unknown
  timestamp: string
}

const RECONNECT_DELAY = 3000
const MAX_RECONNECT_DELAY = 30000
const INVALIDATE_DEBOUNCE_MS = 2000
export const DESKTOP_CLOSE_REQUESTED_EVENT =
  'clawalytics:desktop-close-requested'

export function useWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelayRef = useRef(RECONNECT_DELAY)

  useEffect(() => {
    let mounted = true
    let reconnectTimeout: ReturnType<typeof setTimeout>

    function connect() {
      if (!mounted) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectDelayRef.current = RECONNECT_DELAY
      }

      ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data)
          handleMessage(message, queryClient)
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (mounted) {
          reconnectTimeout = setTimeout(() => {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 1.5,
              MAX_RECONNECT_DELAY
            )
            connect()
          }, reconnectDelayRef.current)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      mounted = false
      clearTimeout(reconnectTimeout)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [queryClient])
}

// 模块级防抖定时器：同类型事件在 2s 窗口内合并为一次 invalidate，
// 窗口期内后续事件直接丢弃；定时器触发后自清理，无需在组件卸载时统一清理。
const pendingInvalidations = new Map<
  WsEventType,
  ReturnType<typeof setTimeout>
>()

function debounceInvalidate(type: WsEventType, invalidate: () => void) {
  if (pendingInvalidations.has(type)) return

  pendingInvalidations.set(
    type,
    setTimeout(() => {
      pendingInvalidations.delete(type)
      invalidate()
    }, INVALIDATE_DEBOUNCE_MS)
  )
}

function handleMessage(message: WsMessage, queryClient: QueryClient) {
  switch (message.type) {
    case 'analytics:status':
      debounceInvalidate(message.type, () => {
        queryClient.invalidateQueries({ queryKey: ['analyticsStatus'] })
      })
      break

    case 'costs:updated':
      debounceInvalidate(message.type, () => {
        queryClient.invalidateQueries({ queryKey: ['analyticsStatus'] })
        queryClient.invalidateQueries({ queryKey: ['enhancedStats'] })
        queryClient.invalidateQueries({ queryKey: ['dailyCosts'] })
        queryClient.invalidateQueries({ queryKey: ['modelUsage'] })
        queryClient.invalidateQueries({ queryKey: ['tokenBreakdown'] })
        queryClient.invalidateQueries({ queryKey: ['tokenSummary'] })
        queryClient.invalidateQueries({ queryKey: ['budgetStatus'] })
        queryClient.invalidateQueries({ queryKey: ['sessionStats'] })
        queryClient.invalidateQueries({ queryKey: ['projectBreakdown'] })
      })
      break

    case 'session:new':
      debounceInvalidate(message.type, () => {
        queryClient.invalidateQueries({ queryKey: ['analyticsStatus'] })
        queryClient.invalidateQueries({ queryKey: ['sessions'] })
        queryClient.invalidateQueries({ queryKey: ['enhancedStats'] })
        queryClient.invalidateQueries({ queryKey: ['sessionStats'] })
        queryClient.invalidateQueries({ queryKey: ['projectBreakdown'] })
        queryClient.invalidateQueries({ queryKey: ['sessionFilters'] })
      })
      break

    case 'alert:new':
      debounceInvalidate(message.type, () => {
        queryClient.invalidateQueries({ queryKey: ['securityAlerts'] })
        queryClient.invalidateQueries({ queryKey: ['recentConnections'] })
        queryClient.invalidateQueries({ queryKey: ['securityDashboard'] })
      })
      break

    case 'device:changed':
      debounceInvalidate(message.type, () => {
        queryClient.invalidateQueries({ queryKey: ['devices'] })
        queryClient.invalidateQueries({ queryKey: ['securityDashboard'] })
      })
      break

    case 'desktop:close-requested':
      window.dispatchEvent(new CustomEvent(DESKTOP_CLOSE_REQUESTED_EVENT))
      break
  }
}
