// A saved hand. The table actions are the source: they rebuild the hand for editing and give the street-by-street
// history; `hand` is the same hand in the question-based model, derived once for stats. My cards are the ones I showed,
// as notation ("AKo"), or null. Pure.
import * as Hand from './hand.js'
import * as Table from './table.js'
import { notation } from './cards.js'

/** The shape of a saved hand. Bump it, and teach the readers the older shape, whenever the record changes: hands saved
 *  today must still load (and feed stats) in every later version. The actions are the source; `hand` can be rebuilt. */
//  1: base.seats are the seats that played.
//  2: base.seats are everyone at the table; a first 'seats' action may sit some out (absent = everyone played).
//     Optional `note` (free text about the hand); hands saved before it have none, read as ''.
//  3: a player's cards are a 'show' action (one or two cards, at any point); format 2 and older used 'cards-who' then
//     'cards' after the betting (still read). My cards as notation only when I showed two.
//  4: `startedAt`, when the hand was first entered (ISO time, kept in `base.startedAt` and never changed by an edit);
//     hands saved before it have none (null).
//  6: one entry per player turn (domain/table.js "entries and edits"): a turn the app filled in is an entry of its own
//     (`auto`, `by`), End Street is a 'street-end' entry after the turns it filled in, and the board and the cards shown
//     are kept on the hand (`base.board`, `base.shown`) instead of among the actions. Older hands are read through
//     Table.normalize, which turns them into this shape.
//  5: `base.stacks` ({ seat: '0-100' | '100-250' | '250-500' | '500-1000' | '1000+' }) and `base.buyIns` ({ seat: chips
//     bought in for so far this session }), as they were at this hand; hands saved before them have neither (not known).
export const HAND_FORMAT = 6

/** `base` is the hand as created for the session (Hand.createHand), `actions` the table actions (domain/table.js), `note`
 *  free text about the hand. */
export function handRecord({ sessionId, base: given, actions: entered, note = '' }) {
  const { base, actions } = Table.normalize(given, entered)
  const tableBase = Table.fromHand(base)
  const end = Table.replay(tableBase, actions)
  const shown = end.shownHands[base.heroSeat]
  const heroCards = Array.isArray(shown) ? (shown.length === 2 ? notation(shown) : null) : shown ?? null
  const answers = Table.toAnswers(tableBase, actions)
  // The stats model sees only the seats that played; who sat out stays in the actions.
  const hand = Hand.setHeroCards(Hand.replay({ ...base, seats: end.seats }, answers).hand, heroCards)
  return { format: HAND_FORMAT, id: `${sessionId}-${base.handNo}`, sessionId, handNo: base.handNo, startedAt: base.startedAt ?? null, base, actions, heroCards, hand, note: note.trim() }
}

/** The hand's base stamped with the time it was first entered: once something beyond who sits out is in `actions`, at
 *  `now` (an ISO time). A base already stamped keeps its time. */
export const withStartTime = (base, actions, now) =>
  base.startedAt || !actions.some((a) => a.type !== 'seats') ? base : { ...base, startedAt: now }

/** A saved hand's base and entries in the present shape (an older hand converted; see Table.normalize). */
const upgraded = (r) => Table.normalize(r.base, r.actions)

/** Saved hands in hand order (#2 before #10). */
export const byHandNo = (records) => [...records].sort((a, b) => a.handNo - b.handNo)

/** Each player's stack size at this hand by name ({ Tal: '500-1000' }; empty for hands saved before stacks existed). */
export const recordStacks = (r) => Object.fromEntries(Object.entries(r.base.stacks ?? {}).map(([s, v]) => [r.base.players[s], v]))

/** Each player's total buy-in so far in the session at this hand, in chips, by name (empty for hands saved before it). */
export const recordBuyIns = (r) => Object.fromEntries(Object.entries(r.base.buyIns ?? {}).map(([s, v]) => [r.base.players[s], v]))

/** The hand's note ('' when none, as in hands saved before notes existed). */
export const recordNote = (r) => r.note ?? ''

/** The hand's name in lists: "#14", with ✎ when it has a note. */
export const recordLabel = (r) => `#${r.handNo}${recordNote(r) ? ' ✎' : ''}`

/** Street by street, naming who did what (see Table.streetLines), then the note if there is one. */
export const recordLines = (r) => {
  const h = upgraded(r)
  const lines = Table.streetLines(Table.fromHand(h.base), h.actions)
  return recordNote(r) ? [...lines, { label: 'Note', text: recordNote(r) }] : lines
}

/** What the hand is about, for the hand filter (see Table.handFacts), with the players named. */
export function recordFacts(r) {
  const h = upgraded(r)
  const f = Table.handFacts(Table.fromHand(h.base), h.actions)
  const names = (seats) => new Set([...seats].map((s) => r.base.players[s]))
  return { inHand: names(f.inHand), raised: names(f.raised), showed: names(f.showed), preflopRaises: f.preflopRaises, pot: f.pot, dealer: f.dealer === null ? null : r.base.players[f.dealer], note: recordNote(r) !== '' }
}

/** The whole hand on one line, for lists. */
export const recordSummary = (r) => {
  const h = upgraded(r)
  return Table.summary(Table.fromHand(h.base), h.actions)
}
