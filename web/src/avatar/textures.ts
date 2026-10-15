// Colour helpers shared by the Sims and the buildings.

/** Mix a hex colour towards black (amount < 0) or white (amount > 0). */
export function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  const [r, g, b] = [mix(n >> 16), mix((n >> 8) & 255), mix(n & 255)]
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
