import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AnalyticsSourceFilter } from '../../shared/analytics-contracts'

const STORAGE_KEY = 'clawalytics-analytics-source'
let currentSource: AnalyticsSourceFilter = 'all'

function readStoredSource(): AnalyticsSourceFilter {
  if (typeof window === 'undefined') return 'all'
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'openclaw' || value === 'hermes' ? value : 'all'
  } catch {
    return 'all'
  }
}

export function getGlobalAnalyticsSource(): AnalyticsSourceFilter {
  return currentSource
}

type AnalyticsSourceContextValue = {
  source: AnalyticsSourceFilter
  setSource: (source: AnalyticsSourceFilter) => void
}

const AnalyticsSourceContext =
  createContext<AnalyticsSourceContextValue | null>(null)

export function AnalyticsSourceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const [source, setSourceState] = useState<AnalyticsSourceFilter>(() => {
    const initial = readStoredSource()
    currentSource = initial
    return initial
  })

  const setSource = useCallback(
    (next: AnalyticsSourceFilter) => {
      if (next === source) return
      currentSource = next
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Locked-down webviews may deny storage; session state still works.
      }
      queryClient.removeQueries()
      setSourceState(next)
    },
    [queryClient, source]
  )

  const value = useMemo(() => ({ source, setSource }), [source, setSource])

  return (
    <AnalyticsSourceContext.Provider value={value}>
      <div key={source} className='contents'>
        {children}
      </div>
    </AnalyticsSourceContext.Provider>
  )
}

export function useAnalyticsSource() {
  const context = useContext(AnalyticsSourceContext)
  if (!context) {
    throw new Error('useAnalyticsSource must be used within its provider')
  }
  return context
}
