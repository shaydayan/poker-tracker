import { describe, expect, it } from 'vitest'
import { createHand } from './hand.js'
import { handRecord, HAND_FORMAT, recordLines, recordNote, recordBuyIns, recordStacks, recordSummary, withStartTime } from './record.js'

const settings = { smallBlind: 5, bigBlind: 5, straddle: 10, openRaise: 25, straddleOpenRaise: 45, threeBet: 3, fourBet: 2, postflopRaise: 2 }
const base = createHand({ handNo: 1, seats: [1, 2, 3, 4], players: { 1: 'Shay', 2: 'Dani', 3: 'Omer', 4: 'Tal' }, suggestedDealer: 1, heroSeat: 1, settings })

describe('saved hand', () => {
  it('keeps everyone in the base, and gives the stats model only the seats that played', () => {
    const r = handRecord({ sessionId: 9, base, actions: [{ type: 'seats', out: [1, 3] }, { type: 'dealer', seat: 2 }, { type: 'rest-fold' }] })
    expect(r.format).toBe(HAND_FORMAT)
    expect(r.base.seats).toEqual([1, 2, 3, 4])
    expect(r.hand.seats).toEqual([2, 4])
    expect(r.hand.dealerSeat).toBe(2)
  })
  it('saves one entry per turn, with the board and cards shown on the hand, and reads hands saved before that the same', () => {
    // An older hand (dealer Shay): Shay raises, skipping Tal; "everyone else calls"; the board and cards among the actions.
    const old = { format: 5, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'raise', seat: 1, amount: 25 }, { type: 'rest-call' }, { type: 'board', cards: ['Ah', 'Kd', '7c'] }, { type: 'show', seat: 1, cards: ['Qs', 'Qh'] }, { type: 'end' }] }
    const r = handRecord({ sessionId: 9, base: old.base, actions: old.actions })
    expect(r.format).toBe(6)
    expect(r.base.board).toEqual(['Ah', 'Kd', '7c'])
    expect(r.base.shown).toEqual({ 1: ['Qs', 'Qh'] })
    expect(r.actions.some((a) => ['board', 'show', 'rest-call'].includes(a.type))).toBe(false)
    expect(r.actions.filter((a) => a.auto)).toHaveLength(3) // Tal's fold, then Dani's and Omer's calls
    expect(recordLines(old)).toEqual(recordLines(r)) // an older record reads the same
    expect(recordSummary(old)).toEqual(recordSummary(r))
    expect(r.heroCards).toBe('QQ')
  })
  it('reads hands saved before sitting out was recorded (everyone played)', () => {
    const r = handRecord({ sessionId: 9, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] })
    expect(r.hand.seats).toEqual([1, 2, 3, 4])
  })
  it('keeps a note, trimmed, and lists it after the streets', () => {
    const r = handRecord({ sessionId: 9, base, note: '  Tal bluffs rivers ', actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] })
    expect(r.note).toBe('Tal bluffs rivers')
    expect(recordLines(r).at(-1)).toEqual({ label: 'Note', text: 'Tal bluffs rivers' })
  })
  it('reads hands saved before notes existed (no note)', () => {
    const { note, ...old } = handRecord({ sessionId: 9, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] })
    expect(note).toBe('')
    expect(recordNote(old)).toBe('')
    expect(recordLines(old).some((l) => l.label === 'Note')).toBe(false)
  })
  it('names my cards only when I showed two', () => {
    const one = handRecord({ sessionId: 9, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'show', seat: 1, cards: ['Ah'] }, { type: 'end' }] })
    expect(one.heroCards).toBe(null)
    const two = handRecord({ sessionId: 9, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'show', seat: 1, cards: ['Ah', 'Ad'] }, { type: 'end' }] })
    expect(two.heroCards).toBe('AA')
    expect(two.hand.shownHands).toEqual({ 1: 'AA' })
  })
  it('is stamped with the time it was first entered, which an edit keeps', () => {
    const seatsOnly = [{ type: 'seats', out: [] }]
    expect(withStartTime(base, seatsOnly, '2026-11-22T20:00:00.000Z')).toBe(base) // nothing entered yet
    const stamped = withStartTime(base, [...seatsOnly, { type: 'dealer', seat: 1 }], '2026-11-22T20:00:00.000Z')
    expect(stamped.startedAt).toBe('2026-11-22T20:00:00.000Z')
    expect(withStartTime(stamped, [...seatsOnly, { type: 'dealer', seat: 2 }], '2026-11-22T21:30:00.000Z')).toBe(stamped)
    const r = handRecord({ sessionId: 9, base: stamped, actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] })
    expect(r.startedAt).toBe('2026-11-22T20:00:00.000Z')
    expect(handRecord({ sessionId: 9, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] }).startedAt).toBe(null) // saved before times
  })
  it('keeps every player stack size and buy-in as they were at the hand, by name', () => {
    const r = handRecord({ sessionId: 9, base: { ...base, stacks: { 2: '1000+', 4: '0-100' }, buyIns: { 2: 300, 4: 900 } }, actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] })
    expect(recordStacks(r)).toEqual({ Dani: '1000+', Tal: '0-100' })
    expect(recordBuyIns(r)).toEqual({ Dani: 300, Tal: 900 })
    const old = handRecord({ sessionId: 9, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] })
    expect(recordStacks(old)).toEqual({})
    expect(recordBuyIns(old)).toEqual({})
  })
})
