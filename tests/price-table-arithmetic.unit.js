import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPriceTables, priceTableValues } from '../src/utils/priceTable.js'

const row = (cost, value, driver = 'price') => ({
  from: '1',
  cost,
  value,
  driver,
})
test('exact per-item price, margin percentage and profit match backend rounding', () => {
  assert.deepEqual(priceTableValues(row('12', '20')), {
    price: '20',
    marginPercent: '40',
    marginAmount: '8',
    error: '',
  })
  assert.equal(priceTableValues(row('10', '17')).marginPercent, '41.176471')
  assert.equal(priceTableValues(row('0.1', '0.3')).marginAmount, '0.2')
  assert.equal(priceTableValues(row('4', '2')).marginPercent, '-100')
  assert.equal(priceTableValues(row('4', '2')).marginAmount, '-2')
  assert.equal(priceTableValues(row('0', '0')).marginPercent, '')
  assert.equal(priceTableValues(row('0', '0')).marginAmount, '0')
  assert.equal(priceTableValues(row('', '20')).marginAmount, '')
})
test('margin intent survives cost edits, unknowns and rounded effective margin', () => {
  assert.equal(priceTableValues(row('12', '40', 'margin')).price, '20')
  assert.equal(priceTableValues(row('15', '40', 'margin')).price, '25')
  assert.equal(priceTableValues(row('2', '40', 'margin')).price, '3.333333')
  assert.equal(priceTableValues(row('', '40', 'margin')).price, '')
  assert.equal(
    priceTableValues(row('0.000001', '-20', 'margin')).marginPercent,
    '0',
  )
  for (const input of [
    row('1', '100', 'margin'),
    row('999999999', '99', 'margin'),
    row('-1', '2'),
    row('1', '2.1234567'),
  ])
    assert.ok(priceTableValues(input).error)
})
test('save preserves decimal strings and rejects duplicate quantities and variant overlap', () => {
  const table = {
    name: 'Standard',
    mode: 'all',
    variantIds: [],
    breaks: [row('1.000001', '40', 'margin')],
  }
  const saved = buildPriceTables([table], ['a'])
  assert.deepEqual(saved[0].breaks[0], {
    from: 1,
    cost: '1.000001',
    intent: { driver: 'margin', value: '40' },
  })
  assert.throws(
    () =>
      buildPriceTables(
        [{ ...table, breaks: [row('1', '2'), row('2', '3')] }],
        ['a'],
      ),
    /quantities must increase/,
  )
  assert.throws(
    () => buildPriceTables([table, { ...table, name: 'Blue' }], ['a']),
    /only one price table/,
  )
  assert.deepEqual(buildPriceTables([], ['a']), [])
})
