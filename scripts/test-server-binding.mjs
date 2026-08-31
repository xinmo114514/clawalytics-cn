import assert from "node:assert/strict"
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"

const probeHome = fs.mkdtempSync(path.join(os.tmpdir(), "clawalytics-bind-test-"))
process.env.USERPROFILE = probeHome
process.env.HOME = probeHome

const reserve = net.createServer()
await new Promise((resolve, reject) =>
  reserve.listen(0, "127.0.0.1", () => resolve()).once("error", reject)
)
const reservedAddress = reserve.address()
const port = typeof reservedAddress === "object" && reservedAddress
  ? reservedAddress.port
  : 0
await new Promise((resolve) => reserve.close(resolve))

const { start, stop } = await import("../src/server/index.ts")
let started
try {
  started = await start({ port })
  const bound = started.server.address()
  assert.ok(bound, "server did not report a bound address")
  assert.notEqual(
    bound.address,
    "::",
    "server must not bind the IPv6 wildcard interface"
  )
  assert.notEqual(
    bound.address,
    "0.0.0.0",
    "server must not bind the IPv4 wildcard interface"
  )
  assert.equal(bound.address, "127.0.0.1")
  assert.equal(bound.port, port)

  const probe = await fetch(
    `http://127.0.0.1:${port}/api/health`
  )
  assert.equal(probe.status, 200)
  const body = await probe.json()
  assert.equal(body.status, "ok")

  // External interfaces must refuse connections on the same port. We collect
  // every non-loopback IPv4 address the OS exposes and verify none of them
  // can reach the bound port. The bind target is the loopback interface,
  // so any leaked address is enough to prove the server is exposed.
  const interfaces = os.networkInterfaces()
  const sample = []
  for (const list of Object.values(interfaces)) {
    if (!list) continue
    for (const entry of list) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('127.')) {
        sample.push(entry.address)
      }
    }
  }
  assert.ok(sample.length > 0, 'no non-loopback IPv4 addresses available to probe')

  const refused = await Promise.all(
    sample.map((host) =>
      new Promise((resolve) => {
        const socket = net.createConnection({ port, host })
        let settled = false
        const finish = (value) => {
          if (settled) return
          settled = true
          socket.destroy()
          resolve(value)
        }
        socket.once('connect', () => finish({ host, outcome: 'connected' }))
        socket.once('error', (error) =>
          finish({ host, outcome: 'refused', code: error?.code })
        )
        setTimeout(() => finish({ host, outcome: 'timeout' }), 1500)
      })
    )
  )
  const leaks = refused.filter((entry) => entry.outcome === 'connected')
  assert.deepEqual(
    leaks,
    [],
    'loopback-only binding must reject non-loopback traffic'
  )
} finally {
  if (started) {
    await stop()
  }
  fs.rmSync(probeHome, { recursive: true, force: true })
}

console.log("Server binding checks passed")
