/** A whole number from 0 to 999999, ignoring surrounding spaces; anything else is null. */
export function parseCount(input: string): number | null {
  const s = input.trim()
  return /^\d{1,6}$/.test(s) ? Number(s) : null
}
