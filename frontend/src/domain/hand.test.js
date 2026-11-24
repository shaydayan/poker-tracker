import { describe, it, expect } from 'vitest'
import { createHand, currentStep, answer, endHand, END, wentToShowdown, seatStatus, preflopAggressor, raiseCandidates, aggressorFor, potBefore, amountRange, replay, maxCallers, playersIn, callersRaiser, describe as summary } from './hand.js'
import { positionsFor } from './positions.js'
import { nearestOnLadder, raiseLadder } from './sizing.js'
import { withNextHand } from './session.js'

const players = { 1: 'Shay', 2: 'Dani', 3: 'Omer', 4: 'Roni', 5: 'Gil', 6: 'Tal' }
const settings = { smallBlind: 5, bigBlind: 5, straddle: 10, openRaise: 25, straddleOpenRaise: 45, threeBet: 3, fourBet: 2, postflopRaise: 2 }
const base = { handNo: 1, seats: [1, 2, 3, 4, 5, 6], players, suggestedDealer: 1, heroSeat: 1, settings }

/** Apply a list of answers in order. */
const play = (h, ...values) => values.reduce((acc, v) => answer(acc, v), h)
/** Dealer Shay: SB Dani, BB Omer, UTG Roni, HJ Gil, CO Tal. */
const dealt = () => answer(createHand(base), 1)

describe('positions', () => {
  it('labels six seats clockwise from the dealer', () => {
    expect(positionsFor([1, 2, 3, 4, 5, 6], 1)).toEqual({ 1: 'BTN', 2: 'SB', 3: 'BB', 4: 'UTG', 5: 'HJ', 6: 'CO' })
  })
  it('wraps around the table', () => {
    expect(positionsFor([1, 2, 3, 4], 3)).toEqual({ 3: 'BTN', 4: 'SB', 1: 'BB', 2: 'UTG' })
  })
  it('heads-up dealer is small blind', () => {
    expect(positionsFor([2, 5], 5)).toEqual({ 5: 'BTN', 2: 'BB' })
  })
})

describe('raise ladder', () => {
  it('starts at the minimum, then only round amounts, the steps growing 1, 2, 5, 10 big blinds', () => {
    const l = raiseLadder({ min: 25, max: 400, bigBlind: 5, tier: 4 })
    expect(l).toEqual([25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 125, 150, 175, 200, 250, 300, 350, 400])
    expect(l).toContain(100)
    expect(l).not.toContain(105)
  })
  it('starts from a minimum that is off the steps, and from 0', () => {
    expect(raiseLadder({ min: 12, max: 40, bigBlind: 5 }).slice(0, 3)).toEqual([12, 15, 20])
    expect(raiseLadder({ min: 0, max: 30, bigBlind: 5 })).toEqual([0, 5, 10, 15, 20, 25, 30])
  })
  it('snaps a suggested size to the nearest value', () => {
    expect(nearestOnLadder([25, 30, 35, 40, 50, 60], 47)).toBe(50)
  })
})

describe('hand questions', () => {
  it('asks for the dealer, straddle, then who raised, how much, and the callers before them', () => {
    let h = createHand(base)
    expect(currentStep(h)).toBe('dealer')
    h = answer(h, 3)
    expect(h.positions[1]).toBe('HJ')
    expect(currentStep(h)).toBe('straddle')
    h = answer(h, false)
    expect(currentStep(h)).toBe('raise')
    h = answer(h, 6)
    expect(currentStep(h)).toBe('amount')
    h = answer(h, 25)
    expect(currentStep(h)).toBe('callers')
    expect(callersRaiser(h)).toBe(6)
    h = answer(h, 1)
    expect(currentStep(h)).toBe('raise') // a 3-bet?
  })

  it('no raise asks who called the last raise, then moves to the flop', () => {
    let h = play(dealt(), false, 6, 25, 1, null)
    expect(currentStep(h)).toBe('callers')
    expect(callersRaiser(h)).toBeNull()
    expect(raiseCandidates(play(dealt(), false, 6, 25, 1))).toEqual([1, 2, 3, 4, 5]) // Tal cannot re-raise himself
    h = answer(h, 2)
    expect(currentStep(h)).toBe('flop-bet')
    expect(preflopAggressor(h)).toBe(6)
  })

  it('runs flop, turn and river with bets, raises and callers', () => {
    let h = play(dealt(), false, 6, 25, 1, null, 2)
    h = answer(h, { seat: 6 })
    expect(currentStep(h)).toBe('flop-bet-amount')
    h = answer(h, 35)
    expect(currentStep(h)).toBe('flop-raise')
    expect(raiseCandidates(h)).toEqual([1, 2, 3, 4, 5])
    h = play(h, 2, 70) // Dani raises to 70
    expect(currentStep(h)).toBe('flop-callers')
    h = play(h, 0, null, 1) // nobody called the bet before Dani, no re-raise, one caller of the raise
    expect(currentStep(h)).toBe('turn-bet')
    expect(aggressorFor(h, 'turn')).toBe(2)
    h = answer(h, { seat: null })
    expect(currentStep(h)).toBe('river-bet')
    h = answer(h, { seat: null })
    expect(currentStep(h)).toBe('cards-who')
    expect(wentToShowdown(h)).toBe(true)
    expect(summary(h)).toBe('no straddle · 1 call · Tal 25 · 2 calls · flop: c-bet 35 · Dani 70 · 1 call · turn: checked · river: checked · showdown')
  })

  it('skips to the cards when a raise or bet gets no callers', () => {
    expect(currentStep(play(dealt(), false, null, 0))).toBe('cards-who') // walk
    expect(currentStep(play(dealt(), false, 6, 25, 1, null, 0))).toBe('cards-who') // raise, everyone folds
    const flop = play(dealt(), false, 6, 25, 1, null, 1, { seat: 6 }, 35, null, 0)
    expect(currentStep(flop)).toBe('cards-who')
    expect(wentToShowdown(flop)).toBe(false)
  })

  it('can be ended by hand at any betting step, then takes shown cards', () => {
    let h = play(dealt(), false, 6)
    expect(currentStep(h)).toBe('amount')
    h = endHand(h)
    expect(currentStep(h)).toBe('cards-who')
    expect(h.ended).toBe('amount')
    h = play(h, 2, 'AKo')
    expect(h.shownHands).toEqual({ 2: 'AKo' })
    expect(summary(h)).toBe('no straddle · Tal ? · ended preflop · Dani AKo')
    expect(endHand(h)).toBe(h) // already over
  })

  it('collects shown hands per player at the end', () => {
    let h = play(dealt(), false, null, 2, { seat: null }, { seat: null }, { seat: null })
    expect(currentStep(h)).toBe('cards-who')
    h = answer(h, 6)
    expect(currentStep(h)).toBe('cards')
    h = answer(h, 'AKs')
    expect(currentStep(h)).toBe('cards-who')
    expect(h.shownHands).toEqual({ 6: 'AKs' })
  })
})

describe('callers bound', () => {
  // Dealer Shay(1): action preflop runs Roni(4), Gil(5), Tal(6), Shay(1), Dani(2, SB), Omer(3, BB).
  it('before an open raise, counts the seats that act before the raiser', () => {
    expect(maxCallers(play(dealt(), false, 4, 25))).toBe(0) // UTG opens
    expect(maxCallers(play(dealt(), false, 1, 25))).toBe(3) // button opens: UTG, HJ, CO could have limped
    expect(maxCallers(play(dealt(), false, 2, 25))).toBe(4) // small blind raises: not the big blind
    expect(maxCallers(play(dealt(), false, 3, 25))).toBe(5) // big blind raises after everyone limped
  })
  it('over a straddle the straddler acts last', () => {
    expect(maxCallers(play(dealt(), true, 5, 45))).toBe(0) // UTG+1 opens over the straddle
    expect(maxCallers(play(dealt(), true, 4, 45))).toBe(5) // straddler raises after everyone
  })
  it('before a re-raise, counts the seats between the previous raiser and the re-raiser', () => {
    expect(maxCallers(play(dealt(), false, 4, 25, 0, 2, 75))).toBe(3) // Roni opened, Dani 3-bets: Gil, Tal, Shay in between
    expect(maxCallers(play(dealt(), false, 6, 25, 0, 4, 75))).toBe(3) // Tal opened, Roni 3-bets: Shay, Dani, Omer in between
  })
  it('with no raise, everyone else may call', () => {
    expect(maxCallers(play(dealt(), false, null))).toBe(5) // limped: everyone but the big blind
    expect(maxCallers(play(dealt(), false, 4, 25, 0, null))).toBe(5) // everyone but the raiser
  })
  it('after the flop, action starts left of the dealer among the players still in', () => {
    const h = play(dealt(), false, 6, 25, 1, null, 2) // three to the flop: Tal and two callers
    expect(playersIn(h, 'flop')).toBe(3)
    expect(maxCallers(play(h, { seat: 6 }, 35, null))).toBe(2)
    expect(maxCallers(play(h, { seat: 6 }, 35, 2, 70))).toBe(1) // only Shay sits between Tal and Dani
    expect(maxCallers(play(h, { seat: 2 }, 35, 6, 70))).toBe(1) // Tal raises Dani's donk bet: Omer..Gil in between, but only one other player is in
    expect(playersIn(play(dealt(), false, null, 3), 'flop')).toBe(4) // three limpers and the big blind
  })
})

describe('table status', () => {
  it('marks blinds, straddle, raises, bets and shown cards', () => {
    expect(seatStatus(createHand(base))).toEqual({})
    expect(seatStatus(play(dealt(), true))).toEqual({ 2: 'SB', 3: 'BB', 4: 'Str 10' })
    const h = play(dealt(), false, 6, 25, 1, 2, 75, 0, null, 1, { seat: 2 }, 35, 6, 70, 0, null, 1)
    expect(seatStatus(h)).toEqual({ 2: 'Bet 35', 3: 'BB', 6: 'R 70' })
    expect(seatStatus(play(endHand(h), 6, 'AKs'))).toMatchObject({ 6: 'AKs' })
  })
})

describe('raise defaults', () => {
  it('opens for the setting, bigger over a straddle', () => {
    expect(amountRange(play(dealt(), false, 6))).toEqual({ min: 10, def: 25, max: 1000 })
    expect(amountRange(play(dealt(), true, 6))).toEqual({ min: 20, def: 45, max: 1000 })
  })
  it('3-bets 3x and 4-bets 2x', () => {
    const threeBet = play(dealt(), false, 6, 25, 0, 2)
    expect(amountRange(threeBet).def).toBe(75)
    expect(amountRange(threeBet).min).toBe(50)
    expect(amountRange(play(threeBet, 75, 0, 6)).def).toBe(150)
  })
  it('bets half the pot after the flop and raises 2x', () => {
    const h = play(dealt(), false, 6, 25, 2, null, 1) // 5 + 5 + 2x5 (limpers) + 25 + 25 = 70
    expect(potBefore(h, 'flop')).toBe(70)
    const bet = answer(h, { seat: 6 })
    expect(amountRange(bet).def).toBe(35)
    const raise = play(bet, 35, 2)
    expect(amountRange(raise)).toMatchObject({ min: 70, def: 70 })
    const turn = play(raise, 70, 0, null, 1, { seat: 3 }) // 70 + 35 + 70 + 70 = 245
    expect(potBefore(turn, 'turn')).toBe(245)
    expect(amountRange(turn).def).toBe(125) // half of 245, rounded to a blind
  })
})

describe('replay and edit', () => {
  const answers = [
    { step: 'dealer', value: 1 },
    { step: 'straddle', value: false },
    { step: 'raise', value: 6 },
    { step: 'amount', value: 25 },
    { step: 'callers', value: 2 },
    { step: 'raise', value: null },
    { step: 'callers', value: 1 },
  ]
  it('rebuilds the hand and the state before each answer', () => {
    const r = replay(createHand(base), answers)
    expect(currentStep(r.hand)).toBe('flop-bet')
    expect(r.applied).toHaveLength(7)
    expect(currentStep(r.states[2])).toBe('raise')
  })
  it('keeps later answers when an edit leaves the flow unchanged', () => {
    const edited = [...answers]
    edited[2] = { step: 'raise', value: 2 } // Dani raised, not Tal
    const r = replay(createHand(base), edited)
    expect(r.applied).toHaveLength(7)
    expect(preflopAggressor(r.hand)).toBe(2)
  })
  it('replays an End Hand answer wherever it falls', () => {
    const ended = [...answers.slice(0, 4), { step: END, value: 'callers' }, { step: 'cards-who', value: 6 }, { step: 'cards', value: 'QQ' }]
    const r = replay(createHand(base), ended)
    expect(r.applied).toHaveLength(7)
    expect(r.hand.ended).toBe('callers')
    expect(r.hand.shownHands).toEqual({ 6: 'QQ' })
  })
  it('drops later answers that no longer fit', () => {
    const edited = [...answers]
    edited[2] = { step: 'raise', value: null } // no raise after all
    const r = replay(createHand(base), edited)
    expect(r.applied).toHaveLength(3)
    expect(currentStep(r.hand)).toBe('callers')
  })
})

describe('session', () => {
  const session = { seats: [1, 2, 3].map((seat) => ({ seat, sittingOut: false })), dealerSeat: null, handNo: 1 }
  it('moves the button past the confirmed dealer', () => {
    expect(withNextHand(session, 2)).toMatchObject({ dealerSeat: 3, handNo: 2 })
    expect(withNextHand({ ...session, dealerSeat: 3 }, 3)).toMatchObject({ dealerSeat: 1 })
  })
  it('keeps no suggestion when a hand is skipped before any dealer', () => {
    expect(withNextHand(session, null).dealerSeat).toBeNull()
    expect(withNextHand({ ...session, dealerSeat: 1 }, null).dealerSeat).toBe(2)
  })
})
