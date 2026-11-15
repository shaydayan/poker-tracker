// Bet sizing helpers: everything is a multiple of the big blind. Pure.

export function roundToBB(value, bigBlind) {
  return Math.max(bigBlind, Math.round(value / bigBlind) * bigBlind)
}

/**
 * Values a raise slider can land on. Steps start at one big blind and double every `tier` steps
 * (1BB, 1BB, … then 2BB, … then 4BB, …), so small sizes are fine-grained and big ones coarse.
 * The default is always on the ladder even when it falls between steps.
 */
export function raiseLadder({ min, def, max, bigBlind, tier = 8 }) {
  const out = []
  let v = min
  let step = bigBlind
  let n = 0
  while (v <= max) {
    out.push(v)
    v += step
    if (++n === tier) {
      step *= 2
      n = 0
    }
  }
  if (!out.includes(def)) out.push(def)
  return out.sort((a, b) => a - b)
}
