import assert from 'node:assert/strict'
import { materializeWslSqliteDatabase } from '../src/server/lib/wsl-openclaw.ts'

let invoked = false
const materialized = materializeWslSqliteDatabase('\\\\wsl.localhost\\Ubuntu\\home\\user\\.openclaw\\state.db', {
  platform: 'win32',
  commandRunner: (file) => {
    invoked = file === 'wsl.exe'
  },
})
assert.equal(invoked, true)
assert.notEqual(materialized.databasePath, materialized.sourcePath)
materialized.cleanup()

const linux = materializeWslSqliteDatabase('\\\\wsl.localhost\\Ubuntu\\home\\user\\.openclaw\\state.db', {
  platform: 'linux',
})
assert.equal(linux.databasePath, linux.sourcePath)
