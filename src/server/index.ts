import path from 'path'
import express, { type Express } from 'express'
import { realpathSync } from 'fs'
import type { Server } from 'http'
import { fileURLToPath } from 'url'
import { ensureConfigDir, loadConfig } from './config/loader.js'
import { closeDatabase, getDatabase } from './db/schema.js'
import {
  QueryParameterError,
  validateBoundedQuery,
} from './lib/query-params.js'
import {
  startSecurityWatcher,
  stopSecurityWatcher,
} from './parser/security-watcher.js'
import agentsRoutes from './routes/agents.js'
import auditRoutes from './routes/audit.js'
import channelsRoutes from './routes/channels.js'
import configRoutes from './routes/config.js'
import costsRoutes from './routes/costs.js'
import desktopRoutes from './routes/desktop.js'
import devicesRoutes from './routes/devices.js'
import exportRoutes from './routes/export.js'
import modelsRoutes from './routes/models.js'
import securityRoutes from './routes/security.js'
import sessionsRoutes from './routes/sessions.js'
import statsRoutes from './routes/stats.js'
import tokensRoutes from './routes/tokens.js'
import toolsRoutes from './routes/tools.js'
import trendsRoutes from './routes/trends.js'
import {
  isTrustedRequest,
  shouldSetCorsOrigin,
  type RuntimeMode,
  type RequestTrustConfig,
} from './security/request-trust.js'
import {
  getAnalyticsService,
  initializeAnalyticsService,
  shutdownAnalyticsService,
} from './services/analytics-service.js'
import {
  clearDesktopBridge,
  setDesktopBridge,
} from './services/desktop-service.js'
import { initPricingService } from './services/pricing-service.js'
import {
  broadcastDesktopCloseRequested,
  closeWebSocket,
  initWebSocket,
} from './ws/index.js'

const isProduction = process.env.NODE_ENV === 'production'
const isElectron = process.env.ELECTRON === 'true'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_PORT = 9174
const MAX_PORT = 65535

const app: Express = express()
const clientPath = path.join(__dirname, '../client')

let httpServer: Server | null = null
let activePort: number | null = null
let signalHandlersRegistered = false
let requestTrustConfig: RequestTrustConfig = {
  mode: isElectron ? 'electron' : isProduction ? 'production' : 'development',
  port: DEFAULT_PORT,
  desktopToken: null,
}

// API trust boundary must run before JSON parsing and route execution. In
// Electron mode this is a mandatory origin + per-process token check.
app.use('/api', (req, res, next) => {
  if (
    !isTrustedRequest(req, {
      ...requestTrustConfig,
      port: req.socket.localPort ?? requestTrustConfig.port,
    })
  ) {
    res.status(403).json({ error: 'Untrusted local request origin' })
    return
  }

  const origin = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin
  if (shouldSetCorsOrigin(origin, requestTrustConfig)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Clawalytics-Desktop-Token'
    )
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    )
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})
app.use(express.json())

app.use('/api', (req, res, next) => {
  try {
    validateBoundedQuery(req, 'days', 1, 3650)
    validateBoundedQuery(req, 'limit', 1, 1000)
    validateBoundedQuery(req, 'offset', 0, 1_000_000)
    validateBoundedQuery(req, 'hours', 1, 8760)
    next()
  } catch (error) {
    if (error instanceof QueryParameterError) {
      res.status(400).json({ error: error.message })
      return
    }
    next(error)
  }
})

app.use('/api', (req, res, next) => {
  const raw = Array.isArray(req.query.sourceType)
    ? req.query.sourceType[0]
    : req.query.sourceType
  const sourceType = typeof raw === 'string' ? raw : 'all'
  if (!['all', 'openclaw', 'hermes'].includes(sourceType)) {
    res.status(400).json({
      error: 'sourceType must be all, openclaw, or hermes',
    })
    return
  }
  getAnalyticsService().runWithSourceFilter(
    sourceType as 'all' | 'openclaw' | 'hermes',
    () => next()
  )
})

// Serve static files in production (before API routes)
if (process.env.NODE_ENV === 'production') {
  // Hashed asset filenames under /assets/* never change content, so cache
  // them aggressively. The SPA index.html, /images/*, and /fonts/* stay
  // short-lived (default) so app updates roll out without manual clearing.
  app.use(
    express.static(clientPath, {
      index: 'index.html',
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
        }
      },
    })
  )
}

// API routes
app.use('/api/stats', statsRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/costs', costsRoutes)
app.use('/api/config', configRoutes)
app.use('/api/desktop', desktopRoutes)
app.use('/api/tokens', tokensRoutes)
app.use('/api/trends', trendsRoutes)
app.use('/api/agents', agentsRoutes)
app.use('/api/channels', channelsRoutes)
app.use('/api/devices', devicesRoutes)
app.use('/api/security', securityRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/tools', toolsRoutes)
app.use('/api/models', modelsRoutes)
app.use('/api/export', exportRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// SPA fallback - serve index.html for non-API routes (must be after API routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }

  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(clientPath, 'index.html'))
    return
  }

  next()
})

export interface StartServerOptions {
  port?: number
  runtimeMode?: RuntimeMode
  desktopToken?: string | null
}

export interface StartedServer {
  port: number
  server: Server
}

function resolvePort(port?: number): number {
  if (
    typeof port === 'number' &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= MAX_PORT
  ) {
    return port
  }

  const envPort = Number.parseInt(process.env.PORT || '', 10)
  return Number.isInteger(envPort) && envPort >= 1 && envPort <= MAX_PORT
    ? envPort
    : DEFAULT_PORT
}

function listen(port: number): Promise<Server> {
  // Pin to the IPv4 loopback interface so the unauthenticated API never
  // escapes the local machine. The CLI/docs keep using the friendly
  // `localhost` URL — only the bind target is restricted here.
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server))
    server.once('error', reject)
  })
}

async function cleanupServerState(): Promise<void> {
  const server = httpServer

  httpServer = null
  activePort = null

  await shutdownAnalyticsService()
  stopSecurityWatcher()
  closeWebSocket()
  clearDesktopBridge()
  closeDatabase()

  if (!server) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

export async function stop(
  options: { exitProcess?: boolean } = {}
): Promise<void> {
  if (!httpServer) {
    if (options.exitProcess) {
      process.exit(0)
    }
    return
  }

  console.log('\nShutting down...')

  try {
    await cleanupServerState()
    console.log('Server stopped')

    if (options.exitProcess) {
      process.exit(0)
    }
  } catch (error) {
    console.error('Failed to stop server cleanly:', error)
    if (options.exitProcess) {
      process.exit(1)
    }
    throw error
  }
}

function registerSignalHandlers(): void {
  if (signalHandlersRegistered) {
    return
  }

  const handleSignal = () => {
    void stop({ exitProcess: true })
  }

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
  signalHandlersRegistered = true
}

const isMainModule = (() => {
  if (!process.argv[1]) return false

  try {
    const scriptPath = realpathSync(process.argv[1])
    const modulePath = realpathSync(fileURLToPath(import.meta.url))
    return scriptPath === modulePath
  } catch {
    return false
  }
})()

export async function start(
  options: StartServerOptions = {}
): Promise<StartedServer> {
  const port = resolvePort(options.port)

  if (httpServer) {
    return {
      port: activePort ?? port,
      server: httpServer,
    }
  }

  requestTrustConfig = {
    mode:
      options.runtimeMode ??
      (isElectron ? 'electron' : isProduction ? 'production' : 'development'),
    port,
    desktopToken: options.desktopToken ?? null,
  }

  try {
    ensureConfigDir()

    getDatabase()
    console.log('Database initialized')

    const config = loadConfig()

    initPricingService(config.rates)

    initializeAnalyticsService(config)

    if (config.securityAlertsEnabled) {
      startSecurityWatcher({
        openClawPath: config.openClawPath,
        gatewayLogsPath: config.gatewayLogsPath,
        enabled: config.securityAlertsEnabled,
      })
      console.log('Security watcher started')
    }

    const server = await listen(port)
    httpServer = server
    activePort = port

    initWebSocket(server, requestTrustConfig)
    registerSignalHandlers()

    console.log(`\nClawalytics server running at http://localhost:${port}`)
    console.log(`Dashboard: http://localhost:${port}`)
    console.log(`API: http://localhost:${port}/api`)
    console.log('\nPress Ctrl+C to stop\n')

    return { port, server }
  } catch (error) {
    try {
      await cleanupServerState()
    } catch (cleanupError) {
      console.error('Failed to clean up after startup error:', cleanupError)
    }

    console.error('Failed to start server:', error)

    if (isMainModule) {
      process.exit(1)
    }

    throw error
  }
}

if (isMainModule) {
  void start()
}

export { app }
export { setDesktopBridge }
export { broadcastDesktopCloseRequested as requestDesktopCloseChoice }
