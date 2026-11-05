/** 16 → "16 min", 80 → "1 h 20 min", 120 → "2 h". */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  if (h === 0) return `${min} min`
  return min === 0 ? `${h} h` : `${h} h ${min} min`
}
