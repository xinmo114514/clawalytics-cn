import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  isAllowedAppNavigation,
  isAllowedExternalUrl,
} from '../electron/navigation-policy.mjs'

for (const url of ['https://example.com/docs', 'mailto:user@example.com']) {
  assert.equal(isAllowedExternalUrl(url), true, url)
}
for (const url of ['file:///C:/secret.txt', 'smb://server/share', 'custom://open', 'http://evil.example']) {
  assert.equal(isAllowedExternalUrl(url), false, url)
}

const origin = 'http://127.0.0.1:41777'
assert.equal(isAllowedAppNavigation(`${origin}/settings`, origin, 'data:text/html,loading'), true)
assert.equal(isAllowedAppNavigation('https://evil.example', origin, 'data:text/html,loading'), false)
assert.equal(isAllowedAppNavigation('data:text/html,loading', origin, 'data:text/html,loading'), true)

const directoryBuildRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'clawalytics-directory-build-')
)
try {
  process.env.CLAWALYTICS_DIRECTORY_BUILD = '1'
  const prepareNsisAppDir = (
    await import('../scripts/prepare-nsis-app-dir.cjs')
  ).default
  await prepareNsisAppDir({
    electronPlatformName: 'win32',
    appOutDir: path.join(directoryBuildRoot, 'win-unpacked'),
  })
  assert.equal(
    fs.existsSync(path.join(directoryBuildRoot, 'win-unpacked-nsis')),
    false
  )
} finally {
  delete process.env.CLAWALYTICS_DIRECTORY_BUILD
  fs.rmSync(directoryBuildRoot, { recursive: true, force: true })
}
