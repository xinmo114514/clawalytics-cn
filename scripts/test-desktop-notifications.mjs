import assert from 'node:assert/strict'
import {
  buildNotification,
  diffSourceSnapshots,
} from '../electron/notification-stats.mjs'

const zero = () => ({
  totalCost: 0,
  totalTokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
})

const snapshot = (openclaw = zero(), hermes = zero()) => ({
  openclaw,
  hermes,
})

const stats = (cost, input, output = 0) => ({
  totalCost: cost,
  totalTokens: { input, output, cacheRead: 0, cacheCreation: 0 },
})

const formatCurrency = (value) => `¥${value}`
const formatInteger = (value) => String(value)
const translate = (zh, _en) => zh
const notify = (previousSnapshots, currentSnapshots, trigger = 'activity') =>
  buildNotification({
    previousSnapshots,
    currentSnapshots,
    trigger,
    enabled: true,
    translate,
    formatCurrency,
    formatInteger,
  })

let result = notify(snapshot(), snapshot(stats(1, 10), zero()))
assert.equal(result.notification.title, 'OpenClaw 用量已更新')
assert.match(result.notification.body, /OpenClaw：新增 10 词元，成本 \+¥1/)

result = notify(snapshot(), snapshot(zero(), stats(2, 20)))
assert.equal(result.notification.title, 'Hermes 用量已更新')
assert.match(result.notification.body, /Hermes：新增 20 词元，成本 \+¥2/)

result = notify(
  snapshot(stats(1, 1), stats(2, 2)),
  snapshot(stats(4, 4), stats(5, 5))
)
assert.equal(result.notification.title, 'OpenClaw + Hermes 用量已更新')
assert.match(result.notification.body, /OpenClaw：/)
assert.match(result.notification.body, /Hermes：/)

assert.equal(
  notify(snapshot(), snapshot(stats(1, 0)), 'tokens').notification,
  null
)
assert.equal(
  notify(snapshot(), snapshot(stats(0, 1)), 'cost').notification,
  null
)
assert.ok(notify(snapshot(), snapshot(stats(1, 1)), 'both').notification)

result = notify(snapshot(stats(5, 5)), snapshot(stats(2, 2)))
assert.equal(result.notification, null)
assert.deepEqual(result.resetSources, ['openclaw'])

const regression = diffSourceSnapshots(
  snapshot(stats(5, 5), stats(1, 1)),
  snapshot(stats(2, 2), stats(3, 3))
)
assert.deepEqual(regression.resetSources, ['openclaw'])
assert.equal(regression.deltas.openclaw.totalCost, 0)
assert.equal(regression.deltas.hermes.totalCost, 2)

result = buildNotification({
  previousSnapshots: snapshot(stats(1, 1)),
  currentSnapshots: snapshot(stats(1, 1)),
  trigger: 'activity',
  enabled: false,
  translate,
  formatCurrency,
  formatInteger,
})
assert.equal(result.notification, null)

console.log('Desktop notification checks passed')
