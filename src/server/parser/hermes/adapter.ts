import path from 'path'
import Database from 'better-sqlite3'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import type { SessionData, ParsedRequest } from '../../analytics/domain.js'
import { parseWslUncPath } from '../../lib/wsl-openclaw.js'
import { getModelPricing } from '../../services/pricing-service.js'
import { calculateCost, identifyProvider } from '../costs.js'
import type {
  AnalyticsDataSourceAdapter,
  DataSourceScanResult,
  DataSourceValidation,
} from '../data-source-adapter.js'

type SqlRow = Record<string, unknown>

export interface HermesTotals {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  apiCalls: number
  cost: number
}

export class HermesDataValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly solution: string,
    readonly dataPath?: string
  ) {
    super(message)
    this.name = 'HermesDataValidationError'
  }
}

function finiteNonNegative(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function epochToIso(value: unknown, fallback?: string): string {
  const number = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(number)) {
    const milliseconds = number < 1_000_000_000_000 ? number * 1000 : number
    const date = new Date(milliseconds)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return fallback ?? new Date(0).toISOString()
}

function tableExists(database: Database.Database, tableName: string): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
      )
      .get(tableName)
  )
}

function tableColumns(
  database: Database.Database,
  tableName: string
): Set<string> {
  return new Set(
    (
      database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
        name?: unknown
      }>
    )
      .map((column) => column.name)
      .filter((name): name is string => typeof name === 'string')
  )
}

function columnExpression(
  columns: Set<string>,
  column: string,
  fallback = 'NULL'
): string {
  return columns.has(column) ? column : fallback
}

function sessionSelect(columns: Set<string>): string[] {
  return [
    'id',
    `${columnExpression(columns, 'source', "'unknown'")} AS source`,
    `${columnExpression(columns, 'model', "'unknown'")} AS model`,
    'started_at',
    `${columnExpression(columns, 'ended_at')} AS ended_at`,
    `${columnExpression(columns, 'last_activity_at')} AS last_activity_at`,
    `${columnExpression(columns, 'cwd')} AS cwd`,
    `${columnExpression(columns, 'input_tokens', '0')} AS input_tokens`,
    `${columnExpression(columns, 'output_tokens', '0')} AS output_tokens`,
    `${columnExpression(columns, 'cache_read_tokens', '0')} AS cache_read_tokens`,
    `${columnExpression(columns, 'cache_write_tokens', '0')} AS cache_write_tokens`,
    `${columnExpression(columns, 'reasoning_tokens', '0')} AS reasoning_tokens`,
    `${columnExpression(columns, 'api_call_count', '0')} AS api_call_count`,
  ]
}

function usageSelect(columns: Set<string>): string[] {
  return [
    'session_id',
    'model',
    `${columnExpression(columns, 'task', "''")} AS task`,
    `${columnExpression(columns, 'api_call_count', '0')} AS api_call_count`,
    `${columnExpression(columns, 'input_tokens', '0')} AS input_tokens`,
    `${columnExpression(columns, 'output_tokens', '0')} AS output_tokens`,
    `${columnExpression(columns, 'cache_read_tokens', '0')} AS cache_read_tokens`,
    `${columnExpression(columns, 'cache_write_tokens', '0')} AS cache_write_tokens`,
    `${columnExpression(columns, 'reasoning_tokens', '0')} AS reasoning_tokens`,
    `${columnExpression(columns, 'first_seen')} AS first_seen`,
    `${columnExpression(columns, 'last_seen')} AS last_seen`,
  ]
}

function isUncPathValue(value: string): boolean {
  if (/^(?:\\\\|\/\/)/.test(value)) return true
  // A single-backslash UNC form (for example when JSON/YAML collapses the
  // first separator on reload). Check the Windows drive-root form too so
  // path.resolve() never rewrites a WSL path into a local E:\\wsl.localhost
  // path.
  return /^[a-zA-Z]:[\\/]wsl\.localhost[\\/]/.test(value)
}

export function normalizeHermesRootPath(value: string): string {
  // UNC paths (WSL) must be preserved verbatim; path.resolve() would turn
  // \\wsl.localhost\\... into a nonsense local E:\\wsl.localhost\\... path.
  if (isUncPathValue(value)) {
    return value
  }
  const resolved = path.resolve(value)
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return path.dirname(resolved)
    }
  } catch {
    // Validation below provides the actionable error.
  }
  return resolved
}

export function getHermesDatabasePath(rootPath: string): string {
  const root = normalizeHermesRootPath(rootPath)
  // path.join() collapses the leading double separator of a UNC path and
  // turns \\wsl.localhost\\... into E:\\wsl.localhost\\..., so join manually.
  return root.endsWith('\\') || root.endsWith('/')
    ? `${root}state.db`
    : `${root}${path.sep}state.db`
}

export interface MaterializedHermesDatabase {
  databasePath: string
  cleanup(): void
}

export function materializeHermesDatabase(
  rootPath: string
): MaterializedHermesDatabase {
  const databasePath = getHermesDatabasePath(rootPath)
  if (!fs.existsSync(databasePath)) {
    throw new HermesDataValidationError(
      'Hermes state.db was not found',
      400,
      'Choose the Hermes data directory that contains state.db.',
      normalizeHermesRootPath(rootPath)
    )
  }

  const wslPath =
    process.platform === 'win32' ? parseWslUncPath(databasePath) : null
  if (!wslPath) {
    return { databasePath, cleanup() {} }
  }

  const snapshotRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'clawalytics-hermes-snapshot-')
  )
  const snapshotPath = path.join(snapshotRoot, 'state.db')
  try {
    const driveMatch = snapshotPath.match(/^([A-Za-z]):[\\/](.*)$/)
    if (!driveMatch) {
      throw new Error(`Unable to map temporary path into WSL: ${snapshotPath}`)
    }
    const linuxDestination = `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2].replace(/\\/g, '/')}`
    execFileSync(
      'wsl.exe',
      [
        '-d',
        wslPath.distro,
        'sqlite3',
        wslPath.linuxPath,
        `.backup '${linuxDestination.replaceAll("'", "''")}'`,
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }
    )
    return {
      databasePath: snapshotPath,
      cleanup() {
        fs.rmSync(snapshotRoot, { recursive: true, force: true })
      },
    }
  } catch (error) {
    fs.rmSync(snapshotRoot, { recursive: true, force: true })
    throw new HermesDataValidationError(
      'Unable to create a read-only Hermes snapshot from WSL',
      400,
      error instanceof Error ? error.message : String(error),
      databasePath
    )
  }
}

function openHermesDatabase(rootPath: string): {
  database: Database.Database
  cleanup(): void
} {
  const materialized = materializeHermesDatabase(rootPath)

  try {
    const database = new Database(materialized.databasePath, {
      readonly: true,
      fileMustExist: true,
      timeout: 3000,
    })
    database.pragma('query_only = ON')
    return { database, cleanup: materialized.cleanup }
  } catch (error) {
    materialized.cleanup()
    throw new HermesDataValidationError(
      'Unable to open Hermes state.db in read-only mode',
      400,
      error instanceof Error ? error.message : String(error),
      materialized.databasePath
    )
  }
}

function readSessionRows(database: Database.Database): SqlRow[] {
  const columns = tableColumns(database, 'sessions')
  for (const required of ['id', 'started_at']) {
    if (!columns.has(required)) {
      throw new HermesDataValidationError(
        `Hermes sessions table is missing ${required}`,
        400,
        'Upgrade Hermes or select a compatible Hermes state directory.'
      )
    }
  }

  const selected = sessionSelect(columns)
  return database
    .prepare(`SELECT ${selected.join(', ')} FROM sessions`)
    .all() as SqlRow[]
}

function readUsageRows(database: Database.Database): SqlRow[] {
  if (!tableExists(database, 'session_model_usage')) return []
  const columns = tableColumns(database, 'session_model_usage')
  if (!columns.has('session_id') || !columns.has('model')) return []

  const selected = usageSelect(columns)
  return database
    .prepare(`SELECT ${selected.join(', ')} FROM session_model_usage`)
    .all() as SqlRow[]
}

function runWslJsonQuery(
  distro: string,
  databasePath: string,
  sql: string
): SqlRow[] {
  const output = execFileSync(
    'wsl.exe',
    ['-d', distro, 'sqlite3', '-readonly', '-json', databasePath, sql],
    {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 20 * 1024 * 1024,
    }
  ).trim()
  if (!output) return []
  const parsed = JSON.parse(output) as unknown
  return Array.isArray(parsed)
    ? parsed.filter((row): row is SqlRow =>
        Boolean(row && typeof row === 'object')
      )
    : []
}

function readRowsThroughWsl(rootPath: string): {
  sessionRows: SqlRow[]
  usageRows: SqlRow[]
} | null {
  if (process.platform !== 'win32') return null
  const parsed =
    parseWslUncPath(getHermesDatabasePath(rootPath)) ??
    parseWslUncPath(rootPath)
  if (!parsed) return null

  try {
    const sessionColumns = new Set(
      runWslJsonQuery(
        parsed.distro,
        parsed.linuxPath,
        'PRAGMA table_info(sessions)'
      )
        .map((row) => row.name)
        .filter((name): name is string => typeof name === 'string')
    )
    for (const required of ['id', 'started_at']) {
      if (!sessionColumns.has(required)) {
        throw new Error(`Hermes sessions table is missing ${required}`)
      }
    }
    const sessionRows = runWslJsonQuery(
      parsed.distro,
      parsed.linuxPath,
      `SELECT ${sessionSelect(sessionColumns).join(', ')} FROM sessions`
    )
    const usageColumns = new Set(
      runWslJsonQuery(
        parsed.distro,
        parsed.linuxPath,
        'PRAGMA table_info(session_model_usage)'
      )
        .map((row) => row.name)
        .filter((name): name is string => typeof name === 'string')
    )
    const usageRows =
      usageColumns.has('session_id') && usageColumns.has('model')
        ? runWslJsonQuery(
            parsed.distro,
            parsed.linuxPath,
            `SELECT ${usageSelect(usageColumns).join(', ')} FROM session_model_usage`
          )
        : []
    return { sessionRows, usageRows }
  } catch (error) {
    throw new HermesDataValidationError(
      'Unable to query Hermes state.db through WSL',
      400,
      error instanceof Error ? error.message : String(error),
      getHermesDatabasePath(rootPath)
    )
  }
}

function emptyTotals(): HermesTotals {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    apiCalls: 0,
    cost: 0,
  }
}

function totalsFromRow(row: SqlRow): HermesTotals {
  return {
    input: finiteNonNegative(row.input_tokens),
    output: finiteNonNegative(row.output_tokens),
    cacheRead: finiteNonNegative(row.cache_read_tokens),
    cacheWrite: finiteNonNegative(row.cache_write_tokens),
    reasoning: finiteNonNegative(row.reasoning_tokens),
    apiCalls: finiteNonNegative(row.api_call_count),
    cost: 0,
  }
}

function addTotals(target: HermesTotals, value: HermesTotals): void {
  target.input += value.input
  target.output += value.output
  target.cacheRead += value.cacheRead
  target.cacheWrite += value.cacheWrite
  target.reasoning += value.reasoning
  target.apiCalls += value.apiCalls
  target.cost += value.cost
}

function createHermesRequest(
  row: SqlRow,
  timestamp: string,
  totals: HermesTotals,
  task?: string
): ParsedRequest {
  const model = optionalString(row.model) ?? 'unknown'
  const provider = identifyProvider(model)
  const hasPricing =
    provider !== 'unknown' && Boolean(getModelPricing(provider, model))
  const costResult = calculateCost(
    provider,
    model,
    {
      inputTokens: totals.input,
      outputTokens: totals.output,
      cacheReadTokens: totals.cacheRead,
      cacheCreationTokens: totals.cacheWrite,
    },
    { suppressMissingPricingWarning: !hasPricing }
  )
  totals.cost = hasPricing ? costResult.totalCost : 0

  return {
    timestamp,
    provider,
    model,
    inputTokens: totals.input,
    outputTokens: totals.output,
    cacheCreationTokens: totals.cacheWrite,
    cacheReadTokens: totals.cacheRead,
    reasoningTokens: totals.reasoning,
    apiCallCount: totals.apiCalls,
    cost: totals.cost,
    cacheSavings: hasPricing ? costResult.cacheSavings : 0,
    messageType: task ? `hermes-aggregate:${task}` : 'hermes-aggregate',
    sourceType: 'hermes',
    usageGranularity: 'aggregate',
    costCurrency: 'CNY',
    costStatus: hasPricing ? 'estimated' : 'unknown',
    costSource: hasPricing ? 'clawalytics-pricing' : 'unknown-model',
  }
}

function scanRows(
  sessionRows: SqlRow[],
  usageRows: SqlRow[],
  rootPath: string
): DataSourceScanResult {
  const usageBySession = new Map<string, SqlRow[]>()
  for (const row of usageRows) {
    const sessionId = optionalString(row.session_id)
    if (!sessionId) continue
    const rows = usageBySession.get(sessionId) ?? []
    rows.push(row)
    usageBySession.set(sessionId, rows)
  }

  const sessions = new Map<string, SessionData>()
  const warnings = new Set<string>()
  for (const row of sessionRows) {
    const rawSessionId = optionalString(row.id)
    if (!rawSessionId) continue
    const sessionId = `hermes:${rawSessionId}`
    const startedAt = epochToIso(row.started_at)
    const lastActivity = epochToIso(
      row.last_activity_at ?? row.ended_at,
      startedAt
    )
    const requests: ParsedRequest[] = []
    const attributed = emptyTotals()

    for (const usageRow of usageBySession.get(rawSessionId) ?? []) {
      const totals = totalsFromRow(usageRow)
      const timestamp = epochToIso(usageRow.last_seen, lastActivity)
      const request = createHermesRequest(
        usageRow,
        timestamp,
        totals,
        optionalString(usageRow.task)
      )
      requests.push(request)
      addTotals(attributed, totals)
      if (request.costStatus === 'unknown') warnings.add(request.model)
    }

    const aggregate = totalsFromRow(row)
    const residual: HermesTotals = {
      input: Math.max(0, aggregate.input - attributed.input),
      output: Math.max(0, aggregate.output - attributed.output),
      cacheRead: Math.max(0, aggregate.cacheRead - attributed.cacheRead),
      cacheWrite: Math.max(0, aggregate.cacheWrite - attributed.cacheWrite),
      reasoning: Math.max(0, aggregate.reasoning - attributed.reasoning),
      apiCalls: Math.max(0, aggregate.apiCalls - attributed.apiCalls),
      cost: 0,
    }
    if (
      residual.input ||
      residual.output ||
      residual.cacheRead ||
      residual.cacheWrite ||
      residual.reasoning ||
      residual.apiCalls
    ) {
      const request = createHermesRequest(
        row,
        lastActivity,
        residual,
        'residual'
      )
      requests.push(request)
      if (request.costStatus === 'unknown') warnings.add(request.model)
    }

    const totals = emptyTotals()
    const modelsUsed = new Set<string>()
    let costStatus: 'estimated' | 'unknown' = 'estimated'
    for (const request of requests) {
      addTotals(totals, {
        input: request.inputTokens,
        output: request.outputTokens,
        cacheRead: request.cacheReadTokens,
        cacheWrite: request.cacheCreationTokens,
        reasoning: request.reasoningTokens ?? 0,
        apiCalls: request.apiCallCount ?? 0,
        cost: request.cost,
      })
      modelsUsed.add(request.model)
      if (request.costStatus === 'unknown') costStatus = 'unknown'
    }

    sessions.set(sessionId, {
      id: sessionId,
      rawSessionId,
      sourceType: 'hermes',
      usageGranularity: 'aggregate',
      agentId: 'hermes',
      projectPath:
        optionalString(row.cwd) ??
        parseWslUncPath(rootPath)?.linuxPath ??
        normalizeHermesRootPath(rootPath),
      startedAt,
      lastActivity,
      channel: optionalString(row.source) ?? 'unknown',
      requests,
      totalCost: totals.cost,
      totalInputTokens: totals.input,
      totalOutputTokens: totals.output,
      totalReasoningTokens: totals.reasoning,
      apiCallCount: totals.apiCalls,
      costCurrency: 'CNY',
      costStatus: requests.length > 0 ? costStatus : 'unknown',
      costSource: requests.length > 0 ? 'clawalytics-pricing' : 'no-usage',
      modelsUsed,
      toolCalls: [],
    })
  }

  return {
    sourceType: 'hermes',
    rootPath: normalizeHermesRootPath(rootPath),
    sessionCount: sessions.size,
    usageRecordCount: usageRows.length,
    warnings: [...warnings]
      .sort()
      .map(
        (model) => `No Clawalytics pricing found for Hermes model ${model}.`
      ),
    sessions,
  }
}

function scanLocalDatabase(
  database: Database.Database,
  rootPath: string
): DataSourceScanResult {
  if (!tableExists(database, 'sessions')) {
    throw new HermesDataValidationError(
      'Hermes state.db has no sessions table',
      400,
      'Choose a current Hermes state.db file.'
    )
  }
  return scanRows(readSessionRows(database), readUsageRows(database), rootPath)
}

function scanHermesSource(rootPath: string): DataSourceScanResult {
  const wslRows = readRowsThroughWsl(rootPath)
  if (wslRows) {
    return scanRows(wslRows.sessionRows, wslRows.usageRows, rootPath)
  }
  const opened = openHermesDatabase(rootPath)
  const { database } = opened
  try {
    return database.transaction(() => scanLocalDatabase(database, rootPath))()
  } finally {
    database.close()
    opened.cleanup()
  }
}

export class HermesDataSourceAdapter implements AnalyticsDataSourceAdapter {
  readonly sourceType = 'hermes' as const
  readonly rootPath: string

  constructor(rootPath: string) {
    this.rootPath = normalizeHermesRootPath(rootPath)
  }

  validate(): DataSourceValidation {
    const result = scanHermesSource(this.rootPath)
    return {
      sourceType: result.sourceType,
      rootPath: result.rootPath,
      sessionCount: result.sessionCount,
      usageRecordCount: result.usageRecordCount,
      warnings: result.warnings,
    }
  }

  scan(): DataSourceScanResult {
    return scanHermesSource(this.rootPath)
  }

  getWatchPaths(): string[] {
    const databasePath = getHermesDatabasePath(this.rootPath)
    return [databasePath, `${databasePath}-wal`]
  }
}

export function validateHermesDataSource(
  rootPath: string
): DataSourceValidation {
  return new HermesDataSourceAdapter(rootPath).validate()
}
