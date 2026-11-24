// Table-first capture: the hand as the turns around the table, one player at a time. Pure.
// State is rebuilt from the hand's entries (see "entries and edits" below for their shape), and `toAnswers` maps them
// onto the question-based hand model, so a hand captured either way is saved and analysed the same.
// Older hands kept other actions too ('board', 'show', 'cards-who', 'cards', 'next-street', 'rest-fold', 'rest-call',
// and one action standing for several players' turns); `apply` still reads them, and `normalize` turns them into entries.
import { orderFrom, positionsFor, smallBlindSeat, bigBlindSeat } from './positions.js'
import { roundToBB } from './sizing.js'
import { END } from './hand.js'
import { cardLabel, handLabel, notation } from './cards.js'

const STREETS = ['preflop', 'flop', 'turn', 'river']
const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** A table before the dealer is known, from the same arguments as a question-based hand. */
export function createTable({ handNo, seats, players, suggestedDealer, heroSeat, settings }) {
  return {
    handNo,
    allSeats: [...seats], // everyone at the table this session
    seats: [...seats], // the ones playing this hand (all of them unless a 'seats' action sits some out)
    out: [], // sitting this hand out
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
    straddler: null,
    street: null, // 'preflop' | 'flop' | 'turn' | 'river' | 'over'
    endStreet: null, // once over: the street the hand ended on
    status: {}, // seat -> { folded, bet (this street), last (label for this street) }
    queue: [], // seats still to act this street, in order
    highest: 0, // bet to match this street
    raises: 0, // bets and raises this street
    pot: 0, // chips from earlier streets
    ended: false, // folded out or ended by hand before the river closed
    showdown: false,
    pendingSeat: null,
    shownHands: {},
    board: [], // the community cards picked so far, in order: flop 3, turn, river
    actions: [],
  }
}

/** The same table for a hand that was created for the question flow. */
export function fromHand(base) {
  const { handNo, seats, players, suggestedDealer, heroSeat } = base
  const settings = { smallBlind: base.smallBlind, bigBlind: base.bigBlind, straddle: base.straddleSize, openRaise: base.openRaise, straddleOpenRaise: base.straddleOpenRaise, threeBet: base.threeBet, fourBet: base.fourBet, postflopRaise: base.postflopRaise }
  // The board and the cards shown are kept on the hand, not among its turns.
  return { ...createTable({ handNo, seats, players, suggestedDealer, heroSeat, settings }), board: [...(base.board ?? [])], shownHands: { ...(base.shown ?? {}) } }
}

// ---- reading -----------------------------------------------------------------------------------

export const toAct = (t) => t.queue[0] ?? null
export const live = (t) => t.seats.filter((s) => !t.status[s]?.folded)
/** Still in the hand and not all-in: will be asked to act. */
const canBet = (t, s) => !t.status[s]?.folded && !t.status[s]?.allIn
export const isOver = (t) => t.street === 'over'
export const inCardsPhase = (t) => isOver(t) && t.pendingSeat === null
export const toCall = (t, seat) => Math.max(0, t.highest - (t.status[seat]?.bet ?? 0))
/** Community cards out: 0 preflop, 3 on the flop, 4 on the turn, 5 on the river (kept once the hand is over). */
export const boardCount = (t) => ({ flop: 3, turn: 4, river: 5 })[isOver(t) ? t.endStreet : t.street] ?? 0
/** The street being played, or the one the hand ended on. */
export const streetNow = (t) => (isOver(t) ? t.endStreet : t.street)
export const potNow = (t) => t.pot + t.seats.reduce((sum, s) => sum + (t.status[s]?.bet ?? 0), 0)

/** Seats that may act now: the one to act and anyone after it this street (the ones before are folded or checked). */
export const canAct = (t) => t.queue

/** A straddle is only on the table for the first player to act preflop, before anything else happened. */
export function canStraddle(t) {
  return t.street === 'preflop' && t.straddler === null && t.actions[t.actions.length - 1]?.type === 'dealer' && t.seats.length > 2
}

/** Slider bounds for a bet or raise by the player to act, like the question flow's. */
export function amountRange(t) {
  const bb = t.bigBlind
  let min
  let def
  if (t.street === 'preflop') {
    min = 2 * t.highest
    def = t.raises === 0 ? (t.straddler !== null ? t.straddleOpenRaise : t.openRaise) : t.raises === 1 ? t.threeBet * t.highest : t.fourBet * t.highest
  } else if (t.highest === 0) {
    min = bb
    def = potNow(t) / 2
  } else {
    min = 2 * t.highest
    def = t.postflopRaise * t.highest
  }
  min = roundToBB(min, bb)
  def = Math.max(min, roundToBB(def, bb))
  return { min, def, max: Math.max(200 * bb, 4 * def) }
}

/**
 * What a seat can be asked now, as the buttons beside it: [{ kind, amount? }]. Before the dealer is known, 'dealer' for
 * everyone playing; while betting, for each seat still to act this street: 'fold' and 'call' (with the amount) facing a
 * bet, else 'check'; 'bet' (nothing in yet) or 'raise'; 'straddle' (the first player preflop, while it is on offer); and
 * 'allin'. Nothing once they have acted this street, folded, gone all-in, or the hand is over.
 */
export function seatChoices(t, seat) {
  if (!t.seats.includes(seat)) return []
  if (t.street === null) return [{ kind: 'dealer' }]
  if (isOver(t) || !t.queue.includes(seat)) return []
  const out = toCall(t, seat) > 0 ? [{ kind: 'fold' }, { kind: 'call', amount: t.highest }] : [{ kind: 'check' }]
  out.push({ kind: t.highest === 0 ? 'bet' : 'raise' })
  if (canStraddle(t) && seat === toAct(t)) out.push({ kind: 'straddle', amount: t.straddleSize })
  out.push({ kind: 'allin' })
  return out
}

/** Every exact card already on the table (the board and the hands shown), so none is picked twice; `except` leaves out
 *  that seat's own cards (when changing them). */
export const usedCards = (t, except = null) => [...t.board, ...Object.entries(t.shownHands).filter(([s, c]) => Number(s) !== except && Array.isArray(c)).flatMap(([, c]) => c)]

/** One short status per seat: what they did this street (folds stay). The cards shown are in `shownHands`. */
export function seatStatus(t) {
  const out = {}
  for (const s of t.seats) {
    const st = t.status[s]
    if (st?.last) out[s] = st.last
  }
  for (const s of t.out) out[s] = 'Out'
  return out
}

const BETTING = ['straddle', 'fold', 'call', 'raise', 'allin', 'next-street', 'rest-fold', 'rest-call', 'end']

/** Action `a` as taken at table `t`: a betting action records the street it was taken on. */
export const withStreet = (t, a) => (BETTING.includes(a.type) ? { ...a, street: t.street } : a)

/** Whether action `a` can be taken at table `t` (used to put back the actions after one that was entered again). */
export function isValid(t, a) {
  if (a.type === 'seats') return t.street === null && t.actions.every((x) => x.type === 'seats') && t.allSeats.length - a.out.length >= 2
  const betting = t.street !== null && t.street !== 'over'
  if (a.type === 'street-end') return streetClosed(t, a.street)
  if (a.street !== undefined && a.street !== t.street) return false // taken on another street (older actions have none)
  switch (a.type) {
    case 'dealer':
      return t.street === null && t.seats.includes(a.seat)
    case 'straddle':
      return canStraddle(t)
    case 'fold':
    case 'call':
      return betting && t.queue.includes(a.seat)
    case 'raise':
      return betting && t.queue.includes(a.seat) && a.amount > t.highest
    case 'allin':
      return betting && t.queue.includes(a.seat) && a.amount > (t.status[a.seat]?.bet ?? 0)
    case 'next-street':
    case 'rest-fold':
    case 'rest-call':
    case 'end':
      return betting
    case 'cards-who':
      return isOver(t) && t.pendingSeat === null && t.seats.includes(a.seat) && !(a.seat in t.shownHands)
    case 'cards':
      return t.pendingSeat !== null
    case 'show':
      return t.street !== null && t.pendingSeat === null && t.seats.includes(a.seat) && a.cards.length >= 1 && a.cards.length <= 2 && !a.cards.some((c) => usedCards(t, a.seat).includes(c))
    case 'board':
      return a.cards.length <= boardCount(t)
    default:
      return false
  }
}

// ---- entries and edits -------------------------------------------------------------------------
// A hand is kept as entries, one per player turn, so every row of the log is one entry and every edit works the same:
//   { type: 'seats', out } and { type: 'dealer', seat } first (who sits out, the button); then each turn, always for the
//   player to act: { type: 'fold' | 'call' | 'raise' | 'allin', seat, amount?, street, id } (a call with `check: true` is a
//   check) or { type: 'straddle', street, id }. A turn the app filled in (a player skipped by acting for a later one, or
//   closed by End Street) is an entry of its own with `auto: true` and `by`, the id of the entry that filled it in;
//   { type: 'street-end', street, id } where End Street closed a street (after the turns it filled in);
//   { type: 'end', street, id } where End Hand stopped the betting.
// The board and the cards shown are not turns: they are kept on the hand (`base.board`, `base.shown`) and change at any
// time. Older hands are turned into this shape by `normalize`.

const BETS = ['fold', 'call', 'raise', 'allin']
const CARD_ACTIONS = ['board', 'show', 'cards-who', 'cards']
const betting = (t) => t.street !== null && t.street !== 'over'
const nextIdOf = (actions) => actions.reduce((m, a) => Math.max(m, a.id ?? 0), 0) + 1

/** Whether `street` has closed at `t` (the hand is on a later street, or over on it or after it). */
function streetClosed(t, street) {
  if (t.street === null) return false
  const k = STREETS.indexOf(street)
  return isOver(t) ? STREETS.indexOf(t.endStreet) >= k : STREETS.indexOf(t.street) > k
}

/** The turn the app fills in for `seat` (the player to act): a fold facing a bet, else a check. */
function filled(t, seat, by, id) {
  const e = toCall(t, seat) > 0 ? { type: 'fold', seat } : { type: 'call', seat, check: true }
  return { ...e, auto: true, by, street: t.street, id }
}

/** A player's own turn as taken at `t`: its street and id; a call when nothing is owed is a check. */
function own(t, a, id) {
  const e = { ...a, street: t.street, id }
  delete e.auto
  delete e.by
  if (e.type === 'call') {
    if (toCall(t, e.seat) === 0) e.check = true
    else delete e.check
  }
  return e
}

/**
 * The entries for action `a` taken at `t` (the live hand, or an older hand being converted), new ids from `nextId`:
 * acting for a later player first fills in the ones before them; End Street ('next-street') fills in everyone still to
 * act, then adds its own entry (an older hand's 'rest-fold' / 'rest-call' fold or call them all instead).
 * @returns {{ entries, t, nextId }}
 */
export function play(t, a, nextId = 1) {
  let u = t
  let id = nextId
  const entries = []
  const add = (e) => {
    entries.push(e)
    u = apply(u, e)
  }
  if (a.type === 'next-street' || a.type === 'rest-fold' || a.type === 'rest-call') {
    const mark = id++
    const street = u.street
    while (u.street === street && u.queue.length) {
      const s = u.queue[0]
      if (a.type === 'next-street') add(filled(u, s, mark, id++))
      else add({ type: a.type === 'rest-fold' ? 'fold' : 'call', seat: s, auto: true, by: mark, street, id: id++ })
    }
    add({ type: 'street-end', street, id: mark })
  } else if (a.type === 'end') add({ type: 'end', street: u.street, id: a.id ?? id++ })
  else if (a.type === 'street-end') add(a)
  else if (a.type === 'straddle') add({ type: 'straddle', street: u.street, id: a.id ?? id++ })
  else if (BETS.includes(a.type)) {
    const mine = a.id ?? id++
    if (!a.auto) while (betting(u) && u.queue.length && u.queue[0] !== a.seat) add(filled(u, u.queue[0], mine, id++))
    if (betting(u) && u.queue[0] === a.seat) add(a.auto ? { ...a, street: u.street, id: mine } : own(u, a, mine))
  } else add(a)
  return { entries, t: u, nextId: id }
}

/** Any hand, older ones included, in the shape above (the board and cards shown moved onto the hand); a hand already in
 *  it comes back the same. @returns {{ base, actions }} */
export function normalize(base, actions) {
  const end = replay(fromHand(base), actions)
  const b = { ...base, board: [...end.board], shown: { ...end.shownHands } }
  let t = fromHand(b)
  let id = nextIdOf(actions)
  const out = []
  for (const a of actions) {
    if (CARD_ACTIONS.includes(a.type) || !isValid(t, a)) continue
    const r = play(t, a, id)
    out.push(...r.entries)
    t = r.t
    id = r.nextId
  }
  return { base: b, actions: out }
}

/** A filled-in turn checked again: it follows the rule again (a fold facing a bet, else a check), except an older hand's
 *  "everyone else calls", which stays a call. */
const refilled = (t, a) => (a.type === 'call' && !a.check ? { ...a, street: t.street } : filled(t, a.seat, a.by, a.id))

/** Whether a player's own turn `e` can be taken at `t`, where they are to act. */
function allowed(t, e) {
  if (e.type === 'raise') return e.amount > t.highest
  if (e.type === 'allin') return e.amount > (t.status[e.seat]?.bet ?? 0)
  if (e.type === 'call' && e.check) return toCall(t, e.seat) === 0 // a check never turns into a call
  return true
}

/**
 * `actions` checked again from entry `from` on, after a change before it. Each entry that still fits stays: a player
 * who now acts later than before gets the turns before them filled in, and a filled-in turn follows the rule again. One
 * that no longer fits is taken out: a player who has folded or already acted, a raise now too small, a check now facing a
 * bet, a turn of another street, End Street on a street still open. @returns {{ actions, removed }}: how many were taken
 * out, not counting filled-in turns (never entered by hand)
 */
export function rebuild(base, actions, from = 0) {
  let t = replay(base, actions.slice(0, from))
  const out = actions.slice(0, from)
  let removed = 0
  let id = nextIdOf(actions)
  const push = (e) => {
    out.push(e)
    t = apply(t, e)
  }
  for (const a of actions.slice(from)) {
    const drop = () => {
      if (!a.auto) removed += 1 // a filled-in turn that goes is not counted: it was never entered
    }
    let fits = false
    if (a.type === 'seats') fits = t.street === null && t.allSeats.length - a.out.length >= 2
    else if (a.type === 'dealer') fits = t.street === null && t.seats.includes(a.seat)
    else if (a.type === 'street-end') fits = streetClosed(t, a.street)
    else if (a.type === 'end') fits = betting(t) && a.street === t.street
    else if (a.type === 'straddle') fits = canStraddle(t)
    if (!BETS.includes(a.type)) {
      if (fits) push(a)
      else drop()
      continue
    }
    if (!betting(t) || a.street !== t.street || !t.queue.includes(a.seat)) {
      drop()
      continue
    }
    let u = t
    const fills = []
    while (betting(u) && u.queue[0] !== a.seat && u.queue.includes(a.seat)) {
      fills.push(filled(u, u.queue[0], a.auto ? a.by : a.id, id++))
      u = apply(u, fills[fills.length - 1])
    }
    // A player's own turn is kept as entered (a check stays a check; a call with nothing owed now reads as a check).
    const e = betting(u) && u.queue[0] === a.seat ? (a.auto ? refilled(u, a) : { ...a, street: u.street, ...(a.type === 'call' && toCall(u, a.seat) === 0 && { check: true }) }) : null
    if (!e || (!a.auto && !allowed(u, e))) {
      drop()
      continue
    }
    fills.forEach(push)
    push(e)
  }
  return { actions: out, removed }
}

/** Entry `i` (a player's turn) as it stood: the table just before it, whose turn it was, and what they could do then
 *  (see seatChoices). */
export function turnAt(base, actions, i) {
  const t = replay(base, actions.slice(0, i))
  const a = actions[i]
  const seat = a.type === 'straddle' ? toAct(t) : a.seat
  return { t, seat, choices: seatChoices(t, seat) }
}

/** Entry `i` changed to `choice` ({ kind, amount? }, a kind from seatChoices); every entry after it checked again.
 *  @returns {{ actions, removed }} */
export function changeTurn(base, actions, i, choice) {
  const { t, seat } = turnAt(base, actions, i)
  const old = actions[i]
  const k = choice.kind
  const e =
    k === 'straddle' ? { type: 'straddle', street: t.street, id: old.id }
    : own(t, k === 'fold' ? { type: 'fold', seat } : k === 'check' || k === 'call' ? { type: 'call', seat } : { type: k === 'allin' ? 'allin' : 'raise', seat, amount: choice.amount }, old.id)
  return rebuild(base, [...actions.slice(0, i), e, ...actions.slice(i + 1)], i)
}

/** End Street (with the turns it filled in) or End Hand at entry `i` taken back; the entries after it checked again.
 *  @returns {{ actions, removed }} */
export function reopen(base, actions, i) {
  const mark = actions[i]
  const gone = (a, j) => j === i || (a.auto && a.by === mark.id)
  const first = actions.findIndex(gone)
  return rebuild(base, actions.filter((a, j) => !gone(a, j)), first)
}

/** How many turns End Street at entry `i` filled in. */
export const filledBy = (actions, i) => actions.filter((a) => a.auto && a.by === actions[i].id).length

/** Who sits out changed (`out`); every entry checked again. @returns {{ actions, removed }} */
export function withSeatsOut(base, actions, out) {
  const i = actions.findIndex((a) => a.type === 'seats')
  const next = i < 0 ? [{ type: 'seats', out }, ...actions] : actions.map((a, j) => (j === i ? { type: 'seats', out } : a))
  return rebuild(base, next, 0)
}

/** The dealer changed to `seat`; every entry after it checked again. @returns {{ actions, removed }} */
export function withDealer(base, actions, seat) {
  const i = actions.findIndex((a) => a.type === 'dealer')
  if (i < 0) return rebuild(base, [...actions, { type: 'dealer', seat }], actions.length)
  return rebuild(base, actions.map((a, j) => (j === i ? { type: 'dealer', seat } : a)), i)
}

// ---- actions -----------------------------------------------------------------------------------

function deal(t, seat) {
  const status = Object.fromEntries(t.seats.map((s) => [s, { folded: false, bet: 0, last: null }]))
  const sb = smallBlindSeat(t.seats, seat)
  const bb = bigBlindSeat(t.seats, seat)
  status[sb] = { folded: false, bet: t.smallBlind, last: 'SB' }
  status[bb] = { folded: false, bet: t.bigBlind, last: 'BB' }
  return { ...t, dealerSeat: seat, positions: positionsFor(t.seats, seat), status, street: 'preflop', queue: orderFrom(t.seats, bb), highest: t.bigBlind, raises: 0, pot: 0 }
}

function withStatus(t, seat, patch) {
  return { ...t, status: { ...t.status, [seat]: { ...t.status[seat], ...patch } } }
}

function fold(t, seat) {
  return withStatus(t, seat, { folded: true, last: 'Fold' })
}

function call(t, seat) {
  const owed = toCall(t, seat)
  return withStatus(t, seat, { bet: t.highest, last: owed > 0 ? `Call ${t.highest}` : 'Check' })
}

/** Seats queued before `seat` are folded when a bet is faced, checked otherwise; `seat` becomes next to act. */
function advanceTo(t, seat) {
  let u = t
  while (u.queue.length && u.queue[0] !== seat) {
    const s = u.queue[0]
    u = toCall(u, s) > 0 ? fold(u, s) : call(u, s)
    u = { ...u, queue: u.queue.slice(1) }
  }
  return u
}

/** After an action: the hand is over when one player is left, the street moves on when everyone has acted. */
function settle(t) {
  if (live(t).length === 1) return { ...t, street: 'over', endStreet: t.street, ended: true, queue: [] }
  if (t.queue.length) return t
  const status = { ...t.status }
  for (const s of t.seats) status[s] = { ...status[s], bet: 0, last: status[s].folded ? 'Fold' : status[s].allIn ? 'All-In' : null }
  const pot = potNow(t)
  const queue = orderFrom(t.seats, t.dealerSeat).filter((s) => canBet({ status }, s))
  // After the river, or when all-ins leave at most one player who can bet: the rest of the board, then the showdown.
  if (t.street === 'river' || queue.length < 2) return { ...t, status, pot, street: 'over', endStreet: 'river', showdown: true, highest: 0, queue: [] }
  const street = STREETS[STREETS.indexOf(t.street) + 1]
  return { ...t, status, pot, street, queue, highest: 0, raises: 0 }
}

export function apply(t, a) {
  const u = { ...t, actions: [...t.actions, a] }
  switch (a.type) {
    case 'seats':
      return { ...u, seats: u.allSeats.filter((s) => !a.out.includes(s)), out: [...a.out] }
    case 'dealer':
      return deal(u, a.seat)
    case 'straddle': {
      const seat = toAct(u)
      const v = withStatus(u, seat, { bet: u.straddleSize, last: `Str ${u.straddleSize}` })
      return { ...v, straddler: seat, highest: u.straddleSize, queue: orderFrom(u.seats, seat).filter((s) => canBet(v, s)) }
    }
    case 'fold': {
      const v = advanceTo(u, a.seat)
      if (live(v).length === 1) return settle(v) // everyone before them folded: the hand is theirs before they act
      return settle({ ...fold(v, a.seat), queue: v.queue.slice(1) })
    }
    case 'call': {
      const v = advanceTo(u, a.seat)
      if (live(v).length === 1) return settle(v)
      return settle({ ...call(v, a.seat), queue: v.queue.slice(1) })
    }
    case 'raise': {
      const v = advanceTo(u, a.seat)
      if (live(v).length === 1) return settle(v)
      const w = withStatus(v, a.seat, { bet: a.amount, last: `${v.highest === 0 ? 'Bet' : 'Raise'} ${a.amount}` })
      return settle({ ...w, highest: a.amount, raises: v.raises + 1, queue: orderFrom(w.seats, a.seat).filter((s) => s !== a.seat && canBet(w, s)) })
    }
    case 'allin': {
      const v = advanceTo(u, a.seat)
      if (live(v).length === 1) return settle(v)
      const w = withStatus(v, a.seat, { bet: a.amount, allIn: true, last: `All-In ${a.amount}` })
      if (a.amount <= v.highest) return settle({ ...w, queue: v.queue.slice(1) }) // a call, maybe for less
      return settle({ ...w, highest: a.amount, raises: v.raises + 1, queue: orderFrom(w.seats, a.seat).filter((s) => s !== a.seat && canBet(w, s)) })
    }
    case 'next-street': {
      let v = u
      for (const s of u.queue) {
        if (toCall(v, s) === 0) v = call(v, s)
        else if (live(v).length > 1) v = fold(v, s) // the last one standing takes the pot
      }
      return settle({ ...v, queue: [] })
    }
    case 'rest-fold': {
      let v = u
      for (const s of u.queue) if (live(v).length > 1) v = fold(v, s) // the last one standing takes the pot
      return settle({ ...v, queue: [] })
    }
    case 'rest-call': {
      let v = u
      for (const s of u.queue) v = call(v, s)
      return settle({ ...v, queue: [] })
    }
    case 'end':
      return { ...u, street: 'over', endStreet: u.street, ended: true, queue: [] }
    case 'street-end': // marks where End Street closed a street (its turns are entries of their own)
      return u
    case 'cards-who':
      return { ...u, pendingSeat: a.seat }
    case 'cards':
      return { ...u, shownHands: { ...u.shownHands, [u.pendingSeat]: a.cards }, pendingSeat: null }
    case 'show':
      return { ...u, shownHands: { ...u.shownHands, [a.seat]: [...a.cards] } }
    case 'board':
      return { ...u, board: [...a.cards] }
    default:
      return u
  }
}

export function replay(base, actions) {
  return actions.reduce(apply, base)
}

// ---- to the question model ---------------------------------------------------------------------

/**
 * The same hand as answers for `Hand.replay`: each raise with the callers before it, a street's first bet, the
 * closing round of every street, the end of the hand and the cards shown. Only complete rounds are emitted, so the
 * question-model hand always sits at a step boundary.
 */
export function toAnswers(base, actions) {
  const out = []
  let t = base
  let calls = 0 // calls since the last bet or raise on this street
  let betOpen = false // after the flop: a bet has been made this street
  let straddleKnown = false
  const closeStreet = (street) => {
    if (street === 'preflop') out.push({ step: 'raise', value: null }, { step: 'callers', value: calls })
    else if (!betOpen) out.push({ step: `${street}-bet`, value: { seat: null } })
    else out.push({ step: `${street}-raise`, value: null }, { step: `${street}-callers`, value: calls })
    calls = 0
    betOpen = false
  }
  for (const a of actions) {
    const before = t
    t = apply(t, a)
    switch (a.type) {
      case 'dealer':
        out.push({ step: 'dealer', value: a.seat })
        break
      case 'straddle':
        out.push({ step: 'straddle', value: true })
        straddleKnown = true
        break
      case 'end':
        out.push({ step: END, value: before.street })
        break
      case 'cards-who':
        out.push({ step: 'cards-who', value: a.seat })
        break
      case 'cards':
        out.push({ step: 'cards', value: Array.isArray(a.cards) ? notation(a.cards) : a.cards }) // the stats model keeps the notation
        break
      case 'show': // given to the stats model once the hand is over (below), whenever it was entered
      case 'board':
      case 'street-end':
      case 'seats': // who played is the question-model hand's seat list (see domain/record.js)
        break
      default: {
        if (!straddleKnown) {
          out.push({ step: 'straddle', value: false })
          straddleKnown = true
        }
        const s = before.street
        const p = s === 'preflop' ? '' : `${s}-`
        // A check counts as a call (a limp) preflop before any raise, for everyone but the last blind: with equal blinds
        // the small blind owes nothing yet is a caller in the question model.
        const lastForced = before.straddler ?? bigBlindSeat(before.seats, before.dealerSeat)
        const isCall = (x) => toCall(before, x) > 0 || (s === 'preflop' && before.raises === 0 && x !== lastForced)
        const calledBy = (seats) => seats.filter(isCall).length
        const skipped = a.seat != null ? before.queue.slice(0, before.queue.indexOf(a.seat)) : []
        calls += calledBy(skipped.filter((x) => toCall(before, x) === 0)) // skipped seats fold when they owe, else check
        const allinRaise = a.type === 'allin' && a.amount > before.highest
        if (a.type === 'call') calls += calledBy([a.seat])
        if (a.type === 'allin' && !allinRaise) calls += 1 // the stats model has no all-in: a call
        if (a.type === 'rest-call') calls += calledBy(before.queue)
        if (a.type === 'next-street') calls += calledBy(before.queue.filter((x) => toCall(before, x) === 0)) // the rest check or fold
        if (a.type === 'raise' || allinRaise) {
          if (s !== 'preflop' && before.highest === 0) {
            out.push({ step: `${s}-bet`, value: { seat: a.seat } }, { step: `${s}-bet-amount`, value: a.amount })
            betOpen = true
          } else out.push({ step: `${p}raise`, value: a.seat }, { step: `${p}amount`, value: a.amount }, { step: `${p}callers`, value: calls })
          calls = 0
        }
      }
    }
    if (before.street && before.street !== 'over' && t.street !== before.street && a.type !== 'end') {
      // Folding out with calls in (someone folded while facing nothing) has no closing round in the question model:
      // it is a hand that ended before the street closed.
      const foldedOut = t.street === 'over' && !t.showdown
      const bettingOpen = before.street === 'preflop' || betOpen
      if (foldedOut && (!bettingOpen || calls > 0)) out.push({ step: END, value: before.street })
      else closeStreet(before.street)
      // All-in before the river: the streets left are run out with no betting.
      if (t.showdown) for (const later of STREETS.slice(STREETS.indexOf(before.street) + 1)) closeStreet(later)
    }
  }
  // The question model takes shown cards after the betting; it keeps two-card hands only (as notation). A single card
  // stays in the actions for later.
  if (isOver(t)) {
    const told = new Set(out.filter((x) => x.step === 'cards-who').map((x) => x.value)) // an older hand's, given above
    for (const [s, c] of Object.entries(t.shownHands)) {
      const seat = Number(s)
      if (told.has(seat)) continue
      if (Array.isArray(c) && c.length === 2) out.push({ step: 'cards-who', value: seat }, { step: 'cards', value: notation(c) })
      else if (typeof c === 'string') out.push({ step: 'cards-who', value: seat }, { step: 'cards', value: c })
    }
  }
  return out
}

// ---- text --------------------------------------------------------------------------------------

const TURN = { fold: 'folds', check: 'checks', call: 'calls', straddle: 'straddles', bet: 'bets', raise: 'raises to', allin: 'all-in' }
const turnText = (e) => (e.amount != null && e.kind !== 'fold' && e.kind !== 'check' ? `${TURN[e.kind]} ${e.amount}` : TURN[e.kind])

/**
 * The betting as rows for the log, in order: for each street reached a heading (`kind: 'street'`, with that street's
 * board cards once dealt), then each turn (`kind: 'turn'`: `index` of its entry, `seat`, `text` like "raises to 45",
 * `auto` when the app filled it in), and End Street / End Hand where they were pressed (`kind: 'mark'`, `mark` the entry
 * type, `text`). A street reached with no turn yet, or run out after an all-in, still gets its heading. Who sits out, the
 * dealer and the cards shown are not part of the betting (the log shows them above and below it).
 */
export function logRows(base, actions) {
  const rows = []
  let t = base
  let at = -1 // the last street given a heading
  const headTo = (street) => {
    const k = STREETS.indexOf(street)
    for (let j = at + 1; j <= k; j += 1) rows.push({ kind: 'street', street: STREETS[j] })
    at = Math.max(at, k)
  }
  actions.forEach((a, i) => {
    const before = t
    t = apply(t, a)
    if (a.type === 'street-end') return rows.push({ kind: 'mark', index: i, mark: a.type, street: a.street, text: 'End Street' })
    if (a.type === 'end') return rows.push({ kind: 'mark', index: i, mark: a.type, street: a.street, text: a.street === 'preflop' ? 'Hand ended preflop' : `Hand ended on the ${a.street}` })
    if (!betting(before)) return undefined
    headTo(before.street)
    for (const e of seatEvents(before, a)) rows.push({ kind: 'turn', index: i, seat: e.seat, street: before.street, text: turnText(e), auto: !!a.auto })
    return undefined
  })
  const now = streetNow(t)
  if (now) headTo(now)
  const dealt = t.board.slice(0, boardCount(t))
  const cards = { flop: dealt.slice(0, 3), turn: dealt.slice(3, 4), river: dealt.slice(4, 5) }
  return rows.map((r) => (r.kind === 'street' ? { ...r, cards: cards[r.street] ?? [] } : r))
}

// ---- history -----------------------------------------------------------------------------------

/** What each seat did in one action, in turn order: [{ seat, kind: 'straddle'|'fold'|'check'|'call'|'bet'|'raise', amount? }]. */
export function seatEvents(before, a) {
  const queueAfter = () => apply(before, a)
  switch (a.type) {
    case 'straddle':
      return [{ seat: toAct(before), kind: 'straddle', amount: before.straddleSize }]
    case 'fold':
    case 'call':
    case 'raise':
    case 'allin': {
      const skipped = before.queue.slice(0, before.queue.indexOf(a.seat))
      const out = skipped.map((s) => ({ seat: s, kind: toCall(before, s) > 0 ? 'fold' : 'check' }))
      const v = advanceTo(before, a.seat)
      if (live(v).length === 1) return out // everyone before them folded: they never act
      if (a.type === 'fold') out.push({ seat: a.seat, kind: 'fold' })
      else if (a.type === 'call') out.push(toCall(v, a.seat) > 0 ? { seat: a.seat, kind: 'call', amount: v.highest } : { seat: a.seat, kind: 'check' })
      else if (a.type === 'allin') out.push({ seat: a.seat, kind: 'allin', amount: a.amount, raise: a.amount > v.highest })
      else out.push({ seat: a.seat, kind: v.highest === 0 ? 'bet' : 'raise', amount: a.amount })
      return out
    }
    case 'rest-fold':
    case 'next-street': {
      const after = queueAfter()
      return before.queue
        .map((s) => (a.type === 'next-street' && toCall(before, s) === 0 ? { seat: s, kind: 'check' } : after.status[s].folded ? { seat: s, kind: 'fold' } : null))
        .filter(Boolean)
    }
    case 'rest-call':
      return before.queue.map((s) => (toCall(before, s) > 0 ? { seat: s, kind: 'call', amount: before.highest } : { seat: s, kind: 'check' }))
    default:
      return []
  }
}

/** The betting of each street reached, in order: [{ street, moves, callers, players, done }]. `moves` are the straddle, bets
 *  and raises (an all-in above the bet is a raise), `callers` the seats that called the last of them (before any bet
 *  preflop: the limpers), `players` how many were still in when the street began, `done` whether the betting closed
 *  and the hand went on (not ended by hand or folded out on it). Folds and checks are left out. */
function streetPlay(base, actions) {
  const out = []
  let t = base
  let cur = null
  for (const a of actions) {
    const before = t
    t = apply(t, a)
    const street = before.street
    if (!street || street === 'over') continue
    if (cur?.street !== street) {
      cur = { street, moves: [], callers: [], players: live(before).length, done: false }
      out.push(cur)
    }
    const lastForced = before.straddler ?? bigBlindSeat(before.seats, before.dealerSeat)
    for (const e of seatEvents(before, a)) {
      const raised = cur.moves.some((m) => m.kind !== 'straddle')
      if (e.kind === 'straddle' || e.kind === 'bet' || e.kind === 'raise' || (e.kind === 'allin' && e.raise)) {
        cur.moves.push(e)
        cur.callers = []
      } else if (e.kind === 'call' || e.kind === 'allin') cur.callers.push(e.seat)
      // With equal blinds the small blind owes nothing before a raise, yet joins the pot like any limper.
      else if (e.kind === 'check' && street === 'preflop' && !raised && e.seat !== lastForced) cur.callers.push(e.seat)
    }
    if (t.street !== street) cur.done = !(t.street === 'over' && !t.showdown)
  }
  return out
}

const VERB = { straddle: 'straddles', bet: 'bets', raise: 'raises', allin: 'all-in' }
const handShort = (cards) => (Array.isArray(cards) ? cards.map(cardLabel).join('') : cards)

/** How the hand ended, with the pot: "Tal wins 120", "Showdown, pot 300", "Ended on the turn, pot 180". */
function result(t) {
  const pot = potNow(t)
  if (!isOver(t)) return null
  if (!t.showdown && live(t).length === 1) return `${t.players[live(t)[0]]} wins ${pot}`
  if (t.showdown) return `Showdown, pot ${pot}`
  return `${t.endStreet === 'preflop' ? 'Ended preflop' : `Ended on the ${t.endStreet}`}, pot ${pot}`
}

/**
 * The hand street by street, naming only who put chips in: [{ label, text }], after the dealer, e.g. Dealer "Shay", Preflop "Tal raises 25, 4 call",
 * Flop "A♥ K♦ 7♣ · Tal bets 35, Shay calls" (the board first, when it was picked), Turn "Checked", Result "Tal wins 120",
 * Shown "Tal A♥ K♥ · Shay Q♠ Q♣". Each street gives its bets and raises in order, then who called the last one: by name when
 * one or two, else a count ("4 call"; before any raise preflop, "4 limp"). Folds and checks are left out; a street that
 * closed with no bet reads "Checked".
 */
export function streetLines(base, actions) {
  const t = replay(base, actions)
  const name = (s) => t.players[s] ?? `#${s}`
  const play = streetPlay(base, actions)
  const board = { flop: t.board.slice(0, 3), turn: t.board.slice(3, 4), river: t.board.slice(4, 5) }
  const reached = isOver(t) ? STREETS.indexOf(t.endStreet) : STREETS.indexOf(t.street)
  const lines = t.dealerSeat !== null ? [{ label: 'Dealer', text: name(t.dealerSeat) }] : []
  STREETS.slice(0, reached + 1).forEach((street) => {
    const p = play.find((x) => x.street === street)
    const parts = (p?.moves ?? []).map((e) => `${name(e.seat)} ${VERB[e.kind]} ${e.amount}`)
    const word = street === 'preflop' && !p?.moves.length ? 'limp' : 'call'
    const callers = p?.callers ?? []
    if (callers.length) parts.push(callers.length <= 2 ? `${callers.map(name).join(', ')} ${callers.length === 1 ? `${word}s` : word}` : `${callers.length} ${word}`)
    const text = parts.join(', ') || (street !== 'preflop' && p?.done ? 'Checked' : '')
    const cards = (board[street] ?? []).map(cardLabel).join(' ')
    const full = [cards, text].filter(Boolean).join(' · ')
    if (full) lines.push({ label: cap(street), text: full })
  })
  const res = result(t)
  if (res) lines.push({ label: 'Result', text: res })
  const shown = Object.entries(t.shownHands)
  if (shown.length) lines.push({ label: 'Shown', text: shown.map(([s, c]) => `${name(s)} ${handLabel(c)}`).join(' · ') })
  return lines
}

/**
 * The whole hand on one line, for lists: the last raise preflop, how many saw the flop, how it ended, the cards shown.
 * "Kuta 3-bets 340 · 2 to flop · flop, pot 700 · Shay J♥J♠ vs Kuta 8♥8♠", "Straddle 10 · 5 to flop · Idan wins 85 on the
 * flop", "Limped · 4 to flop · showdown, pot 40". Limpers, callers and folds are not named.
 */
export function summary(base, actions) {
  const t = replay(base, actions)
  const name = (s) => t.players[s] ?? `#${s}`
  const play = streetPlay(base, actions)
  const pre = play.find((p) => p.street === 'preflop')
  if (!pre) return 'Nothing recorded'
  const parts = []
  const raises = pre.moves.filter((m) => m.kind !== 'straddle')
  const last = raises.at(-1)
  if (last) parts.push(`${name(last.seat)} ${last.kind === 'allin' ? 'all-in' : raises.length === 1 ? 'raises' : `${raises.length + 1}-bets`} ${last.amount}`)
  else if (pre.moves.length) parts.push(`Straddle ${pre.moves[0].amount}`)
  else if (pre.callers.length) parts.push('Limped')
  const flop = play.find((p) => p.street === 'flop')
  const pot = potNow(t)
  const street = streetNow(t)
  if (street !== 'preflop' || (t.showdown && pre.done)) parts.push(`${flop?.players ?? live(t).length} to flop`)
  if (isOver(t) && !t.showdown && live(t).length === 1) parts.push(`${name(live(t)[0])} wins ${pot}${street === 'preflop' ? '' : ` on the ${street}`}`)
  else parts.push(`${t.showdown ? 'showdown' : street}, pot ${pot}`)
  const shown = Object.entries(t.shownHands).filter(([, c]) => c?.length)
  if (shown.length) parts.push(shown.map(([s, c]) => `${name(s)} ${handShort(c)}`).join(' vs '))
  const line = parts.join(' · ')
  return line[0].toUpperCase() + line.slice(1)
}

/** What a hand is about, for finding hands: `inHand` the seats that put chips in by choice (straddle, limp, call, bet,
 *  raise, all-in; folding to a raise after limping still counts), `raised` the seats that bet or raised on any street,
 *  `showed` the seats whose cards were entered, `preflopRaises` the raises before the flop (0 limped, 1 raised, 2+ 3-bet),
 *  `pot` the pot at the end, `dealer` the dealer's seat (null if not set). */
export function handFacts(base, actions) {
  const inHand = new Set()
  const raised = new Set()
  let preflopRaises = 0
  let t = base
  for (const a of actions) {
    const before = t
    t = apply(t, a)
    if (!before.street || before.street === 'over') continue
    const lastForced = before.straddler ?? bigBlindSeat(before.seats, before.dealerSeat)
    for (const e of seatEvents(before, a)) {
      const raise = e.kind === 'bet' || e.kind === 'raise' || (e.kind === 'allin' && e.raise)
      const limp = e.kind === 'check' && before.street === 'preflop' && preflopRaises === 0 && e.seat !== lastForced
      if (raise || limp || ['straddle', 'call', 'allin'].includes(e.kind)) inHand.add(e.seat)
      if (raise) raised.add(e.seat)
      if (raise && before.street === 'preflop') preflopRaises += 1
    }
  }
  const showed = new Set(Object.entries(t.shownHands).filter(([, c]) => c?.length).map(([s]) => Number(s)))
  return { inHand, raised, showed, preflopRaises, pot: potNow(t), dealer: t.dealerSeat }
}
