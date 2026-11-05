import { expect, test } from 'vitest'
import { parseCount } from '../../src/lib/parseCount'

test.each([
  ['007', 7],
  ['0', 0],
  ['999999', 999999],
  [' 12 ', 12],
])('parses %j as %d', (input, expected) => {
  expect(parseCount(input)).toBe(expected)
})

test.each(['', '-3', '2.5', 'abc', '1e3', '1234567', '1 2'])('rejects %j', (input) => {
  expect(parseCount(input)).toBeNull()
})
