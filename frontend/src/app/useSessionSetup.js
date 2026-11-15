import { useEffect, useState } from 'react'
import { createSession, seatRows, validateSession, MAX_SEATS } from '../domain/session.js'
import { guestName, validatePlayerName } from '../domain/players.js'
import { useStorage } from './StorageContext.jsx'

export function useSessionSetup(settings, active, onStarted) {
  const storage = useStorage()
  const [players, setPlayers] = useState([])
  const [others, setOthers] = useState([]) // [{ id|null, name }] clockwise after me
  const [error, setError] = useState(null)

  useEffect(() => {
    if (active) storage.players.list().then(setPlayers) // again each time the tab is shown: Settings may have changed it
  }, [storage, active, settings.heroPlayerId]) // and when your name is first saved

  const known = players.find((p) => p.id === settings.heroPlayerId)
  const hero = known ?? { id: settings.heroPlayerId, name: '…' }
  const seatedIds = new Set(others.map((o) => o.id).filter(Boolean))
  // Not yet seated, always in roster order, so a player sent back returns to the same place in the list.
  const pool = players.filter((p) => p.id !== hero.id && !seatedIds.has(p.id))
  // Every name in use: the roster (seated or not) and the guests already seated.
  const names = [...players.map((p) => p.name), ...others.filter((o) => o.id === null).map((o) => o.name)]
  const guestDefault = guestName(names)
  /** Why a typed guest name cannot be used, or null (an empty name falls back to guestDefault). */
  const guestProblem = (name) => (name.trim() ? validatePlayerName(name, names) : null)
  const full = others.length + 1 >= MAX_SEATS

  return {
    hero,
    others,
    pool,
    error,
    full,
    /** Seat a pool player at the next seat. */
    seat: (p) => !full && setOthers((o) => [...o, { id: p.id, name: p.name }]),
    /** The name a guest gets when none is typed. */
    guestDefault,
    guestProblem,
    seatGuest: (name) => !full && !guestProblem(name) && setOthers((o) => [...o, { id: null, name: name.trim() || guestDefault }]),
    /** Send the player at seat index `i` (0 = the seat after me) back. */
    unseat: (i) => setOthers((o) => o.filter((_, j) => j !== i)),
    start: async () => {
      if (!known) return setError('Enter your name in Settings first.')
      const session = createSession({ id: Date.now(), date: new Date().toISOString().slice(0, 10), seats: seatRows(hero, others) })
      const problem = validateSession(session)
      setError(problem)
      if (problem) return
      await storage.sessions.save(session)
      onStarted(session)
    },
  }
}
