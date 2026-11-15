import { describe, expect, it } from 'vitest'
import { handLabel, notation } from './cards.js'

describe('exact cards', () => {
  it('turns two cards into range-chart notation', () => {
    expect(notation(['Kd', 'Ah'])).toBe('AKo')
    expect(notation(['9s', 'Ts'])).toBe('T9s')
    expect(notation(['Qs', 'Qh'])).toBe('QQ')
  })
  it('labels exact cards and older notations', () => {
    expect(handLabel(['Ah', 'Kd'])).toBe('A♥ K♦')
    expect(handLabel('AKs')).toBe('AKs')
  })
})
