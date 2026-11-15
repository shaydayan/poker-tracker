import { describe, expect, it } from 'vitest'
import { guestName, nameTaken, validatePlayerName } from './players.js'

describe('player names', () => {
  it('compares trimmed and case-insensitive', () => {
    expect(nameTaken(' dani ', ['Dani'])).toBe(true)
    expect(nameTaken('Dan', ['Dani'])).toBe(false)
  })

  it('rejects empty and taken names', () => {
    expect(validatePlayerName('  ', ['Dani'])).toBe('Enter a name.')
    expect(validatePlayerName('DANI', ['Dani'])).toBe('DANI is already taken.')
    expect(validatePlayerName('Avi', ['Dani'])).toBe(null)
  })

  it('picks the first free guest number', () => {
    expect(guestName(['Dani'])).toBe('Guest 1')
    expect(guestName(['Guest 1', 'guest 2', 'Guest 4'])).toBe('Guest 3')
  })
})
