// Session: who sits where for one evening, clockwise from me. Pure.
import { nextSeat } from './positions.js'

export const MAX_SEATS = 9

/** seats: [{ seat, playerId|null, name, sittingOut }] in clockwise order; seat 1 is me.
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

export function validateSession(session) {
  if (session.seats.length < 2) return 'Add at least one other player.'
  if (session.seats.length > MAX_SEATS) return `At most ${MAX_SEATS} players.`
  return null
}
