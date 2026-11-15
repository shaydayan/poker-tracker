// Position labels, clockwise from the dealer. Pure.

const AFTER_BB = {
  0: [],
  1: ['UTG'],
  2: ['UTG', 'CO'],
  3: ['UTG', 'HJ', 'CO'],
  4: ['UTG', 'MP', 'HJ', 'CO'],
  5: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
  6: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
}

/** Rotate `seats` so it starts at the first seat strictly after `fromSeat` (clockwise). */
export function orderFrom(seats, fromSeat) {
  const sorted = [...seats].sort((a, b) => a - b)
  const after = sorted.filter((s) => s > fromSeat)
  const before = sorted.filter((s) => s <= fromSeat)
  return [...after, ...before]
}

/** Map seat -> position label for the active seats and dealer. Heads-up: dealer is SB. */
export function positionsFor(seats, dealerSeat) {
  const n = seats.length
  const out = {}
  if (n === 0) return out
  if (n === 1) return { [seats[0]]: 'BTN' }
  const clockwise = [dealerSeat, ...orderFrom(seats, dealerSeat).filter((s) => s !== dealerSeat)]
  if (n === 2) {
    out[clockwise[0]] = 'BTN'
    out[clockwise[1]] = 'BB'
    return out
  }
  const labels = ['BTN', 'SB', 'BB', ...AFTER_BB[n - 3]]
  clockwise.forEach((seat, i) => (out[seat] = labels[i]))
  return out
}

/** Next active seat clockwise after `seat`. */
export function nextSeat(seats, seat) {
  return orderFrom(seats, seat)[0]
}

/** Seat that posts the small blind (dealer when heads-up). */
export function smallBlindSeat(seats, dealerSeat) {
  return seats.length === 2 ? dealerSeat : nextSeat(seats, dealerSeat)
}

export function bigBlindSeat(seats, dealerSeat) {
  return nextSeat(seats, smallBlindSeat(seats, dealerSeat))
}
