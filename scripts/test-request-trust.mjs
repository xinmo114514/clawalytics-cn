import assert from 'node:assert/strict'
import test from 'node:test'
import { isTrustedOrigin, isTrustedRequest } from '../src/server/security/request-trust.ts'

const electron = { mode: 'electron', port: 43123, desktopToken: 'secret' }
const development = { mode: 'development', port: 43123 }

test('allows the current loopback origin in Electron mode only with the token', () => {
  assert.equal(isTrustedOrigin('http://127.0.0.1:43123', electron), true)
  assert.equal(isTrustedRequest({ headers: { origin: 'http://127.0.0.1:43123', cookie: 'clawalytics_desktop_token=secret' } }, electron), true)
  assert.equal(isTrustedRequest({ headers: { origin: 'http://127.0.0.1:43123' } }, electron), false)
  assert.equal(isTrustedRequest({ headers: { 'x-clawalytics-desktop-token': 'secret' } }, electron), true)
  assert.equal(isTrustedRequest({ headers: {} }, electron), false)
})

test('rejects hostile origins before route handling', () => {
  for (const method of ['GET', 'POST']) {
    assert.equal(isTrustedRequest({ headers: { origin: 'https://evil.example', cookie: 'clawalytics_desktop_token=secret' } }, electron), false, method)
  }
})

test('keeps the explicit Vite origin and originless local development compatible', () => {
  assert.equal(isTrustedOrigin('http://localhost:5173', development), true)
  assert.equal(isTrustedRequest({ headers: {} }, development), true)
})

test('rejects wrong ports, schemes, hosts and malformed origins', () => {
  for (const origin of [
    'https://127.0.0.1:43123',
    'http://127.0.0.1:43124',
    'http://0.0.0.0:43123',
    'not-an-origin',
  ]) {
    assert.equal(isTrustedOrigin(origin, electron), false, origin)
  }
})
