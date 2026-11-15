// Cards. Ranks high to low; range-chart notation like "AKs", "T9o", "QQ" is how stats keep a hand. Pure.
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

// Single cards, for the board: rank + suit, like "Ah" (ace of hearts), "Td", "7c".
export const SUITS = ['s', 'h', 'd', 'c']
const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' }

/** "Ah" → "A♥". */
export const cardLabel = (card) => card[0] + SUIT_SYMBOL[card[1]]
/** Hearts and diamonds are shown red. */
export const isRed = (card) => card[1] === 'h' || card[1] === 'd'

/** Two exact cards as range-chart notation for stats: ["Ah", "Kd"] → "AKo", ["Qs", "Qh"] → "QQ". */
export function notation(cards) {
  const [a, b] = [...cards].sort((x, y) => RANKS.indexOf(x[0]) - RANKS.indexOf(y[0]))
  if (a[0] === b[0]) return a[0] + b[0]
  return a[0] + b[0] + (a[1] === b[1] ? 's' : 'o')
}

/** A player's shown cards as text: exact cards "A♥ K♦"; older hands saved a notation like "AKs", shown as it is. */
export const handLabel = (cards) => (Array.isArray(cards) ? cards.map(cardLabel).join(' ') : cards)
