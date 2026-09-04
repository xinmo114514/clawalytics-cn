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

  const settings = page.getByText('Settings', { exact: true }).first()
  if (await settings.count()) {
    await settings.click()
    await page.waitForTimeout(300)
  }
  const appOrigin = new URL(page.url()).origin
  assert.match(appOrigin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/)
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
