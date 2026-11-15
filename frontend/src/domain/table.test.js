import { describe, it, expect } from 'vitest'
import * as T from './table.js'
import { createHand, currentStep, replay as replayHand, describe as summary } from './hand.js'

const players = { 1: 'Shay', 2: 'Dani', 3: 'Omer', 4: 'Roni', 5: 'Gil', 6: 'Tal' }
const settings = { smallBlind: 5, bigBlind: 5, straddle: 10, openRaise: 25, straddleOpenRaise: 45, threeBet: 3, fourBet: 2, postflopRaise: 2 }
const base = { handNo: 1, seats: [1, 2, 3, 4, 5, 6], players, suggestedDealer: 1, heroSeat: 1, settings }
const table = () => T.createTable(base)
/** Dealer Shay: SB Dani, BB Omer, UTG Roni, HJ Gil, CO Tal. */
const dealt = () => T.apply(table(), { type: 'dealer', seat: 1 })
const run = (t, ...actions) => actions.reduce(T.apply, t)
const asHand = (t) => replayHand(createHand(base), T.toAnswers(table(), t.actions))

describe('table: turn order', () => {
  it('starts after the big blind, with a straddle on offer for the first player only', () => {
    const t = dealt()
    expect(T.toAct(t)).toBe(4)
    expect(t.queue).toEqual([4, 5, 6, 1, 2, 3])
    expect(T.seatStatus(t)).toEqual({ 2: 'SB', 3: 'BB' })
    expect(T.canStraddle(t)).toBe(true)
    const s = T.apply(t, { type: 'straddle' })
    expect(s.straddler).toBe(4)
    expect(s.highest).toBe(10)
    expect(s.queue).toEqual([5, 6, 1, 2, 3, 4])
    expect(T.canStraddle(s)).toBe(false)
    expect(T.canStraddle(T.apply(t, { type: 'fold', seat: 4 }))).toBe(false)
  })
  it('acting for a later seat folds the ones before it when a bet is faced', () => {
    const t = T.apply(dealt(), { type: 'raise', seat: 6, amount: 25 })
    expect(T.seatStatus(t)).toEqual({ 2: 'SB', 3: 'BB', 4: 'Fold', 5: 'Fold', 6: 'Raise 25' })
    expect(t.queue).toEqual([1, 2, 3])
    expect(T.toCall(t, 2)).toBe(20)
    expect(T.amountRange(t)).toEqual({ min: 50, def: 75, max: 1000 })
  })
  it('moves to the flop once everyone has acted, carrying the pot', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'fold', seat: 2 }, { type: 'call', seat: 3 })
    expect(t.street).toBe('flop')
    expect(t.pot).toBe(80)
    expect(t.queue).toEqual([3, 6, 1])
    expect(T.seatStatus(t)).toEqual({ 2: 'Fold', 4: 'Fold', 5: 'Fold' })
    expect(T.amountRange(t)).toEqual({ min: 5, def: 40, max: 1000 })
  })
  it('acting for a later seat checks the ones before it when nothing is faced', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'fold', seat: 2 }, { type: 'call', seat: 3 }, { type: 'raise', seat: 1, amount: 40 })
    expect(T.seatStatus(t)).toEqual({ 2: 'Fold', 3: 'Check', 4: 'Fold', 5: 'Fold', 6: 'Check', 1: 'Bet 40' })
    expect(t.queue).toEqual([3, 6])
  })
  it('ends the hand when one player is left, or by hand, then takes cards', () => {
    const walk = T.apply(dealt(), { type: 'rest-fold' })
    expect(walk.street).toBe('over')
    expect(walk.ended).toBe(true)
    expect(T.inCardsPhase(walk)).toBe(true)
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'end' }, { type: 'cards-who', seat: 6 }, { type: 'cards', cards: 'QQ' })
    expect(t.shownHands).toEqual({ 6: 'QQ' })
    expect(T.seatStatus(t)[6]).toBe('Raise 25') // the cards are shown beside the seat, not in place of its action
  })
  it('reaches showdown after the river', () => {
    let t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' })
    expect(t.street).toBe('flop')
    for (let i = 0; i < 3; i++) t = T.apply(t, { type: 'rest-call' })
    expect(t.street).toBe('over')
    expect(t.showdown).toBe(true)
    expect(t.ended).toBe(false)
  })
})

describe('table: as a question-flow hand', () => {
  it('turns raises, calls and folds into rounds with the callers before each raise', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'fold', seat: 2 }, { type: 'call', seat: 3 })
    expect(T.toAnswers(table(), t.actions)).toEqual([
      { step: 'dealer', value: 1 }, { step: 'straddle', value: false },
      { step: 'raise', value: 6 }, { step: 'amount', value: 25 }, { step: 'callers', value: 0 },
      { step: 'raise', value: null }, { step: 'callers', value: 2 },
    ])
    const h = asHand(t)
    expect(h.applied).toHaveLength(7)
    expect(currentStep(h.hand)).toBe('flop-bet')
  })
  it('keeps the two models in step through a street with a bet and a raise', () => {
    const t = run(dealt(),
      { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'fold', seat: 2 }, { type: 'call', seat: 3 },
      { type: 'raise', seat: 3, amount: 40 }, { type: 'fold', seat: 6 }, { type: 'raise', seat: 1, amount: 100 }, { type: 'call', seat: 3 })
    expect(t.street).toBe('turn')
    const h = asHand(t)
    expect(h.applied).toHaveLength(14)
    expect(currentStep(h.hand)).toBe('turn-bet')
    expect(summary(h.hand)).toBe('no straddle · Tal 25 · 2 calls · flop: donk Omer 40 · Shay 100 · 1 call')
  })
  it('keeps them in step for a straddle, a walk, an ended hand and a checked street', () => {
    const straddled = run(dealt(), { type: 'straddle' }, { type: 'raise', seat: 2, amount: 45 }, { type: 'rest-fold' })
    expect(T.toAnswers(table(), straddled.actions)).toEqual([
      { step: 'dealer', value: 1 }, { step: 'straddle', value: true },
      { step: 'raise', value: 2 }, { step: 'amount', value: 45 }, { step: 'callers', value: 0 },
      { step: 'raise', value: null }, { step: 'callers', value: 0 },
    ])
    expect(currentStep(asHand(straddled).hand)).toBe('cards-who')
    const walk = T.apply(dealt(), { type: 'rest-fold' })
    expect(currentStep(asHand(walk).hand)).toBe('cards-who')
    const ended = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'end' }, { type: 'cards-who', seat: 6 }, { type: 'cards', cards: 'QQ' })
    const eh = asHand(ended)
    expect(eh.applied).toHaveLength(8)
    expect(eh.hand.ended).toBe('raise')
    expect(eh.hand.shownHands).toEqual({ 6: 'QQ' })
    const checked = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'rest-call' })
    expect(checked.street).toBe('turn')
    expect(currentStep(asHand(checked).hand)).toBe('turn-bet')
  })
})

describe('table: edge cases the question flow cannot say directly', () => {
  it('a fold with nothing to call ends the hand early rather than closing the street', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'fold', seat: 6 })
    expect(t.street).toBe('over')
    const h = asHand(t)
    expect(h.applied).toHaveLength(T.toAnswers(table(), t.actions).length)
    expect(h.hand.ended).toBe('flop-bet')
    expect(currentStep(h.hand)).toBe('cards-who')
  })
  it('a small-blind check with equal blinds is a limp, so the pot is not a walk', () => {
    const t = run(dealt(), { type: 'rest-fold' }) // rest-fold keeps the last one standing
    expect(t.street).toBe('over')
    const limped = run(dealt(), { type: 'call', seat: 2 }, { type: 'call', seat: 3 }) // Roni, Gil, Tal, Shay fold; Dani checks (limps); Omer checks
    expect(limped.street).toBe('flop')
    expect(T.toAnswers(table(), limped.actions).slice(-2)).toEqual([{ step: 'raise', value: null }, { step: 'callers', value: 1 }])
    expect(currentStep(asHand(limped).hand)).toBe('flop-bet')
  })
  it('names only the players who actually folded on Rest Fold', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'rest-fold' })
    expect(T.log(table(), t.actions).map((r) => r.text).slice(-2)).toEqual(['Dani, Omer fold', 'Tal folds'])
    expect(T.live(t)).toEqual([1])
  })
  it('acting for the last player standing just ends the hand', () => {
    const t = run(dealt(), { type: 'straddle' }, { type: 'fold', seat: 4 }) // the straddler is last to act: everyone before folds
    expect(t.street).toBe('over')
    expect(T.live(t)).toEqual([4])
    expect(currentStep(asHand(t).hand)).toBe('cards-who')
  })
})

describe('table: log', () => {
  it('reads like the hand', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'raise', seat: 1, amount: 40 }, { type: 'end' }, { type: 'cards-who', seat: 1 }, { type: 'cards', cards: ['Ah', 'Ks'] })
    expect(T.log(table(), t.actions).map((r) => `${r.label}: ${r.text}`)).toEqual([
      'Dealer: Shay',
      'Preflop: Roni, Gil fold',
      'Preflop: Tal raises to 25',
      'Preflop: Shay calls 25',
      'Preflop: Dani, Omer fold',
      'Flop: Tal checks',
      'Flop: Shay bets 40',
      'Ended: Flop',
      'Shown: Shay · A♥ K♠',
    ])
  })
  it('merges players who did the same thing in a row, however they were entered', () => {
    // Roni folds, then Tal is tapped (Gil folds on the way) and folds too: one row for all three.
    const t = run(dealt(), { type: 'fold', seat: 4 }, { type: 'fold', seat: 6 }, { type: 'call', seat: 1 }, { type: 'call', seat: 2 })
    const rows = T.log(table(), t.actions)
    expect(rows.map((r) => r.text)).toEqual(['Shay', 'Roni, Gil, Tal fold', 'Shay calls 5', 'Dani checks']) // equal blinds: Dani owes nothing
    expect(rows.map((r) => [r.start, r.end])).toEqual([[0, 1], [1, 3], [3, 4], [4, 5]])
    const called = run(dealt(), { type: 'raise', seat: 4, amount: 25 }, { type: 'call', seat: 5 }, { type: 'call', seat: 6 })
    expect(T.log(table(), called.actions).at(-1)).toMatchObject({ text: 'Gil, Tal call 25', start: 2, end: 4 })
  })
  it('shows one board row per street with the cards in effect, first among that street\'s rows', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'raise', seat: 6, amount: 35 }, { type: 'board', cards: ['Ah', 'Kd'] }, { type: 'board', cards: ['Ah', 'Kd', '7c'] })
    const rows = T.log(table(), t.actions)
    expect(rows.filter((r) => r.board)).toHaveLength(1)
    const flop = rows.findIndex((r) => r.board)
    expect(rows[flop]).toMatchObject({ label: 'Flop', text: 'A♥ K♦ 7♣', start: 6, end: 7 })
    expect(rows[flop + 1]).toMatchObject({ label: 'Flop', text: 'Tal bets 35' })
  })
})

describe('table: next street and board', () => {
  it('checks whoever can check and folds whoever faces a bet, then deals the next street', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' })
    expect(t.street).toBe('flop')
    expect(T.live(t)).toEqual([1, 6])
    expect(T.boardCount(t)).toBe(3)
    const flop = run(t, { type: 'next-street' }) // nobody bet: both check
    expect(flop.street).toBe('turn')
    expect(T.boardCount(flop)).toBe(4)
    expect(T.log(table(), flop.actions).at(-1)).toMatchObject({ label: 'Flop', text: 'Tal, Shay check' })
  })
  it('lets the big blind check a limped pot instead of folding it', () => {
    const t = run(dealt(), { type: 'call', seat: 4 }, { type: 'next-street' })
    expect(T.live(t)).toEqual([2, 3, 4]) // equal blinds: the small blind owes nothing either
    expect(T.log(table(), t.actions).slice(-2).map((r) => r.text)).toEqual(['Gil, Tal, Shay fold', 'Dani, Omer check'])
  })
  it('gives the pot to the bettor when everyone else faces the bet', () => {
    const t = run(dealt(), { type: 'raise', seat: 4, amount: 25 }, { type: 'next-street' })
    expect(T.isOver(t)).toBe(true)
    expect(T.live(t)).toEqual([4])
    expect(T.boardCount(t)).toBe(0)
  })
  it('keeps the board the hand ended on', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'next-street' }, { type: 'next-street' }, { type: 'next-street' })
    expect(t.showdown).toBe(true)
    expect(T.boardCount(t)).toBe(5)
    expect(T.streetNow(t)).toBe('river')
  })
  it('maps next-street onto the question model like the separate actions', () => {
    const a = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'next-street' })
    const b = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'rest-call' })
    expect(T.toAnswers(table(), a.actions)).toEqual(T.toAnswers(table(), b.actions))
    expect(currentStep(asHand(a).hand)).toBe(currentStep(asHand(b).hand))
  })
})

describe('table: history lines', () => {
  it('names who called, street by street', () => {
    const t = run(dealt(), { type: 'call', seat: 4 }, { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'call', seat: 4 }, { type: 'raise', seat: 4, amount: 40 }, { type: 'call', seat: 6 }, { type: 'fold', seat: 1 }, { type: 'next-street' }, { type: 'raise', seat: 6, amount: 100 }, { type: 'fold', seat: 4 })
    expect(T.streetLines(table(), t.actions)).toEqual([
      { label: 'Preflop', text: 'Roni limps, Tal raises to 25, Shay, Roni call' },
      { label: 'Flop', text: 'Roni bets 40, Tal calls' },
      { label: 'Turn', text: 'Checked through' },
      { label: 'River', text: 'Tal bets 100' },
      { label: 'Result', text: `Tal wins ${T.potNow(t)}` },
    ])
    expect(T.summary(table(), t.actions)).toBe(`Roni limps, Tal raises to 25, Shay, Roni call · Flop: Roni bets 40, Tal calls · Turn: Checked through · River: Tal bets 100 · Tal wins ${T.potNow(t)}`)
  })
  it('groups players who call in a row', () => {
    const t = run(dealt(), { type: 'raise', seat: 4, amount: 25 }, { type: 'rest-call' })
    expect(T.streetLines(table(), t.actions)[0]).toEqual({ label: 'Preflop', text: 'Roni raises to 25, Gil, Tal, Shay, Dani, Omer call' })
  })
  it('lists the cards shown at showdown', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'next-street' }, { type: 'next-street' }, { type: 'next-street' }, { type: 'cards-who', seat: 6 }, { type: 'cards', cards: ['Ah', 'Kh'] })
    expect(T.streetLines(table(), t.actions).slice(-2)).toEqual([{ label: 'Result', text: 'Showdown · pot 60' }, { label: 'Shown', text: 'Tal A♥ K♥' }])
  })
})

describe('table: board cards', () => {
  it('keeps the latest board, logs it, and leaves the betting and answers alone', () => {
    const plain = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'raise', seat: 6, amount: 35 })
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'board', cards: ['Ah', 'Kd'] }, { type: 'board', cards: ['Ah', 'Kd', '7c'] }, { type: 'raise', seat: 6, amount: 35 })
    expect(t.board).toEqual(['Ah', 'Kd', '7c'])
    expect(T.toAct(t)).toBe(T.toAct(plain))
    expect(T.toAnswers(table(), t.actions)).toEqual(T.toAnswers(table(), plain.actions))
    expect(T.log(table(), t.actions).filter((r) => r.board)).toMatchObject([{ label: 'Flop', text: 'A♥ K♦ 7♣' }])
    expect(T.streetLines(table(), t.actions)[1]).toEqual({ label: 'Flop', text: 'A♥ K♦ 7♣ · Tal bets 35' })
  })
})

describe('table: entering an action again', () => {
  it('gives each log row the actions it covers, a hand shown as one row', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'rest-fold' }, { type: 'cards-who', seat: 6 }, { type: 'cards', cards: 'AA' })
    expect(T.log(table(), t.actions).map((r) => [r.text, r.start, r.end])).toEqual([['Shay', 0, 1], ['Roni, Gil fold', 1, 2], ['Tal raises to 25', 1, 2], ['Shay, Dani, Omer fold', 2, 3], ['Tal · AA', 3, 5]])
  })
  it('puts back the later actions while they still fit and drops the rest', () => {
    const tail = [{ type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'raise', seat: 6, amount: 40 }]
    // Tal raised to 25 → now 30: Shay's call, the folds and Tal's flop bet all still fit.
    expect(T.reattach(dealt(), [{ type: 'raise', seat: 6, amount: 30 }], tail)).toHaveLength(4)
    // Roni raised instead: Shay can still call, but the folds end the hand, so Tal's flop bet is dropped.
    const kept = T.reattach(dealt(), [{ type: 'raise', seat: 4, amount: 25 }], tail)
    expect(kept.map((a) => a.type)).toEqual(['raise', 'call', 'rest-fold', 'raise'].slice(0, kept.length))
    expect(T.isValid(T.replay(dealt(), kept), tail[2])).toBe(false)
  })
  it('refuses actions that no longer fit', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 })
    expect(T.isValid(t, { type: 'fold', seat: 5 })).toBe(false) // already folded on the way to Tal
    expect(T.isValid(t, { type: 'raise', seat: 1, amount: 20 })).toBe(false) // below the bet
    expect(T.isValid(t, { type: 'dealer', seat: 2 })).toBe(false)
    expect(T.isValid(t, { type: 'board', cards: ['Ah', 'Kd', '7c'] })).toBe(false) // no flop yet
  })
})

describe('table: actions keep their street', () => {
  it('records the street each betting action was taken on', () => {
    const acts = T.withStreets(dealt(), [{ type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'raise', seat: 6, amount: 100 }, { type: 'board', cards: [] }])
    expect(acts.map((a) => a.street)).toEqual(['preflop', 'preflop', 'preflop', 'flop', undefined])
  })
  it('drops a later action rather than moving it to another street', () => {
    // Tal raises to 25, Shay calls, Dani and Omer fold; on the flop Tal bets 100.
    const acts = T.withStreets(dealt(), [{ type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'fold', seat: 2 }, { type: 'fold', seat: 3 }, { type: 'raise', seat: 6, amount: 100 }])
    expect(acts[4].street).toBe('flop')
    // Shay raises to 75 instead of calling: the folds still fit, but Tal's flop bet would now be a preflop re-raise.
    const edited = T.withStreets(T.replay(dealt(), acts.slice(0, 1)), [{ type: 'raise', seat: 1, amount: 75 }])
    const kept = T.reattach(dealt(), [acts[0], ...edited], acts.slice(2))
    expect(kept.map((a) => `${a.type} ${a.seat}`)).toEqual(['raise 6', 'raise 1', 'fold 2', 'fold 3'])
    const { street, ...bare } = acts[4] // without its street it would have slid onto preflop
    expect(T.isValid(T.replay(dealt(), kept), bare)).toBe(true)
    expect(T.isValid(T.replay(dealt(), kept), acts[4])).toBe(false)
  })
})

describe('table: exact shown cards', () => {
  it('keeps the exact cards, gives the stats model their notation, and knows which cards are used', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'board', cards: ['Jh', '7c', '2d'] }, { type: 'end' }, { type: 'cards-who', seat: 6 }, { type: 'cards', cards: ['Kd', 'Ah'] })
    expect(t.shownHands).toEqual({ 6: ['Kd', 'Ah'] })
    expect(asHand(t).hand.shownHands).toEqual({ 6: 'AKo' })
    expect(T.usedCards(t)).toEqual(['Jh', '7c', '2d', 'Kd', 'Ah'])
  })
})

describe('table: sitting out', () => {
  const out = (seats) => T.apply(table(), { type: 'seats', out: seats })
  it('plays the hand without the seats sitting out, and shows them as out', () => {
    const t = T.apply(out([3, 5]), { type: 'dealer', seat: 1 })
    expect(t.seats).toEqual([1, 2, 4, 6])
    expect(t.allSeats).toEqual([1, 2, 3, 4, 5, 6])
    expect(T.seatStatus(t)).toMatchObject({ 2: 'SB', 4: 'BB', 3: 'Out', 5: 'Out' })
    expect(T.toAct(t)).toBe(6)
  })
  it('lets me sit out and still records the hand', () => {
    const t = run(out([1]), { type: 'dealer', seat: 2 }, { type: 'rest-fold' })
    expect(t.seats).not.toContain(1)
    expect(T.isOver(t)).toBe(true)
  })
  it('logs and summarises who sat out', () => {
    const acts = [{ type: 'seats', out: [3] }, { type: 'dealer', seat: 1 }, { type: 'raise', seat: 6, amount: 25 }, { type: 'rest-fold' }]
    expect(T.log(table(), acts)[0]).toMatchObject({ label: 'Sitting Out', text: 'Omer', start: 0, end: 1 })
    expect(T.log(table(), [{ type: 'seats', out: [] }])[0].text).toBe('Nobody')
    expect(T.streetLines(table(), acts)[0]).toEqual({ label: 'Sitting Out', text: 'Omer' })
    expect(T.summary(table(), acts)).toMatch(/^Out: Omer · /)
  })
  it('only takes a sit-out before the dealer, and keeps at least two players', () => {
    expect(T.isValid(table(), { type: 'seats', out: [2] })).toBe(true)
    expect(T.isValid(table(), { type: 'seats', out: [2, 3, 4, 5, 6] })).toBe(false)
    expect(T.isValid(dealt(), { type: 'seats', out: [2] })).toBe(false)
  })
  it('drops later actions by a player who now sits out', () => {
    const acts = [{ type: 'dealer', seat: 1 }, { type: 'raise', seat: 3, amount: 25 }]
    const kept = T.reattach(table(), [{ type: 'seats', out: [3] }], acts)
    expect(kept.map((a) => a.type)).toEqual(['seats', 'dealer']) // Omer's raise no longer fits
  })
})
