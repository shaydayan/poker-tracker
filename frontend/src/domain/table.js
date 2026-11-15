// Table-first capture: the hand as the actions around the table, one player at a time in turn. Pure.
// State is rebuilt from the list of actions (undo is a pop), and `toAnswers` maps those actions onto the
// question-based hand model, so a hand captured either way is saved and analysed the same.
//
// Actions: { type: 'dealer', seat } · { type: 'straddle' } · { type: 'fold' | 'call' | 'raise', seat, amount? }
//          · { type: 'next-street' } · { type: 'rest-fold' } · { type: 'rest-call' } · { type: 'end' }
//          · { type: 'board', cards } (the board so far, up to five cards like "Ah"; replaces the one before)
//          · { type: 'cards', cards } is a player's two exact cards (["Ah", "Kd"]; older hands saved a notation like "AKs") · { type: 'cards-who', seat } · { type: 'cards', cards }
// Acting for a seat that is not next folds (facing a bet) or checks the seats before it in one go; 'next-street' does
// the same for everyone still to act, so the street closes. ('rest-fold' folds them all; kept for older hands.)
// Betting actions carry the `street` they were taken on (see `withStreet`), so an action put back after an edit is
// dropped rather than moved when the hand is now on another street.
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
  return createTable({ handNo, seats, players, suggestedDealer, heroSeat, settings })
}

// ---- reading -----------------------------------------------------------------------------------

export const toAct = (t) => t.queue[0] ?? null
export const live = (t) => t.seats.filter((s) => !t.status[s]?.folded)
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

/** Every exact card already on the table (the board and the hands shown), so none is picked twice. */
export const usedCards = (t) => [...t.board, ...Object.values(t.shownHands).filter(Array.isArray).flat()]

/** One short status per seat: what they did this street (folds stay). The cards shown are in `shownHands`. */
export function seatStatus(t) {
  const out = {}
  for (const s of t.seats) {
    const st = t.status[s]
    if (st?.last) out[s] = st.last
  }
  return out
}

const BETTING = ['straddle', 'fold', 'call', 'raise', 'next-street', 'rest-fold', 'rest-call', 'end']

/** Action `a` as taken at table `t`: a betting action records the street it was taken on. */
export const withStreet = (t, a) => (BETTING.includes(a.type) ? { ...a, street: t.street } : a)

/** `actions` replayed from `base`, each betting action with its street (for actions written without one). */
export function withStreets(base, actions) {
  let t = base
  return actions.map((a) => {
    const s = withStreet(t, a)
    t = apply(t, s)
    return s
  })
}

/** Whether action `a` can be taken at table `t` (used to put back the actions after one that was entered again). */
export function isValid(t, a) {
  const betting = t.street !== null && t.street !== 'over'
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
    case 'next-street':
    case 'rest-fold':
    case 'rest-call':
    case 'end':
      return betting
    case 'cards-who':
      return isOver(t) && t.pendingSeat === null && t.seats.includes(a.seat) && !(a.seat in t.shownHands)
    case 'cards':
      return t.pendingSeat !== null
    case 'board':
      return a.cards.length <= boardCount(t)
    default:
      return false
  }
}

/** `actions` with `tail` put back after them for as long as each tail action still fits; the rest are dropped. */
export function reattach(base, actions, tail) {
  let t = replay(base, actions)
  const out = [...actions]
  for (const a of tail) {
    if (!isValid(t, a)) break
    t = apply(t, a)
    out.push(a)
  }
  return out
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
  for (const s of t.seats) status[s] = { ...status[s], bet: 0, last: status[s].folded ? 'Fold' : null }
  const pot = potNow(t)
  if (t.street === 'river') return { ...t, status, pot, street: 'over', endStreet: 'river', showdown: true, highest: 0 }
  const street = STREETS[STREETS.indexOf(t.street) + 1]
  return { ...t, status, pot, street, queue: orderFrom(t.seats, t.dealerSeat).filter((s) => !status[s].folded), highest: 0, raises: 0 }
}

export function apply(t, a) {
  const u = { ...t, actions: [...t.actions, a] }
  switch (a.type) {
    case 'dealer':
      return deal(u, a.seat)
    case 'straddle': {
      const seat = toAct(u)
      const v = withStatus(u, seat, { bet: u.straddleSize, last: `Str ${u.straddleSize}` })
      return { ...v, straddler: seat, highest: u.straddleSize, queue: orderFrom(u.seats, seat).filter((s) => !v.status[s].folded) }
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
      return settle({ ...w, highest: a.amount, raises: v.raises + 1, queue: orderFrom(w.seats, a.seat).filter((s) => s !== a.seat && !w.status[s].folded) })
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
    case 'cards-who':
      return { ...u, pendingSeat: a.seat }
    case 'cards':
      return { ...u, shownHands: { ...u.shownHands, [u.pendingSeat]: a.cards }, pendingSeat: null }
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
      case 'board':
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
        if (a.type === 'call') calls += calledBy([a.seat])
        if (a.type === 'rest-call') calls += calledBy(before.queue)
        if (a.type === 'next-street') calls += calledBy(before.queue.filter((x) => toCall(before, x) === 0)) // the rest check or fold
        if (a.type === 'raise') {
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
    }
  }
  return out
}

// ---- text --------------------------------------------------------------------------------------

/** Label and text for one action, given the table before it. */
export function describeAction(before, a) {
  const name = (s) => before.players[s] ?? `#${s}`
  const label = before.street && before.street !== 'over' ? cap(before.street) : ''
  const skipped = a.seat != null ? before.queue.slice(0, before.queue.indexOf(a.seat)) : []
  const lead = skipped.length ? `${skipped.map(name).join(', ')} ${before.highest > (before.status[skipped[0]]?.bet ?? 0) ? 'fold' : 'check'} · ` : ''
  switch (a.type) {
    case 'dealer':
      return { label: 'Dealer', text: name(a.seat) }
    case 'straddle':
      return { label, text: `${name(toAct(before))} straddles ${before.straddleSize}` }
    case 'fold':
      return { label, text: `${lead}${name(a.seat)} folds` }
    case 'call':
      return { label, text: `${lead}${name(a.seat)} ${toCall(before, a.seat) > 0 ? `calls ${before.highest}` : 'checks'}` }
    case 'raise':
      return { label, text: `${lead}${name(a.seat)} ${before.highest === 0 ? 'bets' : 'raises to'} ${a.amount}` }
    case 'rest-fold': {
      const after = apply(before, a)
      const folded = before.queue.filter((s) => after.status[s].folded && !before.status[s].folded)
      return { label, text: `${folded.map(name).join(', ')} fold` }
    }
    case 'next-street': {
      const after = apply(before, a)
      const folded = before.queue.filter((s) => after.status[s].folded)
      const checked = before.queue.filter((s) => toCall(before, s) === 0)
      const parts = [checked.length && `${checked.map(name).join(', ')} check`, folded.length && `${folded.map(name).join(', ')} fold`].filter(Boolean)
      return { label, text: parts.join(' · ') || 'Nobody left to act' }
    }
    case 'rest-call':
      return { label, text: `${before.queue.map(name).join(', ')} ${before.queue.some((s) => toCall(before, s) > 0) ? 'call' : 'check'}` }
    case 'end':
      return { label: 'Ended', text: cap(before.street) }
    case 'cards-who':
      return { label: 'Shown', text: `${name(a.seat)} · …` }
    case 'cards':
      return { label: 'Shown', text: `${name(before.pendingSeat)} · ${handLabel(a.cards)}` }
    case 'board':
      return { label: 'Board', text: a.cards.length ? a.cards.map(cardLabel).join(' ') : 'Cleared' }
    default:
      return { label, text: a.type }
  }
}

/** One row per action for the log, with the state before each (so the rows read like the hand). Each row covers
 *  `actions[start, end)`: a hand shown is one row for the player and their cards. */
export function log(base, actions) {
  const rows = []
  let t = base
  actions.forEach((a, i) => {
    rows.push({ ...describeAction(t, a), start: i, end: i + 1 })
    t = apply(t, a)
  })
  return rows.filter((r, i) => {
    if (actions[i].type === 'cards' && actions[i - 1]?.type === 'cards-who') rows[i].start = i - 1
    return !(actions[i].type === 'cards-who' && actions[i + 1]?.type === 'cards')
  })
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
    case 'raise': {
      const skipped = before.queue.slice(0, before.queue.indexOf(a.seat))
      const out = skipped.map((s) => ({ seat: s, kind: toCall(before, s) > 0 ? 'fold' : 'check' }))
      const v = advanceTo(before, a.seat)
      if (live(v).length === 1) return out // everyone before them folded: they never act
      if (a.type === 'fold') out.push({ seat: a.seat, kind: 'fold' })
      else if (a.type === 'call') out.push(toCall(v, a.seat) > 0 ? { seat: a.seat, kind: 'call', amount: v.highest } : { seat: a.seat, kind: 'check' })
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

const join = (names) => names.join(', ')

/**
 * The hand street by street, naming who did what: [{ label, text }], e.g. Preflop "Tal raises to 25, Shay, Dani call",
 * Flop "A♥ K♦ 7♣ · Tal bets 35, Shay calls" (with the board when it was picked), Turn "Checked through", Result "Tal wins 120", Shown "Tal AKs · Shay QQ".
 * Folds and checks are left out (a street with no bet reads "Checked through").
 */
export function streetLines(base, actions) {
  const lines = []
  let t = base
  let cur = null // { street, parts: [{ kind, names } | string], raised }
  const flush = () => {
    if (!cur) return
    const text = cur.parts.map((p) => (typeof p === 'string' ? p : `${join(p.names)} ${p.names.length > 1 ? p.kind : `${p.kind}s`}`)).join(', ')
    if (text || cur.street !== 'preflop') lines.push({ label: cap(cur.street), text: text || 'Checked through' })
    cur = null
  }
  for (const a of actions) {
    const before = t
    t = apply(t, a)
    const street = before.street
    if (!street || street === 'over') continue
    const evs = seatEvents(before, a)
    if (!evs.length) continue
    if (cur?.street !== street) {
      flush()
      cur = { street, parts: [], raised: false }
    }
    const lastForced = before.straddler ?? bigBlindSeat(before.seats, before.dealerSeat)
    for (const e of evs) {
      const name = before.players[e.seat]
      const limp = street === 'preflop' && !cur.raised && (e.kind === 'call' || (e.kind === 'check' && e.seat !== lastForced))
      const kind = limp ? 'limp' : e.kind === 'call' ? 'call' : null
      if (kind) {
        const last = cur.parts[cur.parts.length - 1]
        if (last?.kind === kind) last.names.push(name)
        else cur.parts.push({ kind, names: [name] })
      } else if (e.kind === 'straddle') cur.parts.push(`${name} straddles ${e.amount}`)
      else if (e.kind === 'bet') cur.parts.push(`${name} bets ${e.amount}`)
      else if (e.kind === 'raise') cur.parts.push(`${name} raises to ${e.amount}`)
      if (e.kind === 'bet' || e.kind === 'raise') cur.raised = true
    }
  }
  flush()
  const boardOf = { Flop: t.board.slice(0, 3), Turn: t.board.slice(3, 4), River: t.board.slice(4, 5) }
  for (const l of lines) if (boardOf[l.label]?.length) l.text = `${boardOf[l.label].map(cardLabel).join(' ')} · ${l.text}`
  if (isOver(t) && !t.showdown && live(t).length === 1) lines.push({ label: 'Result', text: `${t.players[live(t)[0]]} wins ${potNow(t)}` })
  else if (isOver(t) && t.showdown) lines.push({ label: 'Result', text: `Showdown · pot ${potNow(t)}` })
  else if (isOver(t)) lines.push({ label: 'Result', text: t.endStreet === 'preflop' ? 'Ended preflop' : `Ended on the ${t.endStreet}` })
  const shown = Object.entries(t.shownHands)
  if (shown.length) lines.push({ label: 'Shown', text: shown.map(([s, c]) => `${t.players[s]} ${handLabel(c)}`).join(' · ') })
  return lines
}

/** The whole hand on one line, for lists: "Tal raises to 25, Shay calls · Flop: Tal bets 35 · Tal wins 120". */
export function summary(base, actions) {
  const lines = streetLines(base, actions)
  if (!lines.length) return 'Nothing recorded'
  return lines.map((l) => (l.label === 'Preflop' || l.label === 'Result' ? l.text : `${l.label}: ${l.text}`)).join(' · ')
}
