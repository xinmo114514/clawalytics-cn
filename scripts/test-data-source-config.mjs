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

  // Pricing cache must reflect rates loaded from disk after the config has
  // been updated, instead of staying pinned to whatever rates were captured
  // when initPricingService first ran. The loader already restores DEFAULT_RATES
  // for built-in models via deep merge, so deleting a custom override should
  // re-expose the default rates without a process restart.
  const { initPricingService, refreshPricingCache, getModelPricing } =
    await import('../src/server/services/pricing-service.ts')
  const { DEFAULT_RATES } = await import('../src/server/config/defaults.ts')
  const { saveConfig } = await import('../src/server/config/loader.ts')
  await initPricingService(null, loadConfig().rates)

  const baselineAnthropic = getModelPricing('anthropic', 'claude-sonnet-4')
  assert.ok(baselineAnthropic, 'baseline anthropic rate must be available')

  saveConfig({ ...loadConfig(), rates: { anthropic: { 'claude-sonnet-4': { input: 999, output: 888 } } } })
  refreshPricingCache(loadConfig().rates)
  const overridden = getModelPricing('anthropic', 'claude-sonnet-4')
  assert.equal(overridden?.input, 999)
  assert.equal(overridden?.output, 888)

  saveConfig({ ...loadConfig(), rates: {} })
  refreshPricingCache(loadConfig().rates)
  const restored = getModelPricing('anthropic', 'claude-sonnet-4')
  const baselineDefault = DEFAULT_RATES.anthropic['claude-sonnet-4']
  assert.ok(restored, 'built-in rate must be restored after delete')
  assert.equal(restored.input, baselineDefault.input)
  assert.equal(restored.output, baselineDefault.output)

  // Removing a rate for a built-in model via the delete-custom-rate flow must
  // restore the default rate, while removing a purely custom model must leave
  // it unpriced.
  saveConfig({
    ...loadConfig(),
    rates: {
      anthropic: { 'claude-sonnet-4': { input: 999, output: 888 } },
      customprov: { 'custom-model': { input: 11, output: 22 } },
    },
  })
  refreshPricingCache(loadConfig().rates)
  const merged = loadConfig().rates
  delete merged.anthropic['claude-sonnet-4']
  delete merged.customprov['custom-model']
  saveConfig({ ...loadConfig(), rates: merged })
  refreshPricingCache(loadConfig().rates)
  const restoredDefault = getModelPricing('anthropic', 'claude-sonnet-4')
  const baselineDefault2 = DEFAULT_RATES.anthropic['claude-sonnet-4']
  assert.ok(restoredDefault, 'built-in rate must be restored after delete')
  assert.equal(restoredDefault.input, baselineDefault2.input)
  assert.equal(restoredDefault.output, baselineDefault2.output)
  assert.equal(getModelPricing('customprov', 'custom-model'), null)
  console.log('Data-source config migration checks passed')
} finally {
  fs.rmSync(home, { recursive: true, force: true })
}
