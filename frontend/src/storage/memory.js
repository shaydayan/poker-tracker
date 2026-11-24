// In-memory adapter for the ports in domain/ports.js, with a sample roster and last week's session. Used by tests and by
// the demo mode (open the app with ?demo): data is lost on reload. The real storage is storage/indexeddb.js.
import { DEFAULT_SETTINGS } from '../domain/settings.js'
import { createSession, seatRows, withEnded, activeSeats, namesBySeat } from '../domain/session.js'
import { createHand } from '../domain/hand.js'
import { byHandNo, handRecord } from '../domain/record.js'

const FIXTURE_PLAYERS = ['Shay', 'Dani', 'Omer', 'Roni', 'Gil', 'Tal', 'Yossi', 'Noa']

/** One finished session from last week, so the history has something to show. */
function fixtureSession(players, settings) {
  const [hero, ...others] = players.slice(0, 5)
  const session = withEnded({ ...createSession({ id: 1, date: '2026-10-29', seats: seatRows(hero, others) }), dealerSeat: 2, handNo: 4 })
  const base = (handNo, suggestedDealer) => createHand({ handNo, seats: activeSeats(session), players: namesBySeat(session), suggestedDealer, heroSeat: 1, settings })
  // Seats: 1 Shay, 2 Dani, 3 Omer, 4 Roni, 5 Gil. Table actions, see domain/table.js.
  const scripts = [
    [1, [{ type: 'dealer', seat: 1 }, { type: 'call', seat: 4 }, { type: 'raise', seat: 3, amount: 25 }, { type: 'call', seat: 4 }, { type: 'fold', seat: 2 }, { type: 'raise', seat: 3, amount: 35 }, { type: 'fold', seat: 4 }]],
    [2, [{ type: 'dealer', seat: 2 }, { type: 'straddle' }, { type: 'raise', seat: 1, amount: 45 }, { type: 'fold', seat: 2 }, { type: 'call', seat: 3 }, { type: 'fold', seat: 4 }, { type: 'call', seat: 5 }, { type: 'board', cards: ['Jh', '7c', '2d'] }, { type: 'next-street' }, { type: 'board', cards: ['Jh', '7c', '2d', 'Ks'] }, { type: 'raise', seat: 5, amount: 70 }, { type: 'call', seat: 1 }, { type: 'fold', seat: 3 }, { type: 'next-street' }, { type: 'cards-who', seat: 5 }, { type: 'cards', cards: ['Ad', 'Kd'] }, { type: 'cards-who', seat: 1 }, { type: 'cards', cards: ['Qs', 'Qc'] }]],
    [3, [{ type: 'dealer', seat: 3 }, { type: 'raise', seat: 2, amount: 25 }, { type: 'fold', seat: 3 }, { type: 'call', seat: 4 }, { type: 'end' }, { type: 'cards-who', seat: 4 }, { type: 'cards', cards: ['Th', '9h'] }]],
  ]
  const hands = scripts.map(([handNo, script]) => {
    const b = base(handNo, handNo)
    return handRecord({ sessionId: session.id, base: b, actions: script }) // handRecord puts the actions into entries
  })
  return { session, hands }
}

export function createMemoryStorage() {
  let players = FIXTURE_PLAYERS.map((name, i) => ({ id: i + 1, name }))
  let settings = { ...DEFAULT_SETTINGS, heroPlayerId: 1 }
  const fixture = fixtureSession(players, settings)
  let sessions = [fixture.session]
  let hands = [...fixture.hands]
  let nextId = players.length + 1
  let drafts = []
  const upsert = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item])
  return {
    settings: {
      get: async () => ({ ...settings }),
      save: async (s) => void (settings = { ...s }),
    },
    players: {
      list: async () => [...players],
      add: async (name) => {
        const p = { id: nextId++, name }
        players = [...players, p]
        return p
      },
      rename: async (id, name) => void (players = players.map((p) => (p.id === id ? { ...p, name } : p))),
      remove: async (id) => void (players = players.filter((p) => p.id !== id)),
    },
    sessions: {
      save: async (s) => void (sessions = upsert(sessions, s)),
      remove: async (id) => {
        sessions = sessions.filter((s) => s.id !== id)
        hands = hands.filter((h) => h.sessionId !== id)
        drafts = drafts.filter((d) => d.sessionId !== id)
      },
      current: async () => sessions.find((s) => !s.ended) ?? null,
      list: async () => [...sessions],
    },
    hands: {
      save: async (h) => void (hands = upsert(hands, h)),
      remove: async (id) => void (hands = hands.filter((h) => h.id !== id)),
      listBySession: async (sessionId) => byHandNo(hands.filter((h) => h.sessionId === sessionId)),
    },
    drafts: {
      get: async (sessionId) => drafts.find((d) => d.sessionId === sessionId) ?? null,
      save: async (d) => void (drafts = [...drafts.filter((x) => x.sessionId !== d.sessionId), d]),
      remove: async (sessionId) => void (drafts = drafts.filter((d) => d.sessionId !== sessionId)),
    },
    backup: {
      dump: async () => structuredClone({ settings, players, sessions, hands, drafts }),
      restore: async (data) => {
        const d = structuredClone(data)
        settings = { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) }
        players = d.players
        sessions = d.sessions
        hands = d.hands
        drafts = d.drafts ?? []
        nextId = Math.max(0, ...players.map((p) => p.id)) + 1
      },
    },
    persist: async () => false,
  }
}
