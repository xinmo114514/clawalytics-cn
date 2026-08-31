import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import Database from 'better-sqlite3'
import { HermesDataSourceAdapter } from '../src/server/parser/hermes/adapter.ts'
import { parseWslUncPath } from '../src/server/lib/wsl-openclaw.ts'

const configuredPath = process.argv[2]
if (!configuredPath) {
  throw new Error('Usage: verify-hermes-live.mjs <Hermes directory or state.db>')
}

const databasePath = configuredPath.toLowerCase().endsWith('state.db')
  ? configuredPath
  : path.join(configuredPath, 'state.db')
const wslPath = parseWslUncPath(databasePath)
const totalsSql = `
  WITH usage AS (
    SELECT session_id,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cache_read_tokens) AS cache_read_tokens,
           SUM(cache_write_tokens) AS cache_write_tokens,
           SUM(reasoning_tokens) AS reasoning_tokens,
           SUM(api_call_count) AS api_call_count
    FROM session_model_usage
    GROUP BY session_id
  )
  SELECT
    SUM(COALESCE(usage.input_tokens, 0) + MAX(0, sessions.input_tokens - COALESCE(usage.input_tokens, 0))) AS input,
    SUM(COALESCE(usage.output_tokens, 0) + MAX(0, sessions.output_tokens - COALESCE(usage.output_tokens, 0))) AS output,
    SUM(COALESCE(usage.cache_read_tokens, 0) + MAX(0, sessions.cache_read_tokens - COALESCE(usage.cache_read_tokens, 0))) AS cache_read,
    SUM(COALESCE(usage.cache_write_tokens, 0) + MAX(0, sessions.cache_write_tokens - COALESCE(usage.cache_write_tokens, 0))) AS cache_write,
    SUM(COALESCE(usage.reasoning_tokens, 0) + MAX(0, sessions.reasoning_tokens - COALESCE(usage.reasoning_tokens, 0))) AS reasoning,
    SUM(COALESCE(usage.api_call_count, 0) + MAX(0, sessions.api_call_count - COALESCE(usage.api_call_count, 0))) AS api_calls
  FROM sessions
  LEFT JOIN usage ON usage.session_id = sessions.id
`

function readExpected() {
  if (wslPath) {
    const output = execFileSync(
      'wsl.exe',
      [
        '-d',
        wslPath.distro,
        'sqlite3',
        '-readonly',
        '-json',
        wslPath.linuxPath,
        totalsSql,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 15000 }
    )
    return JSON.parse(output)[0]
  }
  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    return database.prepare(totalsSql).get()
  } finally {
    database.close()
  }
}

function readActual() {
  const result = new HermesDataSourceAdapter(configuredPath).scan()
  const actual = {
    input: 0,
    output: 0,
    cache_read: 0,
    cache_write: 0,
    reasoning: 0,
    api_calls: 0,
  }
  for (const session of result.sessions.values()) {
    for (const request of session.requests) {
      actual.input += request.inputTokens
      actual.output += request.outputTokens
      actual.cache_read += request.cacheReadTokens
      actual.cache_write += request.cacheCreationTokens
      actual.reasoning += request.reasoningTokens ?? 0
      actual.api_calls += request.apiCallCount ?? 0
    }
  }
  return { result, actual }
}

let matched = null
for (let attempt = 0; attempt < 3; attempt++) {
  const expected = readExpected()
  const current = readActual()
  try {
    assert.deepEqual(current.actual, expected)
    matched = current
    break
  } catch {
    // The live DB may advance between the two read-only snapshots; retry.
  }
}

assert.ok(matched, 'Hermes totals changed during all three comparison attempts')
const total =
  matched.actual.input +
  matched.actual.output +
  matched.actual.cache_read +
  matched.actual.cache_write
console.log(
  JSON.stringify(
    {
      sessions: matched.result.sessionCount,
      usageRecords: matched.result.usageRecordCount,
      ...matched.actual,
      total,
    },
    null,
    2
  )
)
