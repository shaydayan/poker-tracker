// Settings, your name and the player roster. Every valid change is saved at once; invalid ones show an error and are not
// saved. You are a player record too (settings.heroPlayerId), created the first time you enter your name; `others` is
// the roster without you.
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, validateSettings } from '../domain/settings.js'
import { validatePlayerName } from '../domain/players.js'
import { useStorage } from './StorageContext.jsx'

export function useSettings(onChange) {
  const storage = useStorage()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [players, setPlayers] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    storage.settings.get().then(setSettings)
    storage.players.list().then(setPlayers)
  }, [storage])

  const hero = players.find((p) => p.id === settings.heroPlayerId) ?? null
  const others = players.filter((p) => p !== hero)
  // Your name saves as you type. Saves run one at a time and always end on the latest name typed, even if the screen is
  // left mid-save; refs give them the current roster and settings across the awaits.
  const latest = useRef({ settings, players })
  latest.current = { settings, players }
  const wantedName = useRef(null)
  const savingName = useRef(false)

  const apply = async (next) => {
    setSettings(next)
    const problem = validateSettings(next)
    setError(problem)
    if (problem) return
    await storage.settings.save(next)
    onChange(next)
  }

  return {
    settings,
    hero,
    others,
    error,
    /** Why `name` cannot be your name (another player has it), or null. */
    heroNameProblem: (name) => validatePlayerName(name, others.map((p) => p.name)),
    /** Save your name: creates you as a player the first time, renames you after that. */
    saveHeroName: async (name) => {
      wantedName.current = name.trim()
      if (savingName.current) return // the save running now picks the new name up when it is done
      savingName.current = true
      try {
        for (;;) {
          const clean = wantedName.current
          const { settings: now, players: roster } = latest.current
          const me = roster.find((p) => p.id === now.heroPlayerId)
          if (!clean || clean === me?.name || validatePlayerName(clean, roster.filter((p) => p !== me).map((p) => p.name))) break
          if (me) {
            await storage.players.rename(me.id, clean)
            const next = roster.map((p) => (p.id === me.id ? { ...p, name: clean } : p))
            latest.current = { settings: now, players: next }
            setPlayers(next)
          } else {
            const p = await storage.players.add(clean)
            const next = { settings: { ...now, heroPlayerId: p.id }, players: [...roster, p] }
            latest.current = next
            setPlayers(next.players)
            await apply(next.settings)
          }
        }
      } finally {
        savingName.current = false
      }
    },
    update: (patch) => apply({ ...settings, ...patch }),
    /** Why `name` cannot be added to the roster, or null. */
    nameProblem: (name) => validatePlayerName(name, players.map((p) => p.name)),
    addPlayer: async (name) => {
      if (validatePlayerName(name, players.map((p) => p.name))) return
      const p = await storage.players.add(name.trim())
      setPlayers((ps) => [...ps, p])
    },
    removePlayer: async (id) => {
      await storage.players.remove(id)
      setPlayers((ps) => ps.filter((p) => p.id !== id))
    },
  }
}
