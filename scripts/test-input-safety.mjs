import assert from 'node:assert/strict'
import test from 'node:test'
import { toCsv } from '../src/shared/csv.ts'
import {
  parseBoundedInteger,
  parsePositiveSafeInteger,
} from '../src/server/lib/query-params.ts'

test('bounds integer query values and rejects ambiguous encodings', () => {
  assert.equal(parseBoundedInteger('30', 'days', 1, 3650), 30)
  for (const value of ['0', '-1', '1.5', '1e2', 'NaN', 'Infinity', '']) {
    assert.throws(() => parseBoundedInteger(value, 'days', 1, 3650))
  }
})

test('accepts only positive safe integer path IDs', () => {
  assert.equal(parsePositiveSafeInteger('42', 'channel ID'), 42)
  for (const value of [
    '0',
    '-1',
    '1.5',
    '1e2',
    '1abc',
    '9007199254740992',
    '',
  ]) {
    assert.throws(() => parsePositiveSafeInteger(value, 'channel ID'))
  }
})

test('escapes CSV fields and neutralizes formula prefixes', () => {
  const csv = toCsv(['value'], [['=SUM(A1)', 'x,y'], ['"quoted"']])
  assert.match(csv, /'=SUM\(A1\)/)
  assert.match(csv, /"x,y"/)
  assert.match(csv, /""quoted""/)
})
