import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'

if (process.platform !== 'win32') {
  console.log('Desktop Electron E2E runs on Windows only; skipping')
  process.exit(0)
}

const unpackedRoot = path.join(process.cwd(), 'release', 'win-unpacked')
const appPath = path.join(unpackedRoot, 'resources', 'app.asar')
const executablePath = process.env.CLAWALYTICS_ELECTRON_PATH
  ?? path.join(unpackedRoot, 'Clawalytics.exe')
if (!fs.existsSync(appPath) || !fs.existsSync(executablePath)) {
  throw new Error(`Electron directory build not found under ${unpackedRoot}`)
}

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'clawalytics-e2e-'))
let child
let browser
try {
  const debugPort = await new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => resolve(port))
    })
  })
  const userDataDir = path.join(tempHome, 'electron-user-data')
  child = spawn(executablePath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--enable-logging=stderr',
  ], {
    env: {
      ...process.env,
      USERPROFILE: tempHome,
      APPDATA: path.join(tempHome, 'AppData', 'Roaming'),
      LOCALAPPDATA: path.join(tempHome, 'AppData', 'Local'),
    },
    windowsHide: true,
  })
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  if (!browser) throw new Error('Electron remote debugging endpoint did not start')
  let page
  for (let attempt = 0; attempt < 60; attempt += 1) {
    page = browser
      .contexts()[0]
      ?.pages()
      .find((candidate) => /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(candidate.url()))
    if (page) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!page) throw new Error('Electron did not create a browser window')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1000)

  const destructive = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim()
  )
  assert.notEqual(destructive, '')

  const appOrigin = new URL(page.url()).origin
  assert.match(appOrigin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/)

  // ============================================
  // Renderer isolation
  // ============================================

  const isolation = await page.evaluate(() => ({
    hasRequire: typeof window.require !== 'undefined',
    hasProcess: typeof process !== 'undefined',
    electronApiKeys: Object.keys(window.electronAPI ?? {}).sort(),
    cookieExposesToken: document.cookie.includes('clawalytics_desktop_token'),
  }))
  assert.equal(isolation.hasRequire, false, 'window.require must be unavailable')
  assert.equal(isolation.hasProcess, false, 'Node process must be unavailable')
  assert.deepEqual(
    isolation.electronApiKeys,
    [
      'getWindowsAccentColor',
      'onWindowsAccentColorChanged',
      'selectFolder',
    ].sort(),
    `electronAPI must only expose the preload whitelist, got: ${isolation.electronApiKeys}`
  )
  assert.equal(
    isolation.cookieExposesToken,
    false,
    'the HttpOnly desktop token must not be readable from the renderer'
  )

  // ============================================
  // In-page authenticated requests
  // ============================================

  const healthStatus = await page.evaluate(
    async () => (await fetch('/api/health')).status
  )
  assert.equal(healthStatus, 200, 'in-page /api/health must authenticate via cookie')

  const externalStatus = await fetch(`${appOrigin}/api/health`)
  assert.equal(externalStatus.status, 403, 'requests without the token must be rejected')

  const wsMessageType = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${location.host}/ws`)
        const timer = setTimeout(() => {
          ws.close()
          reject(new Error('WebSocket connected event timed out'))
        }, 10000)
        ws.onmessage = (event) => {
          clearTimeout(timer)
          resolve(JSON.parse(event.data).type)
          ws.close()
        }
        ws.onerror = () => {
          clearTimeout(timer)
          reject(new Error('WebSocket connection failed'))
        }
      })
  )
  assert.equal(wsMessageType, 'connected')

  // ============================================
  // Theme switching must actually update the root node
  // ============================================

  const isDarkTheme = () =>
    page.evaluate(() => document.documentElement.classList.contains('dark'))
  const initialDark = await isDarkTheme()
  const themeTrigger = page.getByRole('button', {
    name: /Toggle theme|切换主题/,
  })
  await themeTrigger.click()
  await page
    .getByRole('menuitem', { name: initialDark ? /Light|浅色/ : /Dark|深色/ })
    .click()
  await page.waitForFunction(
    (expected) => document.documentElement.classList.contains('dark') === expected,
    !initialDark
  )
  await themeTrigger.click()
  await page
    .getByRole('menuitem', { name: initialDark ? /Dark|深色/ : /Light|浅色/ })
    .click()
  await page.waitForFunction(
    (expected) => document.documentElement.classList.contains('dark') === expected,
    initialDark
  )

  // ============================================
  // CSV exports: real downloads whose names match the response headers
  // ============================================

  const downloadDir = path.join(tempHome, 'downloads')
  fs.mkdirSync(downloadDir, { recursive: true })

  async function assertHeaderFilename(apiPath, expectedFilename) {
    const headerFilename = await page.evaluate(async (exportPath) => {
      const response = await fetch(exportPath)
      if (!response.ok) return null
      const disposition = response.headers.get('Content-Disposition') ?? ''
      return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? null
    }, apiPath)
    assert.equal(headerFilename, expectedFilename)
  }

  async function exportCsvViaButton(expectedFilename) {
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    await page
      .getByRole('button', { name: /Export CSV|导出 CSV/ })
      .first()
      .click()
    const download = await downloadPromise
    assert.equal(
      download.suggestedFilename(),
      expectedFilename,
      'download filename must match the Content-Disposition header'
    )
    const target = path.join(downloadDir, expectedFilename)
    await download.saveAs(target)
    const content = fs.readFileSync(target)
    assert.ok(content.length > 0, `${expectedFilename} download is empty`)
  }

  await assertHeaderFilename('/api/export/costs?format=csv', 'clawalytics-costs.csv')
  await exportCsvViaButton('clawalytics-costs.csv')

  await page.goto(`${appOrigin}/tools`, { waitUntil: 'domcontentloaded' })
  await assertHeaderFilename('/api/export/tools?format=csv', 'clawalytics-tools.csv')
  await exportCsvViaButton('clawalytics-tools.csv')

  // ============================================
  // Navigation sanity (existing behaviour)
  // ============================================

  const settings = page.getByText('Settings', { exact: true }).first()
  if (await settings.count()) {
    await settings.click()
    await page.waitForTimeout(300)
  }
} finally {
  await browser?.close()
  child?.kill()
  if (child?.pid) {
    try {
      execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    } catch {
      // The process may already have exited.
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 3000))
  try {
    fs.rmSync(tempHome, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 500,
    })
  } catch (error) {
    console.warn(`Unable to remove temporary Electron profile: ${error.message}`)
  }
}
