// Finding hands within a session, to compare them: by who played them and how, who dealt, the kind of pot, its size, cards shown
// and notes. Works on each hand's facts (record.js recordFacts). Pure.

/** What the chosen players did in the hand: put chips in, bet or raised, or had their cards entered. */
export const ROLES = [
  { id: 'inHand', label: 'In Hand' },
  { id: 'raised', label: 'Raised' },
  { id: 'showed', label: 'Showed' },
]

/** The pot by the raises before the flop. */
export const POT_TYPES = [
  { id: 'any', label: 'Any' },
  { id: 'limped', label: 'Limped' },
  { id: 'raised', label: 'Raised' },
  { id: '3bet', label: '3-Bet+' },
]

/** The smallest pot, in chips. */
export const MIN_POTS = [
  { id: 0, label: 'Any' },
  { id: 100, label: '100+' },
  { id: 300, label: '300+' },
  { id: 500, label: '500+' },
]

export const NO_FILTER = { players: [], role: 'inHand', dealer: null, potType: 'any', minPot: 0, shown: false, notes: false }

export const isFiltering = (f) => f.players.length > 0 || f.dealer !== null || f.potType !== 'any' || f.minPot > 0 || f.shown || f.notes

const potTypeOf = (raises) => (raises === 0 ? 'limped' : raises === 1 ? 'raised' : '3bet')

/** Whether a hand with these facts matches: every chosen player in the chosen role, the dealer, the pot type, at least the pot, cards
 *  shown, a note. */
export function matches(facts, f) {
  return (
    f.players.every((p) => facts[f.role].has(p)) &&
    (f.dealer === null || facts.dealer === f.dealer) &&
    (f.potType === 'any' || potTypeOf(facts.preflopRaises) === f.potType) &&
    facts.pot >= f.minPot &&
    (!f.shown || facts.showed.size > 0) &&
    (!f.notes || facts.note)
  )
}
