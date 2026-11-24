// Bet sizing helpers: everything is a multiple of the big blind. Pure.

export function roundToBB(value, bigBlind) {
  return Math.max(bigBlind, Math.round(value / bigBlind) * bigBlind)
}

/**
 * Values a raise slider can land on: the minimum, then round amounts. Steps are 1, 2, 5, 10, 20, 50… big blinds, each
 * used `tier` times, and every value after the minimum is a multiple of its step (with a 5 big blind: 25, 30 … 65, then
 * 70, 80 … 140, then 150, 175 …), so a slider started at 25 offers 100, never 105.
 */
export function raiseLadder({ min, max, bigBlind, tier = 8 }) {
  const out = [min]
  const steps = [1, 2, 5]
  let k = 0
  const step = () => bigBlind * steps[k % 3] * 10 ** Math.floor(k / 3)
  let v = Math.floor(min / step()) * step() + step() // the first multiple of the step above the minimum
  let n = 0
  while (v <= max) {
    out.push(v)
    if (++n === tier) {
      k += 1
      n = 0
      v = Math.floor(v / step()) * step() // carry on from the next multiple of the larger step
    }
    v += step()
  }
  return out
}

/** The ladder value closest to `value` (a suggested size lands on a round amount). */
export function nearestOnLadder(values, value) {
  return values.reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best), values[0])
}
