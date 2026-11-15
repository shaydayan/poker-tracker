// A saved hand. The table actions are the source: they rebuild the hand for editing and give the street-by-street
// history; `hand` is the same hand in the question-based model, derived once for stats. My cards are the ones I showed,
// as notation ("AKo"), or null. Pure.
import * as Hand from './hand.js'
import * as Table from './table.js'
import { notation } from './cards.js'

/** The shape of a saved hand. Bump it, and teach the readers the older shape, whenever the record changes: hands saved
 *  today must still load (and feed stats) in every later version. The actions are the source; `hand` can be rebuilt. */
export const HAND_FORMAT = 1

/** `base` is the hand as created for the session (Hand.createHand), `actions` the table actions (domain/table.js). */
export function handRecord({ sessionId, base, actions }) {
  const tableBase = Table.fromHand(base)
  const shown = Table.replay(tableBase, actions).shownHands[base.heroSeat]
  const heroCards = Array.isArray(shown) ? notation(shown) : shown ?? null
  const answers = Table.toAnswers(tableBase, actions)
  const hand = Hand.setHeroCards(Hand.replay(base, answers).hand, heroCards)
  return { format: HAND_FORMAT, id: `${sessionId}-${base.handNo}`, sessionId, handNo: base.handNo, base, actions, heroCards, hand }
}

/** Street by street, naming who did what (see Table.streetLines). */
export const recordLines = (r) => Table.streetLines(Table.fromHand(r.base), r.actions)

/** The whole hand on one line, for lists. */
export const recordSummary = (r) => Table.summary(Table.fromHand(r.base), r.actions)
