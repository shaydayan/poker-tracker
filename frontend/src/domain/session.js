// Session: who sits where for one evening, clockwise from me. Pure.
import { nextSeat } from './positions.js'

export const MAX_SEATS = 9

/** seats: [{ seat, playerId|null, name, sittingOut, stack?, buyIn? }] in clockwise order; seat 1 is me. `stack` is the
 *  size of their stack (one of STACKS; absent = DEFAULT_STACK) and `buyIn` how many chips they bought in for in all so far
 *  (absent = the game's buy-in, settings.buyIn). Both carry over from hand to hand until changed; each hand keeps a copy
 *  of them (see handExtras).
 *  dealerSeat is the seat the button is expected to be on for the current hand (null until the first hand confirms one). */
export function createSession({ id, date, seats }) {
  return { id, date, seats, heroSeat: 1, dealerSeat: null, handNo: 1, ended: false }
}

export function seatRows(hero, others) {
  return [{ seat: 1, playerId: hero.id, name: hero.name, sittingOut: false }, ...others.map((p, i) => ({ seat: i + 2, playerId: p.id ?? null, name: p.name, sittingOut: false }))]
}

export function activeSeats(session) {
  return session.seats.filter((s) => !s.sittingOut).map((s) => s.seat)
}

export function namesBySeat(session) {
  return Object.fromEntries(session.seats.map((s) => [s.seat, s.name]))
}

/** Move to the next hand. The button passes to the seat after the dealer of the hand just played
 *  (or after the expected one, when the hand was skipped before a dealer was confirmed). */
export function withNextHand(session, dealerSeat) {
  const from = dealerSeat ?? session.dealerSeat
  return { ...session, dealerSeat: from == null ? null : nextSeat(activeSeats(session), from), handNo: session.handNo + 1 }
}

/** Close the session; it then only appears in the history. */
export function withEnded(session) {
  return { ...session, ended: true }
}

/** The session with exactly `out` sitting out (the next hand starts with them out). */
export function withSitOuts(session, out) {
  return { ...session, seats: session.seats.map((s) => ({ ...s, sittingOut: out.includes(s.seat) })) }
}

/** The seats sitting out now, for the first action of the next hand. */
export const sitOuts = (session) => session.seats.filter((s) => s.sittingOut).map((s) => s.seat)

export function withSittingOut(session, seatNo, sittingOut) {
  return { ...session, seats: session.seats.map((s) => (s.seat === seatNo ? { ...s, sittingOut } : s)) }
}

/** Stack sizes in chips, smallest first; a player not set yet has the middle one. */
export const STACKS = [
  { id: '0-100', label: '0–100' },
  { id: '100-250', label: '100–250' },
  { id: '250-500', label: '250–500' },
  { id: '500-1000', label: '500–1000' },
  { id: '1000+', label: '1000+' },
]
export const DEFAULT_STACK = '250-500'
export const stackLabel = (id) => STACKS.find((k) => k.id === id)?.label ?? id

/** The most a player can have bought in for in all, and the step between amounts. */
export const MAX_BUY_IN = 2000
export const BUY_IN_STEP = 100

/** The amounts a player's total buy-in can be: from the game's buy-in (settings.buyIn) up to MAX_BUY_IN. */
export function buyInValues(buyIn) {
  const out = []
  for (let v = buyIn; v <= Math.max(buyIn, MAX_BUY_IN); v += BUY_IN_STEP) out.push(v)
  return out
}

/** A player's stack size and total buy-in now (the defaults when not set). */
export const stackOf = (seat) => seat.stack ?? DEFAULT_STACK
export const buyInOf = (seat, settings) => seat.buyIn ?? settings.buyIn

/** The session with a player's stack size set (one of STACKS). */
export function withStack(session, seatNo, stack) {
  return { ...session, seats: session.seats.map((s) => (s.seat === seatNo ? { ...s, stack } : s)) }
}

/** The session with a player's total buy-in set, in chips (the first buy-in plus every rebuy). */
export function withBuyIn(session, seatNo, buyIn) {
  return { ...session, seats: session.seats.map((s) => (s.seat === seatNo ? { ...s, buyIn } : s)) }
}

/** Every player's stack size and total buy-in now, as a hand keeps them: { stacks: { seat: '250-500' }, buyIns: { seat: 600 } }
 *  (the defaults written out, so a later change of the settings does not change a hand). */
export function handExtras(session, settings) {
  const stacks = {}
  const buyIns = {}
  for (const s of session.seats) {
    stacks[s.seat] = stackOf(s)
    buyIns[s.seat] = buyInOf(s, settings)
  }
  return { stacks, buyIns }
}

export function validateSession(session) {
  if (session.seats.length < 2) return 'Add at least one other player.'
  if (session.seats.length > MAX_SEATS) return `At most ${MAX_SEATS} players.`
  return null
}
