import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import yaml from 'yaml'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clawalytics-config-'))
process.env.USERPROFILE = home
process.env.HOME = home

try {
  const configDir = path.join(home, '.clawalytics')
  const openClawPath = path.join(home, '.openclaw')
  fs.mkdirSync(path.join(openClawPath, 'agents'), { recursive: true })
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    yaml.stringify({
      schemaVersion: 2,
      currency: 'CNY',
      rates: {},
      alertThresholds: {
        dailyBudget: 70,
        weeklyBudget: 350,
        monthlyBudget: 1400,
      },
      openClawPath,
      gatewayLogsPath: '/tmp/openclaw',
      wsl: {
        enabled: true,
        distro: 'Ubuntu-24.04',
        openClawPath,
      },
      securityAlertsEnabled: true,
      pricingEndpoint: null,
    })
  )

  const { loadConfig, normalizeHermesPath } = await import(
    '../src/server/config/loader.ts'
  )
  const config = loadConfig()
  assert.equal(config.schemaVersion, 3)
  assert.equal(config.dataSources.openclaw.enabled, true)
  assert.equal(config.dataSources.openclaw.environment, 'wsl')
  assert.equal(config.dataSources.openclaw.path, openClawPath)
  assert.equal(config.dataSources.hermes.enabled, false)
  assert.equal(config.dataSources.hermes.path, '')

  const hermesRoot = path.join(home, '.hermes')
  fs.mkdirSync(hermesRoot)
  fs.writeFileSync(path.join(hermesRoot, 'state.db'), '')
  assert.equal(
    normalizeHermesPath(path.join(hermesRoot, 'state.db'), 'local'),
    hermesRoot
  )

  const persisted = yaml.parse(
    fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf8')
  )
  assert.equal(persisted.schemaVersion, 3)
  assert.equal(persisted.dataSources.hermes.enabled, false)
  console.log('Data-source config migration checks passed')
} finally {
  fs.rmSync(home, { recursive: true, force: true })
}
