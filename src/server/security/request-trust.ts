import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'

export type RuntimeMode = 'electron' | 'development' | 'production'

export interface RequestTrustConfig {
  mode: RuntimeMode
  port: number
  desktopToken?: string | null
  devOrigins?: readonly string[]
}

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
] as const

function readSingleHeader(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function readDesktopToken(
  headers: IncomingHttpHeaders
): string | undefined {
  const cookie = readSingleHeader(headers.cookie)
  const match = cookie?.match(/(?:^|;\s*)clawalytics_desktop_token=([^;]*)/)
  return readSingleHeader(headers['x-clawalytics-desktop-token']) ?? match?.[1]
}

export function isTrustedOrigin(
  origin: string | undefined,
  config: Pick<RequestTrustConfig, 'mode' | 'port' | 'devOrigins'>
): boolean {
  if (!origin) {
    return true
  }

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  if (
    parsed.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(parsed.hostname)
  ) {
    return false
  }

  const localOrigin = `http://${parsed.hostname}:${config.port}`
  if (origin === localOrigin) {
    return true
  }

  return (
    config.mode === 'development' &&
    (config.devOrigins ?? DEFAULT_DEV_ORIGINS).includes(origin)
  )
}

export function isTrustedRequest(
  request: Pick<IncomingMessage, 'headers'>,
  config: RequestTrustConfig
): boolean {
  const origin = readSingleHeader(request.headers.origin)
  if (!isTrustedOrigin(origin, config)) {
    return false
  }

  if (config.mode !== 'electron') {
    return true
  }

  const expected = config.desktopToken
  const actual = readDesktopToken(request.headers)
  return Boolean(expected && actual && actual === expected)
}

export function shouldSetCorsOrigin(
  origin: string | undefined,
  config: Pick<RequestTrustConfig, 'mode' | 'port' | 'devOrigins'>
): boolean {
  return Boolean(origin && isTrustedOrigin(origin, config))
}
