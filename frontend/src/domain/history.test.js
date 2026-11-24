import { describe, it, expect } from 'vitest'
import { NO_FILTER, isFiltering, matches } from './history.js'

const facts = (over = {}) => ({ inHand: new Set(['Tal', 'Shay']), raised: new Set(['Tal']), showed: new Set(['Tal']), preflopRaises: 1, pot: 160, dealer: 'Shay', note: false, ...over })

describe('hand filter', () => {
  it('matches every hand with no filter', () => {
    expect(isFiltering(NO_FILTER)).toBe(false)
    expect(matches(facts(), NO_FILTER)).toBe(true)
  })
  it('needs every chosen player in the chosen role', () => {
    expect(matches(facts(), { ...NO_FILTER, players: ['Tal', 'Shay'] })).toBe(true)
    expect(matches(facts(), { ...NO_FILTER, players: ['Tal', 'Roni'] })).toBe(false)
    expect(matches(facts(), { ...NO_FILTER, players: ['Shay'], role: 'raised' })).toBe(false)
    expect(matches(facts(), { ...NO_FILTER, players: ['Tal'], role: 'showed' })).toBe(true)
  })
  it('filters by dealer', () => {
    expect(matches(facts(), { ...NO_FILTER, dealer: 'Shay' })).toBe(true)
    expect(matches(facts(), { ...NO_FILTER, dealer: 'Tal' })).toBe(false)
    expect(isFiltering({ ...NO_FILTER, dealer: 'Tal' })).toBe(true)
  })
  it('filters by pot type, pot size, cards shown and notes', () => {
    expect(matches(facts(), { ...NO_FILTER, potType: 'raised' })).toBe(true)
    expect(matches(facts({ preflopRaises: 0 }), { ...NO_FILTER, potType: 'limped' })).toBe(true)
    expect(matches(facts({ preflopRaises: 3 }), { ...NO_FILTER, potType: '3bet' })).toBe(true)
    expect(matches(facts(), { ...NO_FILTER, potType: '3bet' })).toBe(false)
    expect(matches(facts(), { ...NO_FILTER, minPot: 300 })).toBe(false)
    expect(matches(facts({ showed: new Set() }), { ...NO_FILTER, shown: true })).toBe(false)
    expect(matches(facts(), { ...NO_FILTER, notes: true })).toBe(false)
    expect(matches(facts({ note: true }), { ...NO_FILTER, notes: true })).toBe(true)
  })
})
