import type { AnalyticsSourceType } from '../../shared/analytics-contracts.js'
import type { SessionData } from '../analytics/domain.js'

export interface DataSourceValidation {
  sourceType: AnalyticsSourceType
  rootPath: string
  sessionCount: number
  usageRecordCount: number
  warnings: string[]
}

export interface DataSourceScanResult extends DataSourceValidation {
  sessions: Map<string, SessionData>
}

export interface AnalyticsDataSourceAdapter {
  readonly sourceType: AnalyticsSourceType
  readonly rootPath: string
  validate(): DataSourceValidation
  scan(): DataSourceScanResult
  getWatchPaths(): string[]
}
