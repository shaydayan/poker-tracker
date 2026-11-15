// View-state for the Hand screen: the current hand as table actions (domain/table.js), the saved hands, and an undo
// history. Every change made here (an action, saving or skipping a hand, sitting a player out, opening or
// saving a past hand, deleting a saved hand, entering a row again) is one step back on Undo, up to UNDO_LIMIT steps; storage is put back in
// line on each undo. A row of the log can be entered again: the actions after it come back once it is done, as long as
// they still fit (domain/table.js `reattach`). The hand in progress is saved as a draft on every change, so closing the
// app (or the phone restarting) mid-hand loses nothing; it comes back when the session is opened again.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Hand from '../domain/hand.js'
import * as Table from '../domain/table.js'
import { handRecord } from '../domain/record.js'
import { activeSeats, namesBySeat, sitOuts, withNextHand, withSitOuts, withSittingOut } from '../domain/session.js'
import { useStorage } from './StorageContext.jsx'

export const UNDO_LIMIT = 200

// A hand's base has everyone at the table; its first action says who sits it out (carried over from the hand before),
// so the log shows it and it can be changed like any other row.
const startActions = (session) => [{ type: 'seats', out: sitOuts(session) }]

function baseHand(session, settings) {
  return Hand.createHand({
    handNo: session.handNo,
    seats: session.seats.map((s) => s.seat),
    players: namesBySeat(session),
    suggestedDealer: session.dealerSeat,
    heroSeat: session.heroSeat,
    settings,
  })
}

export function useHandCapture(initialSession, settings) {
  const storage = useStorage()
  const [session, setSession] = useState(initialSession)
  const [base, setBase] = useState(() => baseHand(initialSession, settings))
  const [actions, setActions] = useState(() => startActions(initialSession))
  const [hands, setHands] = useState([])
  const [editing, setEditing] = useState(null) // { base, actions } of the hand put aside while a saved one is open
  // While a log row is entered again: where it started, its old actions and row, and the actions and rows after it.
  const [redo, setRedo] = useState(null) // { start, removed, row, tail, tailRows }
  const [history, setHistory] = useState([]) // snapshots of everything above, oldest first

  useEffect(() => { storage.hands.listBySession(initialSession.id).then(setHands) }, [storage, initialSession.id])

  // The hand in progress: load the saved draft once, then save it on every change (a redo counts as not done yet, so
  // the draft keeps the rows waiting after it; a saved hand open for editing keeps the hand put aside).
  const draftLoaded = useRef(false)
  useEffect(() => {
    let live = true
    storage.drafts.get(initialSession.id).then((d) => {
      if (!live) return
      draftLoaded.current = true
      if (d && d.base.handNo === initialSession.handNo && d.actions.length) {
        setBase(d.base)
        setActions(d.actions)
      }
    })
    return () => { live = false }
  }, [storage, initialSession.id, initialSession.handNo])
  useEffect(() => {
    if (!draftLoaded.current) return
    const main = editing ?? { base, actions: redo ? [...actions.slice(0, redo.start), ...redo.removed, ...redo.tail] : actions }
    const done = main.actions.length ? storage.drafts.save({ sessionId: session.id, base: main.base, actions: main.actions }) : storage.drafts.remove(session.id)
    done.catch((e) => console.error('Could not save the hand in progress', e))
  }, [actions, base, editing, redo, session.id, storage])

  const tableBase = useMemo(() => Table.fromHand(base), [base])
  const table = useMemo(() => Table.replay(tableBase, actions), [tableBase, actions])
  const started = actions.some((a) => a.type !== 'seats') // anything entered beyond who sits out
  const current = useMemo(() => handRecord({ sessionId: session.id, base, actions }), [session.id, base, actions])

  /** Call before every change: the state now becomes the newest undo step. */
  const remember = useCallback(() => {
    const snap = { session, base, actions, hands, editing, redo }
    setHistory((h) => [...h.slice(-(UNDO_LIMIT - 1)), snap])
  }, [actions, base, editing, hands, redo, session])

  const load = useCallback((b, acts) => {
    setBase(b)
    setActions(acts)
    setRedo(null)
  }, [])

  const restart = useCallback((next) => {
    setSession(next)
    load(baseHand(next, settings), startActions(next))
    storage.sessions.save(next)
  }, [load, settings, storage])

  const persist = useCallback(async () => {
    await storage.hands.save(current)
    setHands((hs) => [...hs.filter((x) => x.id !== current.id), current].sort((a, b) => a.handNo - b.handNo))
  }, [current, storage])

  const api = useMemo(() => ({
    /** Record one action, or several in a row (see domain/table.js). Ends a redo unless a player still needs their cards. */
    act: (action) => {
      remember()
      const added = Table.withStreets(table, [action].flat())
      const next = [...actions, ...added]
      // Who sits out in the hand in progress is also who sits out next hand (not so for a saved hand being edited).
      const seats = added.find((a) => a.type === 'seats')
      if (seats && !editing) {
        const s = withSitOuts(session, seats.out)
        setSession(s)
        storage.sessions.save(s)
      }
      if (!redo || next[next.length - 1].type === 'cards-who') return setActions(next)
      setActions(Table.reattach(tableBase, next, redo.tail))
      setRedo(null)
    },
    /** Enter log row `k` again: the hand goes back to just before it; what followed waits until it is done. */
    redoRow: (k) => {
      const rows = Table.log(tableBase, actions)
      const row = rows[k]
      if (!row || redo) return
      remember()
      setRedo({ start: row.start, removed: actions.slice(row.start, row.end), row, tail: actions.slice(row.end), tailRows: rows.slice(k + 1) })
      setActions(actions.slice(0, row.start))
    },
    /** Give up on the redo: the row and everything after it as they were. */
    restore: () => {
      if (!redo) return
      remember()
      setActions([...actions.slice(0, redo.start), ...redo.removed, ...redo.tail])
      setRedo(null)
    },
    /** Step back once: the state before the last change, with storage put back to match. */
    undo: async () => {
      const snap = history[history.length - 1]
      if (!snap) return
      setHistory((h) => h.slice(0, -1))
      setSession(snap.session)
      load(snap.base, snap.actions)
      setEditing(snap.editing)
      setRedo(snap.redo)
      setHands(snap.hands)
      if (snap.session !== session) await storage.sessions.save(snap.session)
      for (const r of hands) if (!snap.hands.some((x) => x.id === r.id)) await storage.hands.remove(r.id)
      for (const r of snap.hands) if (!hands.includes(r)) await storage.hands.save(r)
    },
    /**
     * First press stops the betting and asks which cards were shown; the next press saves and deals the next hand.
     * With nothing captured at all the hand is simply skipped.
     */
    endHand: async () => {
      remember()
      if (!started) return restart(withNextHand(session, table.dealerSeat))
      if (!Table.isOver(table)) return setActions((a) => [...a, { type: 'end' }])
      await persist()
      restart(withNextHand(session, table.dealerSeat))
    },
    /** Reopen a saved hand in place of the current one; the current one is kept aside until Save or Cancel. */
    openHand: (r) => {
      remember()
      if (!editing) setEditing({ base, actions })
      load(r.base, r.actions)
    },
    /** Delete a saved hand of this session (one step back on Undo, which saves it again). */
    deleteHand: async (r) => {
      remember()
      if (editing && current.id === r.id) {
        load(editing.base, editing.actions) // it was open for editing: back to the hand in progress
        setEditing(null)
      }
      setHands((hs) => hs.filter((x) => x.id !== r.id))
      await storage.hands.remove(r.id)
    },
    saveEdit: async () => {
      remember()
      await persist()
      load(editing.base, editing.actions)
      setEditing(null)
    },
    cancelEdit: () => {
      remember()
      load(editing.base, editing.actions)
      setEditing(null)
    },
    /** Sit a player out or back in from the menu: this hand too while nothing is entered yet, else from the next hand. */
    toggleSitOut: (seat) => {
      const target = session.seats.find((s) => s.seat === seat)
      const next = withSittingOut(session, seat, !target.sittingOut)
      if (activeSeats(next).length < 2) return
      remember()
      if (!started && !editing && !redo) setActions(startActions(next))
      setSession(next)
      storage.sessions.save(next)
    },
  }), [actions, base, current, editing, started, hands, history, load, persist, redo, remember, restart, session, storage, table, tableBase])

  return {
    session,
    /** The current hand in the question-based model (positions, shown hands, hero cards). */
    hand: current.hand,
    hands,
    editing: editing !== null,
    table,
    actions,
    log: Table.log(tableBase, actions),
    /** The row being entered again and the rows waiting after it; null otherwise. */
    redoing: redo && { row: redo.row, tailRows: redo.tailRows, kind: redo.removed[0]?.type, removed: redo.removed },
    /** Something beyond who sits out has been entered in this hand. */
    started,
    canUndo: history.length > 0,
    inCardsPhase: Table.isOver(table),
    ...api,
  }
}
