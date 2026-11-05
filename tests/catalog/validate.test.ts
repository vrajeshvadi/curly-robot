import { describe, expect, test } from 'vitest'
import { usedIn, validateCatalog, validateItemEdit } from '../../src/catalog/validate'
import type { Item } from '../../src/types'
import { cloneCatalog, testCatalog } from '../fixtures/testCatalog'

const bread = testCatalog.items.bread
const machineBread = (patch: Partial<Extract<Item['source'], { kind: 'machine' }>>): Item => ({
  ...bread,
  source: { ...(bread.source as Extract<Item['source'], { kind: 'machine' }>), ...patch },
})

describe('validateCatalog', () => {
  test('test catalog has no issues', () => {
    expect(validateCatalog(testCatalog)).toEqual([])
  })

  test('missing ingredient is reported on the item', () => {
    const c = cloneCatalog()
    c.items.bread = machineBread({ ingredients: [{ itemId: 'flour', qty: 1 }] })
    const issues = validateCatalog(c)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ kind: 'missing-ingredient', itemId: 'bread' })
  })

  test('a loop between items is reported as a cycle', () => {
    const issues = validateItemEdit(testCatalog, {
      ...testCatalog.items.wheat,
      source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 5,
        ingredients: [{ itemId: 'bread', qty: 1 }] },
    })
    expect(issues.some((i) => i.kind === 'cycle')).toBe(true)
  })

  test.each([
    ['yield 0', machineBread({ yield: 0 })],
    ['minutes 0', machineBread({ minutes: 0 })],
    ['ingredient qty 0', machineBread({ ingredients: [{ itemId: 'wheat', qty: 0 }] })],
  ])('non-positive value: %s', (_label, item) => {
    expect(validateItemEdit(testCatalog, item)).toEqual([
      expect.objectContaining({ kind: 'non-positive', itemId: 'bread' }),
    ])
  })

  test('field harvest yield not above seed used is non-positive', () => {
    const issues = validateItemEdit(testCatalog, {
      ...testCatalog.items.wheat,
      source: { kind: 'field', seedUsed: 2, harvestYield: 2, minutes: 2 },
    })
    expect(issues).toEqual([expect.objectContaining({ kind: 'non-positive', itemId: 'wheat' })])
  })

  test('unknown machine is reported', () => {
    expect(validateItemEdit(testCatalog, machineBread({ machineId: 'oven' }))).toEqual([
      expect.objectContaining({ kind: 'unknown-resource', itemId: 'bread' }),
    ])
  })

  test('validateItemEdit does not modify the catalog it was given', () => {
    validateItemEdit(testCatalog, machineBread({ machineId: 'oven' }))
    expect(testCatalog.items.bread.source).toMatchObject({ machineId: 'bakery' })
  })
})

describe('usedIn', () => {
  test('lists items that use wheat, sorted by name', () => {
    expect(usedIn(testCatalog, 'wheat')).toEqual(['blackberry_muffin', 'bread', 'chicken_feed'])
  })
})
