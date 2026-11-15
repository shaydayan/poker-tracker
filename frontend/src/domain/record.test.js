import { describe, expect, it } from 'vitest'
import { createHand } from './hand.js'
import { handRecord, HAND_FORMAT } from './record.js'

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
  it('reads hands saved before sitting out was recorded (everyone played)', () => {
    const r = handRecord({ sessionId: 9, base, actions: [{ type: 'dealer', seat: 1 }, { type: 'rest-fold' }] })
    expect(r.hand.seats).toEqual([1, 2, 3, 4])
  })
})
