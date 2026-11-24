import { describe, it, expect } from 'vitest'
import { buyInValues, createSession, handExtras, seatRows, withBuyIn, withStack } from './session.js'

const settings = { buyIn: 300 }
const session = () => createSession({ id: 1, date: '2026-11-22', seats: seatRows({ id: 1, name: 'Shay' }, [{ id: 2, name: 'Tal' }, { id: 3, name: 'Dani' }]) })

describe('session: stacks and buy-ins', () => {
  it('starts everyone at the game buy-in and the middle stack size', () => {
    expect(handExtras(session(), settings)).toEqual({ stacks: { 1: '250-500', 2: '250-500', 3: '250-500' }, buyIns: { 1: 300, 2: 300, 3: 300 } })
  })
  it('keeps each player stack size and total buy-in until changed', () => {
    const s = withBuyIn(withStack(session(), 2, '1000+'), 3, 700)
    expect(handExtras(s, settings)).toEqual({ stacks: { 1: '250-500', 2: '1000+', 3: '250-500' }, buyIns: { 1: 300, 2: 300, 3: 700 } })
  })
  it('offers buy-ins from the game buy-in to 2000 in steps of 100', () => {
    const v = buyInValues(300)
    expect(v[0]).toBe(300)
    expect(v[1]).toBe(400)
    expect(v.at(-1)).toBe(2000)
    expect(buyInValues(2500)).toEqual([2500])
  })
})
