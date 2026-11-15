// Hand engine: an ordered list of questions, each answered with one value. Pure; every function returns new state.
// The current step is derived from the answers so far, so undo and edit are both "replay the answers".
//
// Betting is a list of rounds per street. A round is one question about a raise:
//   { raiser: undefined | null | seat, amount, callers }
// With a raiser, `callers` is how many called *before* the raise (the players who acted earlier in the round);
// with none (raiser null), `callers` is how many called the previous bet or raise, which closes the street.
// Blinds count as callers only once they have acted.
import { positionsFor, orderFrom, nextSeat, smallBlindSeat, bigBlindSeat } from './positions.js'
import { roundToBB } from './sizing.js'

export const STREETS = ['flop', 'turn', 'river']
export const END = 'end' // the step name recorded when a hand is ended by hand
const STREET_STEP = /^(flop|turn|river)-(bet|bet-amount|raise|amount|callers)$/

export function createHand({ handNo, seats, players, suggestedDealer, heroSeat, settings }) {
  return {
    handNo,
    seats: [...seats],
    players: { ...players },
    heroSeat,
    suggestedDealer: suggestedDealer ?? null,
    smallBlind: settings.smallBlind,
    bigBlind: settings.bigBlind,
    straddleSize: settings.straddle,
    openRaise: settings.openRaise,
    straddleOpenRaise: settings.straddleOpenRaise,
    threeBet: settings.threeBet,
    fourBet: settings.fourBet,
    postflopRaise: settings.postflopRaise,
    dealerSeat: null,
    positions: {},
    straddle: null, // bool
    preflop: [], // rounds
    streets: { flop: null, turn: null, river: null }, // { bet: {type:'none'} | {seat, amount}, rounds: [] }
    ended: null, // step the hand was ended at by hand, or null when betting ran its course
    shownHands: {}, // seat -> notation
    pendingSeat: null,
    heroCards: null,
  }
}

// ---- steps -------------------------------------------------------------------------------------

export function currentStep(h) {
  if (h.dealerSeat === null) return 'dealer'
  const betting = h.ended ? null : bettingStep(h)
  if (betting) return betting
  return h.pendingSeat !== null ? 'cards' : 'cards-who'
}

/** The open question in a list of rounds, or null once the street is closed. */
function roundStep(rounds) {
  const last = rounds[rounds.length - 1]
  if (!last) return 'raise'
  if (last.raiser === undefined) return 'raise'
  if (last.raiser !== null && last.amount == null) return 'amount'
  if (last.callers == null) return 'callers'
  return last.raiser === null ? null : 'raise'
}

/** Closed with nobody calling the last bet or raise (or a walk preflop): betting is over. */
function uncontested(rounds) {
  const last = rounds[rounds.length - 1]
  return !!last && last.raiser === null && last.callers === 0
}

/** Next betting question, or null once betting is over (the river closed, a walk, or an uncalled bet or raise). */
function bettingStep(h) {
  if (h.straddle === null) return 'straddle'
  const pre = roundStep(h.preflop)
  if (pre) return pre
  if (uncontested(h.preflop)) return null
  for (const s of STREETS) {
    const st = h.streets[s]
    if (!st) return `${s}-bet`
    if (st.bet.type === 'none') continue
    if (st.bet.amount == null) return `${s}-bet-amount`
    const step = roundStep(st.rounds)
    if (step) return `${s}-${step}`
    if (uncontested(st.rounds)) return null
  }
  return null
}

/** Stop the betting questions here; what remains is entering any cards that were shown. No-op once betting is over. */
export function endHand(h) {
  if (h.dealerSeat === null || h.ended || bettingStep(h) === null) return h
  return { ...h, ended: bettingStep(h) }
}

/** Betting is over or was ended, and no card entry is half-way. */
export function inCardsPhase(h) {
  return currentStep(h) === 'cards-who'
}

/** The hand reached a showdown on its own: betting ran through the river without being ended by hand. */
export function wentToShowdown(h) {
  return !h.ended && h.dealerSeat !== null && bettingStep(h) === null && h.streets.river !== null && !uncontested(h.streets.river.rounds ?? [])
}

export function isAmountStep(step) {
  return step === 'amount' || step.endsWith('-amount')
}

// ---- who ---------------------------------------------------------------------------------------

/** Seat of the last preflop raiser, or null in a limped pot. */
export function preflopAggressor(h) {
  return lastRaiser(h.preflop)
}

function lastRaiser(rounds) {
  const r = [...rounds].reverse().find((x) => x.raiser != null)
  return r ? r.raiser : null
}

function lastAggressorOnStreet(st) {
  return lastRaiser(st.rounds) ?? st.bet.seat
}

function lastAmountOnStreet(st) {
  const r = [...st.rounds].reverse().find((x) => x.raiser != null && x.amount != null)
  return r ? r.amount : st.bet.amount ?? 0
}

/** Who is expected to bet on `street`: the last player to raise or bet before it. */
export function aggressorFor(h, street) {
  let a = preflopAggressor(h)
  for (const s of STREETS) {
    if (s === street) break
    const st = h.streets[s]
    if (st && st.bet.type !== 'none') a = lastAggressorOnStreet(st)
  }
  return a
}

/** How a bet by `seat` on `street` reads: a c-bet by the aggressor, a donk bet into them, or a plain bet in a limped pot. */
export function betKind(h, street, seat) {
  const a = aggressorFor(h, street)
  return a == null ? 'bet' : seat === a ? 'aggressor' : 'donk'
}

/** The street and rounds the current step belongs to. `lastForced` is the seat after which action starts (big blind,
 *  straddler, or the dealer after the flop); `betSeat` the street's bettor; `aggressor` the last to bet or raise. */
function currentRounds(h) {
  const m = currentStep(h).match(STREET_STEP)
  if (m) {
    const st = h.streets[m[1]]
    return { street: m[1], rounds: st.rounds, lastForced: h.dealerSeat, betSeat: st.bet.seat, aggressor: lastAggressorOnStreet(st) }
  }
  const lastForced = h.straddle ? nextSeat(h.seats, bigBlindSeat(h.seats, h.dealerSeat)) : bigBlindSeat(h.seats, h.dealerSeat)
  return { street: null, rounds: h.preflop, lastForced, betSeat: null, aggressor: lastRaiser(h.preflop) }
}

/** Who may raise now: everyone except the player who made the last bet or raise. */
export function raiseCandidates(h) {
  const { aggressor } = currentRounds(h)
  return h.seats.filter((s) => s !== aggressor)
}

/**
 * Players still in the hand when `street` starts (after everything when omitted). Only a round that closes a
 * street says who continues: its callers plus the last aggressor (the big blind in a limped pot).
 */
export function playersIn(h, street = null) {
  let n = h.seats.length
  const close = (rounds) => {
    const last = rounds[rounds.length - 1]
    if (last && last.raiser === null && last.callers != null) n = Math.min(n, last.callers + 1)
  }
  if (h.preflop.length) close(h.preflop)
  for (const s of STREETS) {
    if (s === street) break
    const st = h.streets[s]
    if (st && st.bet.type !== 'none') close(st.rounds)
  }
  return n
}

/**
 * Most players who can call now. Before a raise: the seats that act before the raiser in this round (blinds act
 * last preflop, so they are not callers until they have spoken). With no raise: everyone still in except the
 * player whose bet or raise they would call (preflop with no raise, everyone except the big blind).
 */
export function maxCallers(h) {
  if (!currentStep(h).endsWith('callers')) return 0
  const { street, rounds, lastForced, betSeat } = currentRounds(h)
  const inPlay = street ? playersIn(h, street) : h.seats.length
  const last = rounds[rounds.length - 1]
  if (last.raiser === null) return inPlay - 1
  const prev = lastRaiser(rounds.slice(0, -1)) ?? betSeat ?? lastForced // action in this round starts after this seat
  const before = orderFrom(h.seats, prev).indexOf(last.raiser)
  return Math.max(0, Math.min(before, street ? inPlay - 2 : h.seats.length))
}

// ---- money -------------------------------------------------------------------------------------

/** Chips in the middle before `street` (or at the end when omitted). */
export function potBefore(h, street = null) {
  let pot = h.smallBlind + h.bigBlind + (h.straddle ? h.straddleSize : 0)
  const play = (rounds, faced) => {
    for (const r of rounds) {
      pot += (r.callers ?? 0) * faced
      if (r.raiser != null && r.amount != null) {
        pot += r.amount
        faced = r.amount
      }
    }
  }
  play(h.preflop, h.straddle ? h.straddleSize : h.bigBlind)
  for (const s of STREETS) {
    if (s === street) break
    const st = h.streets[s]
    if (!st || st.bet.type === 'none') continue
    pot += st.bet.amount ?? 0
    play(st.rounds, st.bet.amount ?? 0)
  }
  return pot
}

/**
 * Slider bounds for the current amount step: { min, def, max } in chips, all multiples of the big blind.
 * Preflop: open = setting (bigger over a straddle), 3-bet and 4-bet+ = the settings' multipliers of the previous raise.
 * After the flop: a bet = half the pot, a raise = the setting's multiplier of the bet.
 */
export function amountRange(h) {
  const step = currentStep(h)
  const bb = h.bigBlind
  let min
  let def
  const m = step.match(STREET_STEP)
  if (step === 'amount') {
    const i = h.preflop.length - 1
    const prev = i > 0 ? h.preflop[i - 1].amount : null
    min = i === 0 ? 2 * (h.straddle ? h.straddleSize : bb) : 2 * prev
    def = i === 0 ? (h.straddle ? h.straddleOpenRaise : h.openRaise) : i === 1 ? h.threeBet * prev : h.fourBet * prev
  } else if (m && m[2] === 'bet-amount') {
    min = bb
    def = potBefore(h, m[1]) / 2
  } else if (m && m[2] === 'amount') {
    const last = lastAmountOnStreet(h.streets[m[1]])
    min = 2 * last
    def = h.postflopRaise * last
  } else return null
  min = roundToBB(min, bb)
  def = Math.max(min, roundToBB(def, bb))
  return { min, def, max: Math.max(200 * bb, 4 * def) }
}

// ---- answers -----------------------------------------------------------------------------------

function answerRound(rounds, step, value) {
  const last = rounds[rounds.length - 1]
  const replaceLast = (patch) => [...rounds.slice(0, -1), { ...last, ...patch }]
  switch (step) {
    case 'raise':
      return [...rounds, { raiser: value, amount: null, callers: null }]
    case 'amount':
      return replaceLast({ amount: value })
    case 'callers':
      return replaceLast({ callers: value })
    default:
      return rounds
  }
}

/** Apply the answer for the current step. */
export function answer(h, value) {
  const step = currentStep(h)
  const m = step.match(STREET_STEP)
  if (m) {
    const [, s, what] = m
    const st = h.streets[s]
    const patchStreet = (next) => ({ ...h, streets: { ...h.streets, [s]: next } })
    if (what === 'bet') return patchStreet({ bet: value.seat == null ? { type: 'none' } : { seat: value.seat, amount: null }, rounds: [] })
    if (what === 'bet-amount') return patchStreet({ ...st, bet: { ...st.bet, amount: value } })
    return patchStreet({ ...st, rounds: answerRound(st.rounds, what, value) })
  }
  switch (step) {
    case 'dealer':
      return { ...h, dealerSeat: value, positions: positionsFor(h.seats, value) }
    case 'straddle':
      return { ...h, straddle: !!value }
    case 'raise':
    case 'amount':
    case 'callers':
      return { ...h, preflop: answerRound(h.preflop, step, value) }
    case 'cards-who':
      return { ...h, pendingSeat: value }
    case 'cards':
      return { ...h, shownHands: { ...h.shownHands, [h.pendingSeat]: value }, pendingSeat: null }
    default:
      return h
  }
}

/**
 * Rebuild a hand from `[{ step, value }]`. Stops at the first answer whose step no longer matches,
 * so editing an earlier answer keeps the later ones that still make sense and drops the rest.
 * Returns the hand, the answers actually applied, and the state before each of them.
 */
export function replay(base, answers) {
  const states = []
  let h = base
  for (const a of answers) {
    if (a.step === END) {
      if (endHand(h) === h) break
      states.push(h)
      h = endHand(h)
      continue
    }
    if (currentStep(h) !== a.step) break
    states.push(h)
    h = answer(h, a.value)
  }
  return { hand: h, states, applied: answers.slice(0, states.length) }
}

export function setHeroCards(h, cards) {
  return { ...h, heroCards: cards }
}

// ---- text --------------------------------------------------------------------------------------

/**
 * One short status per seat for the table view: blinds and straddle, then each player's latest bet or raise
 * (a later street overrides an earlier one), and finally the cards they showed. Seats with nothing to say are absent.
 */
export function seatStatus(h) {
  const out = {}
  if (h.dealerSeat === null) return out
  const bb = bigBlindSeat(h.seats, h.dealerSeat)
  out[smallBlindSeat(h.seats, h.dealerSeat)] = 'SB'
  out[bb] = 'BB'
  if (h.straddle) out[nextSeat(h.seats, bb)] = `Str ${h.straddleSize}`
  const amount = (a) => (a == null ? '…' : String(a))
  h.preflop.forEach((r, i) => {
    if (r.raiser != null) out[r.raiser] = `${i === 0 ? 'R' : `${i + 2}B`} ${amount(r.amount)}`
  })
  for (const s of STREETS) {
    const st = h.streets[s]
    if (!st || st.bet.type === 'none') continue
    out[st.bet.seat] = `Bet ${amount(st.bet.amount)}`
    for (const r of st.rounds) if (r.raiser != null) out[r.raiser] = `R ${amount(r.amount)}`
  }
  for (const [seat, cards] of Object.entries(h.shownHands)) out[seat] = cards
  return out
}

const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** Which street a betting step belongs to, for labels. */
export function streetOf(step) {
  const m = step && step.match(STREET_STEP)
  return m ? cap(m[1]) : 'Preflop'
}

/** The raiser the current callers question is about, or null when it asks who called the last bet or raise. */
export function callersRaiser(h) {
  const { rounds } = currentRounds(h)
  const last = rounds[rounds.length - 1]
  return last ? last.raiser ?? null : null
}

/** Short summary of the hand in this model (used by tests to check what the table actions map to). */
export function describe(h) {
  const name = (s) => h.players[s] ?? `#${s}`
  const parts = []
  const calls = (n) => `${n} call${n === 1 ? '' : 's'}`
  const rounds = (rs) => {
    for (const r of rs) {
      if (r.raiser != null) parts.push(`${r.callers ? `${calls(r.callers)} · ` : ''}${name(r.raiser)} ${r.amount ?? '?'}`)
      else if (r.callers != null) parts.push(calls(r.callers))
    }
  }
  if (h.straddle !== null) parts.push(h.straddle ? 'straddle' : 'no straddle')
  rounds(h.preflop)
  for (const s of STREETS) {
    const st = h.streets[s]
    if (!st) break
    if (st.bet.type === 'none') {
      parts.push(`${s}: checked`)
      continue
    }
    const kind = betKind(h, s, st.bet.seat)
    parts.push(`${s}: ${kind === 'aggressor' ? 'c-bet' : `${kind} ${name(st.bet.seat)}`} ${st.bet.amount ?? '?'}`)
    rounds(st.rounds)
  }
  if (h.ended) parts.push(`ended ${streetOf(h.ended).toLowerCase()}`)
  else if (wentToShowdown(h)) parts.push('showdown')
  for (const [s, n] of Object.entries(h.shownHands)) parts.push(`${name(Number(s))} ${n}`)
  return parts.join(' · ')
}
