import type { AnalyticsStatusResponse } from '@/lib/api'

export interface AnalyticsViewState {
  canQuery: boolean
  showSkeleton: boolean
  showUnavailable: boolean
  isRefreshing: boolean
  isCached: boolean
  isStale: boolean
}

export function deriveAnalyticsViewState(
  status: AnalyticsStatusResponse | undefined,
  statusLoading: boolean,
  statusError: boolean
): AnalyticsViewState {
  // The fallback keeps the client compatible with older backends during a
  // rolling upgrade where snapshotState is not present yet.
  const hasSnapshot = status?.snapshotState
    ? status.snapshotState !== 'none'
    : Boolean(status?.hasData) ||
      status?.status === 'ready' ||
      Boolean(status?.lastScanCompletedAt)
  const unavailable =
    !hasSnapshot &&
    (statusError ||
      status?.status === 'error' ||
      status?.status === 'unavailable')

  return {
    canQuery: hasSnapshot,
    showSkeleton:
      statusLoading ||
      (!hasSnapshot &&
        !statusError &&
        status?.status !== 'error' &&
        status?.status !== 'unavailable'),
    showUnavailable: unavailable,
    isRefreshing: status?.status === 'scanning' && hasSnapshot,
    isCached: status?.snapshotState === 'cached',
    isStale: status?.snapshotState === 'stale',
  }
}
