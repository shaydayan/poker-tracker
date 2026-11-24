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
/** The hand as the app keeps it (a question-model hand's base, from which the table is made). */
const hb = createHand(base)
/** A hand from older-style actions, as entries (the shape the app keeps). */
const entries = (...actions) => T.normalize(hb, [{ type: 'seats', out: [] }, { type: 'dealer', seat: 1 }, ...actions])
/** The log's rows as text: [street], "Name does (auto)", <mark>. */
const rowsText = (acts, b = hb) => T.logRows(T.fromHand(b), acts).map((r) => (r.kind === 'street' ? `[${r.street}${r.cards.length ? ` ${r.cards.join(' ')}` : ''}]` : r.kind === 'mark' ? `<${r.text}>` : `${players[r.seat]} ${r.text}${r.auto ? ' (auto)' : ''}`))

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
    const h = entries(...t.actions.slice(1))
    expect(rowsText(h.actions).slice(-6)).toEqual(['Dani folds (auto)', 'Omer folds (auto)', '<End Street>', '[flop]', 'Tal folds (auto)', '<End Street>'])
    expect(T.live(t)).toEqual([1])
  })
  it('acting for the last player standing just ends the hand', () => {
    const t = run(dealt(), { type: 'straddle' }, { type: 'fold', seat: 4 }) // the straddler is last to act: everyone before folds
    expect(t.street).toBe('over')
    expect(T.live(t)).toEqual([4])
    expect(currentStep(asHand(t).hand)).toBe('cards-who')
  })
})

describe('table: log rows', () => {
  it('reads like the hand: street headings, one row per turn, filled-in turns marked, End Street and End Hand where pressed', () => {
    const h = entries({ type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'rest-fold' }, { type: 'raise', seat: 1, amount: 40 }, { type: 'end' }, { type: 'cards-who', seat: 1 }, { type: 'cards', cards: ['Ah', 'Ks'] })
    expect(rowsText(h.actions)).toEqual([
      '[preflop]',
      'Roni folds (auto)',
      'Gil folds (auto)',
      'Tal raises to 25',
      'Shay calls 25',
      'Dani folds (auto)',
      'Omer folds (auto)',
      '<End Street>',
      '[flop]',
      'Tal checks (auto)',
      'Shay bets 40',
      '<Hand ended on the flop>',
    ])
    expect(h.base.shown).toEqual({ 1: ['Ah', 'Ks'] }) // cards are kept on the hand, not among the turns
  })
  it('keeps every turn an entry of its own, so each row is one entry', () => {
    const h = entries({ type: 'fold', seat: 4 }, { type: 'fold', seat: 6 }, { type: 'call', seat: 1 }, { type: 'call', seat: 2 })
    const rows = T.logRows(table(), h.actions).filter((r) => r.kind === 'turn')
    expect(rows.map((r) => r.index)).toEqual([2, 3, 4, 5, 6]) // Roni, Gil (auto), Tal, Shay, Dani
    expect(rows[1]).toMatchObject({ seat: 5, auto: true })
    expect(h.actions[3]).toMatchObject({ type: 'fold', seat: 5, auto: true, by: h.actions[4].id }) // filled in by Tal's fold
    expect(h.actions[6]).toMatchObject({ type: 'call', seat: 2, check: true }) // equal blinds: Dani owes nothing
  })
  it('gives every street reached a heading with its board cards, run-out streets too', () => {
    const b = { ...hb, board: ['Ah', 'Kd', '7c', '2s', '3h'] }
    const pre = T.normalize(b, [{ type: 'dealer', seat: 1 }, { type: 'raise', seat: 4, amount: 25 }]) // a board ahead of the hand, still preflop
    expect(rowsText(pre.actions, b).filter((x) => x.startsWith('['))).toEqual(['[preflop]'])
    const allin = T.normalize(b, [{ type: 'dealer', seat: 1 }, { type: 'allin', seat: 4, amount: 100 }, { type: 'call', seat: 1 }, { type: 'next-street' }])
    expect(rowsText(allin.actions, b).filter((x) => x.startsWith('['))).toEqual(['[preflop]', '[flop Ah Kd 7c]', '[turn 2s]', '[river 3h]'])
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
    expect(rowsText(entries(...flop.actions.slice(1)).actions).slice(-4)).toEqual(['Tal checks (auto)', 'Shay checks (auto)', '<End Street>', '[turn]'])
  })
  it('lets the big blind check a limped pot instead of folding it', () => {
    const t = run(dealt(), { type: 'call', seat: 4 }, { type: 'next-street' })
    expect(T.live(t)).toEqual([2, 3, 4]) // equal blinds: the small blind owes nothing either
    expect(rowsText(entries(...t.actions.slice(1)).actions).slice(-7)).toEqual(['Gil folds (auto)', 'Tal folds (auto)', 'Shay folds (auto)', 'Dani checks (auto)', 'Omer checks (auto)', '<End Street>', '[flop]'])
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
  it('names who bet and who called the last bet, street by street', () => {
    const t = run(dealt(), { type: 'call', seat: 4 }, { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'call', seat: 4 }, { type: 'raise', seat: 4, amount: 40 }, { type: 'call', seat: 6 }, { type: 'fold', seat: 1 }, { type: 'next-street' }, { type: 'raise', seat: 6, amount: 100 }, { type: 'fold', seat: 4 })
    expect(T.streetLines(table(), t.actions)).toEqual([
      { label: 'Dealer', text: 'Shay' },
      { label: 'Preflop', text: 'Tal raises 25, Shay, Roni call' },
      { label: 'Flop', text: 'Roni bets 40, Tal calls' },
      { label: 'Turn', text: 'Checked' },
      { label: 'River', text: 'Tal bets 100' },
      { label: 'Result', text: `Tal wins ${T.potNow(t)}` },
    ])
    expect(T.summary(table(), t.actions)).toBe(`Tal raises 25 · 3 to flop · Tal wins ${T.potNow(t)} on the river`)
  })
  it('counts three or more callers instead of naming them', () => {
    const t = run(dealt(), { type: 'raise', seat: 4, amount: 25 }, { type: 'rest-call' })
    expect(T.streetLines(table(), t.actions)[1]).toEqual({ label: 'Preflop', text: 'Roni raises 25, 5 call' })
  })
  it('counts limpers, the small blind too, and leaves out the folds', () => {
    const t = run(dealt(), { type: 'call', seat: 4 }, { type: 'call', seat: 6 }, { type: 'next-street' })
    expect(T.streetLines(table(), t.actions)[1]).toEqual({ label: 'Preflop', text: '3 limp' })
    expect(T.summary(table(), t.actions)).toBe('Limped · 4 to flop · flop, pot 20')
  })
  it('names the last raise preflop as a 3-bet, and a straddle when nobody raised', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'raise', seat: 1, amount: 75 }, { type: 'call', seat: 6 }, { type: 'end' })
    expect(T.streetLines(table(), t.actions)[1]).toEqual({ label: 'Preflop', text: 'Tal raises 25, Shay raises 75, Tal calls' })
    expect(T.summary(table(), t.actions)).toBe('Shay 3-bets 75 · 2 to flop · flop, pot 160')
    const s = run(dealt(), { type: 'straddle' }, { type: 'call', seat: 6 }, { type: 'next-street' })
    expect(T.streetLines(table(), s.actions)[1]).toEqual({ label: 'Preflop', text: 'Roni straddles 10, Tal calls' })
    expect(T.summary(table(), s.actions)).toBe('Straddle 10 · 2 to flop · flop, pot 30')
  })
  it('lists the cards shown at showdown', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'next-street' }, { type: 'next-street' }, { type: 'next-street' }, { type: 'show', seat: 6, cards: ['Ah', 'Kh'] }, { type: 'show', seat: 1, cards: ['Qs', 'Qc'] })
    expect(T.streetLines(table(), t.actions).slice(-2)).toEqual([{ label: 'Result', text: 'Showdown, pot 60' }, { label: 'Shown', text: 'Shay Q♠ Q♣ · Tal A♥ K♥' }])
    expect(T.summary(table(), t.actions)).toBe('Tal raises 25 · 2 to flop · showdown, pot 60 · Shay Q♠Q♣ vs Tal A♥K♥')
  })
})

describe('table: what each seat can be asked', () => {
  const kinds = (t, seat) => T.seatChoices(t, seat).map((o) => o.kind)
  it('asks everyone for the dealer first', () => {
    expect(kinds(table(), 3)).toEqual(['dealer'])
  })
  it('offers the first player the straddle, and fold/call/raise/all-in to anyone still to act', () => {
    const t = dealt()
    expect(kinds(t, 4)).toEqual(['fold', 'call', 'raise', 'straddle', 'allin'])
    expect(kinds(t, 6)).toEqual(['fold', 'call', 'raise', 'allin'])
    expect(T.seatChoices(t, 6)[1]).toEqual({ kind: 'call', amount: 5 })
  })
  it('offers check and bet when nothing is owed, and nothing to a seat that acted or folded', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'fold', seat: 2 }, { type: 'call', seat: 3 })
    expect(t.street).toBe('flop')
    expect(kinds(t, 3)).toEqual(['check', 'bet', 'allin'])
    expect(kinds(t, 2)).toEqual([])
    const u = T.apply(t, { type: 'raise', seat: 3, amount: 40 })
    expect(kinds(u, 3)).toEqual([])
    expect(kinds(u, 6)).toEqual(['fold', 'call', 'raise', 'allin'])
  })
  it('offers nothing once the hand is over', () => {
    const t = run(dealt(), { type: 'end' })
    expect(kinds(t, 4)).toEqual([])
  })
})

describe('table: hand facts', () => {
  it('knows who put chips in, who raised, who showed, the raises preflop and the pot', () => {
    const t = run(dealt(), { type: 'call', seat: 4 }, { type: 'raise', seat: 6, amount: 25 }, { type: 'raise', seat: 1, amount: 75 }, { type: 'call', seat: 6 }, { type: 'end' }, { type: 'show', seat: 6, cards: ['Ah', 'Kh'] })
    const f = T.handFacts(table(), t.actions)
    expect([...f.inHand].sort()).toEqual([1, 4, 6]) // Roni limped, then folded to the 3-bet
    expect([...f.raised].sort()).toEqual([1, 6])
    expect([...f.showed]).toEqual([6])
    expect(f.preflopRaises).toBe(2)
    expect(f.pot).toBe(T.potNow(t))
    expect(f.dealer).toBe(1)
  })
})

describe('table: board cards', () => {
  it('keeps the latest board, logs it, and leaves the betting and answers alone', () => {
    const plain = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'raise', seat: 6, amount: 35 })
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'board', cards: ['Ah', 'Kd'] }, { type: 'board', cards: ['Ah', 'Kd', '7c'] }, { type: 'raise', seat: 6, amount: 35 })
    expect(t.board).toEqual(['Ah', 'Kd', '7c'])
    expect(T.toAct(t)).toBe(T.toAct(plain))
    expect(T.toAnswers(table(), t.actions)).toEqual(T.toAnswers(table(), plain.actions))
    const h = entries(...t.actions.slice(1))
    expect(h.base.board).toEqual(['Ah', 'Kd', '7c'])
    expect(h.actions.some((a) => a.type === 'board')).toBe(false)
    expect(rowsText(h.actions, h.base)).toContain('[flop Ah Kd 7c]')
    expect(T.streetLines(T.fromHand(h.base), h.actions)[2]).toEqual({ label: 'Flop', text: 'A♥ K♦ 7♣ · Tal bets 35' })
    expect(T.toAnswers(T.fromHand(h.base), h.actions)).toEqual(T.toAnswers(table(), plain.actions))
  })
})

describe('table: edits', () => {
  // Roni folds, Gil raises 25 (Tal, skipped, folds), Shay calls, End Street (Dani and Omer fold), Gil bets 40 on the flop.
  const hand = () => entries({ type: 'fold', seat: 4 }, { type: 'raise', seat: 5, amount: 25 }, { type: 'call', seat: 1 }, { type: 'next-street' }, { type: 'raise', seat: 5, amount: 40 })
  const at = (h, seat, street = 'preflop') => h.actions.findIndex((a) => a.seat === seat && a.street === street)
  it('changes one turn and keeps everything after it that still fits', () => {
    const h = hand()
    const r = T.changeTurn(table(), h.actions, at(h, 6), { kind: 'call' }) // Tal called after all
    expect(r.removed).toBe(0)
    expect(rowsText(r.actions)).toContain('Tal calls 25')
    expect(rowsText(r.actions)).toContain('Gil bets 40')
    expect(T.replay(table(), r.actions).queue).toEqual([6, 1]) // the flop bet now faces Tal and Shay
  })
  it('takes out what no longer fits, and says how many', () => {
    const h = hand()
    const r = T.changeTurn(table(), h.actions, at(h, 1), { kind: 'raise', amount: 60 }) // Shay re-raises: Gil must act again
    expect(rowsText(r.actions).slice(-3)).toEqual(['Shay raises to 60', 'Dani folds (auto)', 'Omer folds (auto)'])
    expect(r.removed).toBe(2) // End Street (preflop is open again) and Gil's flop bet
    expect(T.toAct(T.replay(table(), r.actions))).toBe(5)
  })
  it('lets a filled-in turn follow the rule again, and never turns a check into a call', () => {
    const h = entries({ type: 'call', seat: 1 }, { type: 'next-street' }) // limped: Roni, Gil, Tal fold; Dani, Omer check
    const roni = at(h, 4)
    const r = T.changeTurn(table(), h.actions, roni, { kind: 'raise', amount: 25 })
    // Gil and Tal were filled-in folds: still folds. Shay's own call now faces a raise: a call stays a call. Dani's
    // filled-in check faces a bet: a fold now.
    expect(rowsText(r.actions).slice(1, 8)).toEqual(['Roni raises to 25', 'Gil folds (auto)', 'Tal folds (auto)', 'Shay calls 25', 'Dani folds (auto)', 'Omer folds (auto)', '<End Street>'])
    const checked = entries({ type: 'call', seat: 4 }, { type: 'call', seat: 5 }, { type: 'call', seat: 6 }, { type: 'call', seat: 1 }, { type: 'call', seat: 2 }, { type: 'call', seat: 3 }, { type: 'call', seat: 2 })
    const flop = checked.actions.findIndex((a) => a.street === 'flop')
    const raised = T.changeTurn(table(), checked.actions, flop, { kind: 'bet', amount: 10 }) // Dani bets instead of checking
    expect(raised.actions.length).toBe(flop + 1) // nobody else had acted on the flop
    // Omer (the big blind) raises instead of checking: the limpers must act again, so the flop turns are taken out.
    const omer = T.changeTurn(table(), checked.actions, at(checked, 3), { kind: 'raise', amount: 20 })
    expect(omer.removed).toBe(1)
    expect(T.toAct(T.replay(table(), omer.actions))).toBe(4)
  })
  it('reopens End Street with the turns it filled in', () => {
    const h = hand()
    const end = h.actions.findIndex((a) => a.type === 'street-end')
    expect(T.filledBy(h.actions, end)).toBe(2)
    const r = T.reopen(table(), h.actions, end)
    expect(rowsText(r.actions).slice(-1)).toEqual(['Shay calls 25'])
    expect(T.replay(table(), r.actions).queue).toEqual([2, 3]) // Dani and Omer are to act again
    expect(r.removed).toBe(1) // Gil's flop bet
  })
  it('continues a hand ended with End Hand, cards shown or not', () => {
    const h = entries({ type: 'raise', seat: 4, amount: 25 }, { type: 'end' }, { type: 'show', seat: 4, cards: ['Ah', 'Ad'] })
    const r = T.reopen(table(), h.actions, h.actions.findIndex((a) => a.type === 'end'))
    expect(T.isOver(T.replay(T.fromHand(h.base), r.actions))).toBe(false)
    expect(T.replay(T.fromHand(h.base), r.actions).shownHands).toEqual({ 4: ['Ah', 'Ad'] })
  })
  it('changes the dealer or who sits out, checking every turn again', () => {
    const h = hand()
    const moved = T.withDealer(table(), h.actions, 2) // the button one seat on: everyone acts in another order
    expect(T.replay(table(), moved.actions).dealerSeat).toBe(2)
    expect(moved.removed).toBeGreaterThan(0)
    const out = T.withSeatsOut(table(), h.actions, [3]) // Omer sat out: his filled-in fold goes
    expect(T.replay(table(), out.actions).out).toEqual([3])
    expect(rowsText(out.actions)).not.toContain('Omer folds (auto)')
  })
  it('turns an older hand into entries, and a hand already in that shape comes back the same', () => {
    const h = hand()
    expect(T.normalize(h.base, h.actions)).toEqual(h)
    expect(h.actions.every((a) => ['seats', 'dealer'].includes(a.type) || a.id > 0)).toBe(true)
  })
  it('refuses actions that no longer fit', () => {
    const t = run(dealt(), { type: 'raise', seat: 6, amount: 25 })
    expect(T.isValid(t, { type: 'fold', seat: 5 })).toBe(false) // already folded on the way to Tal
    expect(T.isValid(t, { type: 'raise', seat: 1, amount: 20 })).toBe(false) // below the bet
    expect(T.isValid(t, { type: 'dealer', seat: 2 })).toBe(false)
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
    expect(T.replay(table(), acts).out).toEqual([3])
    expect(T.streetLines(table(), acts).map((l) => l.label)).not.toContain('Sitting Out') // not part of the action
    expect(T.summary(table(), acts)).not.toMatch(/Omer/)
  })
  it('only takes a sit-out before the dealer, and keeps at least two players', () => {
    expect(T.isValid(table(), { type: 'seats', out: [2] })).toBe(true)
    expect(T.isValid(table(), { type: 'seats', out: [2, 3, 4, 5, 6] })).toBe(false)
    expect(T.isValid(dealt(), { type: 'seats', out: [2] })).toBe(false)
  })
  it('drops later actions by a player who now sits out', () => {
    const h = T.normalize(hb, [{ type: 'seats', out: [] }, { type: 'dealer', seat: 1 }, { type: 'raise', seat: 3, amount: 25 }]) // Omer (BB) can't raise first: Roni...Dani fill in
    const r = T.withSeatsOut(table(), h.actions, [3])
    expect(r.actions.some((a) => a.seat === 3)).toBe(false)
  })
})

describe('table: cards shown at any point', () => {
  it('takes one or two cards mid-hand, carries on betting, and gives two-card hands to the stats model at the end', () => {
    const mid = run(dealt(), { type: 'show', seat: 1, cards: ['Ah', 'Kd'] }, { type: 'show', seat: 6, cards: ['Qs'] })
    expect(mid.shownHands).toEqual({ 1: ['Ah', 'Kd'], 6: ['Qs'] })
    expect(T.toAct(mid)).toBe(4) // betting goes on
    expect(asHand(mid).hand.shownHands).toEqual({}) // not given before the hand is over
    const done = run(mid, { type: 'raise', seat: 6, amount: 25 }, { type: 'end' })
    expect(asHand(done).hand.shownHands).toEqual({ 1: 'AKo' }) // a single card stays in the actions only
    expect(entries(...done.actions.slice(1)).base.shown).toEqual({ 1: ['Ah', 'Kd'], 6: ['Qs'] })
  })
  it('refuses a card already on the table, but not the seat\'s own, and needs the dealer first', () => {
    expect(T.isValid(table(), { type: 'show', seat: 1, cards: ['Ah'] })).toBe(false)
    const t = run(dealt(), { type: 'show', seat: 1, cards: ['Ah', 'Kd'] })
    expect(T.isValid(t, { type: 'show', seat: 2, cards: ['Ah'] })).toBe(false)
    expect(T.isValid(t, { type: 'show', seat: 1, cards: ['Ah', 'Kc'] })).toBe(true)
    expect(T.isValid(t, { type: 'show', seat: 2, cards: [] })).toBe(false)
    expect(T.usedCards(t, 1)).toEqual([])
  })
})

describe('table: all-in', () => {
  const raise = (seat, amount) => ({ type: 'raise', seat, amount })
  const allin = (seat, amount) => ({ type: 'allin', seat, amount })
  const fold = (seat) => ({ type: 'fold', seat })
  it('calls for less: the bet stays, they are never asked again, and with one bettor left the board runs out', () => {
    const t = run(dealt(), raise(4, 25), allin(5, 15))
    expect(t.highest).toBe(25)
    expect(t.status[5]).toMatchObject({ allIn: true, bet: 15 })
    expect(T.toAct(t)).toBe(6)
    const done = run(t, fold(6), fold(1), fold(2), fold(3))
    expect(done).toMatchObject({ street: 'over', showdown: true, endStreet: 'river' })
    expect(T.boardCount(done)).toBe(5)
    expect(currentStep(asHand(done).hand)).toBe('cards-who') // the stats model sees a finished hand
    expect(rowsText(entries(...done.actions.slice(1)).actions)).toContain('Gil all-in 15')
  })
  it('raises any amount above the bet; the others act again, and an all-in player is skipped later', () => {
    const t = run(dealt(), raise(4, 25), allin(5, 40))
    expect(t.highest).toBe(40)
    expect(t.queue).toEqual([6, 1, 2, 3, 4])
    const flop = run(t, { type: 'call', seat: 6 }, fold(1), fold(2), fold(3), { type: 'call', seat: 4 })
    expect(flop.street).toBe('flop')
    expect(flop.queue).toEqual([4, 6])
    expect(T.seatStatus(flop)[5]).toBe('All-In')
    const h = asHand(run(flop, { type: 'next-street' }, { type: 'next-street' }, { type: 'next-street' }))
    expect(h.hand.preflop.map((r) => r.amount)).toEqual([25, 40, null]) // then the closing round
    expect(currentStep(h.hand)).toBe('cards-who')
  })
  it('refuses an all-in that puts nothing more in', () => {
    const t = run(dealt(), raise(4, 25))
    expect(T.isValid(t, allin(3, 5))).toBe(false) // the big blind already has 5 in
    expect(T.isValid(t, allin(3, 10))).toBe(true)
  })
})
