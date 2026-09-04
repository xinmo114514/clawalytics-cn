import assert from 'node:assert/strict'
import net from 'node:net'
import WebSocket from 'ws'

const home = (await import('node:fs')).mkdtempSync((await import('node:path')).join((await import('node:os')).tmpdir(), 'clawalytics-security-'))
process.env.USERPROFILE = home
process.env.HOME = home

const { start, stop } = await import('../src/server/index.ts')

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => resolve(port))
    })
  })
}

try {
  const port = await freePort()
  await start({ port, runtimeMode: 'electron', desktopToken: 'secret' })
  const base = `http://127.0.0.1:${port}`

  const valid = await fetch(`${base}/api/health`, {
    headers: {
      Origin: base,
      'X-Clawalytics-Desktop-Token': 'secret',
    },
  })
  assert.equal(valid.status, 200)

  const validPost = await fetch(`${base}/api/config`, {
    method: 'POST',
    headers: {
      Origin: base,
      'X-Clawalytics-Desktop-Token': 'secret',
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  assert.equal(validPost.status, 200)

  const originlessDesktop = await fetch(`${base}/api/health`, {
    headers: { 'X-Clawalytics-Desktop-Token': 'secret' },
  })
  assert.equal(originlessDesktop.status, 200)
  assert.equal((await fetch(`${base}/api/health`)).status, 403)
  const invalidQuery = await fetch(`${base}/api/stats/daily?days=1e2`, {
    headers: {
      Origin: base,
      'X-Clawalytics-Desktop-Token': 'secret',
    },
  })
  assert.equal(invalidQuery.status, 400)
  const invalidId = await fetch(`${base}/api/channels/1abc`, {
    headers: {
      Origin: base,
      'X-Clawalytics-Desktop-Token': 'secret',
    },
  })
  assert.equal(invalidId.status, 400)

  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${base}/api/health`, {
      method,
      headers: {
        Origin: 'https://evil.example',
        'X-Clawalytics-Desktop-Token': 'secret',
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? '{}' : undefined,
    })
    assert.equal(response.status, 403, method)
  }

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace('http', 'ws')}/ws`, {
      headers: { Origin: 'https://evil.example', 'X-Clawalytics-Desktop-Token': 'secret' },
    })
    socket.once('unexpected-response', (_request, response) => {
      assert.equal(response.statusCode, 403)
      resolve()
    })
    socket.once('error', reject)
  })

  const openSocket = (headers) => new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace('http', 'ws')}/ws`, { headers })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
  const validSocket = await openSocket({
    Origin: base,
    'X-Clawalytics-Desktop-Token': 'secret',
  })
  await new Promise((resolve) => {
    validSocket.once('close', resolve)
    validSocket.close()
  })

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace('http', 'ws')}/ws`)
    socket.once('unexpected-response', (_request, response) => {
      assert.equal(response.statusCode, 403)
      resolve()
    })
    socket.once('error', reject)
  })

  const sockets = []
  try {
    for (let index = 0; index < 32; index += 1) {
      sockets.push(await openSocket({
        Origin: base,
        'X-Clawalytics-Desktop-Token': 'secret',
      }))
    }
    await new Promise((resolve, reject) => {
      const overflow = new WebSocket(`${base.replace('http', 'ws')}/ws`, {
        headers: {
          Origin: base,
          'X-Clawalytics-Desktop-Token': 'secret',
        },
      })
      overflow.once('unexpected-response', (_request, response) => {
        assert.equal(response.statusCode, 503)
        resolve()
      })
      overflow.once('error', reject)
    })
  } finally {
    for (const socket of sockets) socket.close()
  }
} finally {
  await stop()
  ;(await import('node:fs')).rmSync(home, { recursive: true, force: true })
}
