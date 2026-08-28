import path from 'path'
import fs from 'fs'
import { readOpenClawAgentDatabase } from './agent-database.js'
import { loadAgents } from './agent-loader.js'
import { getSessionIdFromFileName, listSessionFiles } from './session-index.js'
import { parseOpenClawLine } from './session-parser.js'

const MAX_SAMPLE_FILES = 10
const MAX_SAMPLE_LINES_PER_FILE = 200

export type OpenClawFormatStatus =
  | 'parsed'
  | 'no-session-files'
  | 'no-usage-records'

export interface OpenClawDataValidation {
  rootPath: string
  hasOpenClawConfig: boolean
  hasAgentsDirectory: boolean
  agentsFound: number
  sessionFilesFound: number
  databaseSessionsFound: number
  sampledLines: number
  parsedUsageEntries: number
  formatStatus: OpenClawFormatStatus
  warnings: string[]
}

export class OpenClawDataValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly solution: string,
    readonly path?: string
  ) {
    super(message)
    this.name = 'OpenClawDataValidationError'
  }
}

function isDirectory(directoryPath: string): boolean {
  try {
    return fs.statSync(directoryPath).isDirectory()
  } catch {
    return false
  }
}

function assertReadableDirectory(directoryPath: string): void {
  if (!directoryPath) {
    throw new OpenClawDataValidationError(
      'OpenClaw path is not configured',
      400,
      'Set the OpenClaw .openclaw directory path in settings.'
    )
  }

  if (!fs.existsSync(directoryPath)) {
    throw new OpenClawDataValidationError(
      'OpenClaw directory does not exist',
      400,
      'Check the path, start WSL2 if this is a WSL path, and ensure OpenClaw has written data there.',
      directoryPath
    )
  }

  if (!isDirectory(directoryPath)) {
    throw new OpenClawDataValidationError(
      'OpenClaw path is not a directory',
      400,
      'Point the data source to the .openclaw root directory.',
      directoryPath
    )
  }

  try {
    fs.accessSync(directoryPath, fs.constants.R_OK | fs.constants.X_OK)
  } catch {
    throw new OpenClawDataValidationError(
      'Permission denied for OpenClaw directory',
      403,
      'Grant read and execute permissions for the OpenClaw directory.',
      directoryPath
    )
  }
}

function countParsedUsageEntries(
  files: string[],
  databaseSessionKeys: Set<string>
): {
  sampledLines: number
  parsedUsageEntries: number
} {
  let sampledLines = 0
  let parsedUsageEntries = 0

  for (const filePath of files.slice(0, MAX_SAMPLE_FILES)) {
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const agentId = path.basename(path.dirname(path.dirname(filePath)))
    const sessionId = getSessionIdFromFileName(path.basename(filePath))
    if (databaseSessionKeys.has(`${agentId}:${sessionId}`)) {
      continue
    }

    let sampledLinesInFile = 0
    for (const line of content.split('\n')) {
      if (sampledLinesInFile >= MAX_SAMPLE_LINES_PER_FILE) {
        break
      }
      if (!line.trim()) {
        continue
      }

      sampledLines++
      sampledLinesInFile++
      if (parseOpenClawLine(line, sessionId, agentId)) {
        parsedUsageEntries++
      }
    }
  }

  return { sampledLines, parsedUsageEntries }
}

export function validateOpenClawDataSource(
  rootPath: string
): OpenClawDataValidation {
  assertReadableDirectory(rootPath)

  const configPath = path.join(rootPath, 'openclaw.json')
  const agentsPath = path.join(rootPath, 'agents')
  const hasOpenClawConfig = fs.existsSync(configPath)
  const hasAgentsDirectory = isDirectory(agentsPath)

  if (!hasOpenClawConfig && !hasAgentsDirectory) {
    throw new OpenClawDataValidationError(
      'OpenClaw data structure was not found',
      400,
      'Choose the .openclaw root directory. It should contain openclaw.json or an agents directory.',
      rootPath
    )
  }

  const warnings: string[] = []
  const agents = loadAgents(rootPath)
  const sessionFiles = agents.flatMap((agent) => {
    const agentPath = path.join(rootPath, 'agents', agent.id)
    return listSessionFiles(agentPath)
  })
  const databaseResults = agents.map((agent) => {
    const agentPath = path.join(rootPath, 'agents', agent.id)
    return readOpenClawAgentDatabase(agentPath, agent.id)
  })
  const databaseSessionsFound = databaseResults.reduce(
    (total, result) => total + result.sessions.length,
    0
  )

  if (hasAgentsDirectory && agents.length === 0) {
    warnings.push(
      'No OpenClaw agents were discovered under the agents directory.'
    )
  }

  if (sessionFiles.length === 0 && databaseSessionsFound === 0) {
    warnings.push(
      'No OpenClaw session transcripts were found yet (JSONL or agent SQLite).'
    )
  }

  for (const result of databaseResults) {
    if (result.warning) {
      warnings.push(result.warning)
    }
  }

  const parsedDatabaseUsageEntries = databaseResults.reduce(
    (total, result) =>
      total +
      result.sessions.reduce(
        (count, session) => count + session.requests.length,
        0
      ),
    0
  )
  const databaseSessionKeys = new Set<string>()
  databaseResults.forEach((result, index) => {
    const agent = agents[index]
    if (!agent) return
    for (const session of result.sessions) {
      if (session.requests.length > 0) {
        databaseSessionKeys.add(`${agent.id}:${session.id}`)
      }
    }
  })
  const {
    sampledLines: effectiveSampledLines,
    parsedUsageEntries: parsedJsonlUsageEntries,
  } = countParsedUsageEntries(sessionFiles, databaseSessionKeys)
  const parsedUsageEntries =
    parsedJsonlUsageEntries + parsedDatabaseUsageEntries
  if (
    (sessionFiles.length > 0 || databaseSessionsFound > 0) &&
    parsedUsageEntries === 0
  ) {
    warnings.push(
      'OpenClaw transcripts are readable, but no assistant usage records were parsed.'
    )
  }

  const formatStatus: OpenClawFormatStatus =
    parsedUsageEntries > 0
      ? 'parsed'
      : sessionFiles.length === 0 && databaseSessionsFound === 0
        ? 'no-session-files'
        : 'no-usage-records'

  return {
    rootPath,
    hasOpenClawConfig,
    hasAgentsDirectory,
    agentsFound: agents.length,
    sessionFilesFound: sessionFiles.length,
    databaseSessionsFound,
    sampledLines: effectiveSampledLines,
    parsedUsageEntries,
    formatStatus,
    warnings,
  }
}
