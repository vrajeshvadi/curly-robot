import { expect, test } from 'vitest'
import { newFarm } from '../../src/lib/newFarm'
import { testCatalog } from '../fixtures/testCatalog'

test('new farm owns machines unlocked at its level', () => {
  const f = newFarm(testCatalog, 'Baby 1', 1)
  expect(f.name).toBe('Baby 1')
  expect(f.level).toBe(1)
  expect(f.machines.feed_mill).toEqual({ owned: true, slots: 2 })
  expect(f.machines.bakery).toEqual({ owned: false, slots: 2 })
  expect(f.fields).toBe(0)
  expect(f.animals).toEqual({ chicken: 0 })
  expect(f.trees).toEqual({ apple_tree: 0 })
  expect([f.barnCapacity, f.siloCapacity]).toEqual([50, 50])
  expect(f.id).toMatch(/^[0-9a-f-]{36}$/)
})
