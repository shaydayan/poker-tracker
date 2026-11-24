// View-state for the Hand screen: the current hand as entries (domain/table.js: one per player turn, with the board and
// the cards shown kept on the hand), the saved hands, and an undo history. Every change made here (an action, an edit,
// saving or skipping a hand, sitting a player out, opening or saving a past hand, deleting a saved hand) is one step back
// on Undo, up to UNDO_LIMIT steps; storage is put back in line on each undo. Any turn of the log can be changed, and End
// Street or End Hand taken back, in one step: what comes after is checked again and whatever no longer fits is taken out
// (`notice` says how many, for a moment). The hand is always open at its end for more. The hand in progress is saved as a
// draft on every change, so closing the app (or the phone restarting) mid-hand loses nothing. Each hand can carry a
// free-text note. A hand is stamped with the time its first action is entered (in its base); editing never changes it.
//
// With `open` (a saved hand of a finished session, from History) it edits only that hand: no draft, the session is
// never changed, and Save Changes or Cancel calls `onClose`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Hand from '../domain/hand.js'
import * as Table from '../domain/table.js'
import { byHandNo, handRecord, withStartTime } from '../domain/record.js'
import { activeSeats, handExtras, namesBySeat, sitOuts, withBuyIn, withNextHand, withSitOuts, withSittingOut, withStack } from '../domain/session.js'
import { useStorage } from './StorageContext.jsx'

export const UNDO_LIMIT = 200

const nextId = (actions) => actions.reduce((m, a) => Math.max(m, a.id ?? 0), 0) + 1

// A hand's base has everyone at the table; its first action says who sits it out (carried over from the hand before),
// so the log shows it and it can be changed like any other row.
const startActions = (session) => [{ type: 'seats', out: sitOuts(session) }]

// Each hand keeps every player's stack size and total buy-in as they were at that hand (see session.handExtras).
function baseHand(session, settings) {
  return {
    ...Hand.createHand({
      handNo: session.handNo,
      seats: session.seats.map((s) => s.seat),
      players: namesBySeat(session),
      suggestedDealer: session.dealerSeat,
      heroSeat: session.heroSeat,
      settings,
    }),
    ...handExtras(session, settings),
  }
}

export function useHandCapture(initialSession, settings, { open = null, onClose } = {}) {
  const storage = useStorage()
  const past = open !== null
  const [session, setSession] = useState(initialSession)
  const [base, setBase] = useState(() => (past ? Table.normalize(open.base, open.actions).base : baseHand(initialSession, settings)))
  const [actions, setActions] = useState(() => (past ? Table.normalize(open.base, open.actions).actions : startActions(initialSession)))
  const [note, setNote] = useState(open?.note ?? '')
  const [hands, setHands] = useState([])
  // { base, actions, note } of the hand put aside while a saved one is open (for a past hand, an empty one never shown)
  const [editing, setEditing] = useState(() => (past ? { base: baseHand(initialSession, settings), actions: startActions(initialSession), note: '' } : null))
  const [notice, setNotice] = useState(null) // { text, key } after an edit took later turns out
  const [history, setHistory] = useState([]) // snapshots of everything above, oldest first

  useEffect(() => { storage.hands.listBySession(initialSession.id).then(setHands) }, [storage, initialSession.id])

  // The hand in progress: load the saved draft once, then save it on every change (while a saved hand is open for
  // editing, the hand put aside is the draft).
  const draftLoaded = useRef(false)
  useEffect(() => {
    if (past) return undefined // a past hand is saved with Save Changes only
    let live = true
    storage.drafts.get(initialSession.id).then((d) => {
      if (!live) return
      draftLoaded.current = true
      if (d && d.base.handNo === initialSession.handNo && d.actions.length) {
        const n = Table.normalize(d.base, d.actions) // a draft from before entries had their present shape
        setBase(n.base)
        setActions(n.actions)
        setNote(d.note ?? '')
      }
    })
    return () => { live = false }
  }, [storage, initialSession.id, initialSession.handNo, past])
  useEffect(() => {
    if (!draftLoaded.current) return
    const main = editing ?? { base, note, actions }
    const done = main.actions.length ? storage.drafts.save({ sessionId: session.id, base: main.base, actions: main.actions, note: main.note }) : storage.drafts.remove(session.id)
    done.catch((e) => console.error('Could not save the hand in progress', e))
  }, [actions, base, editing, note, session.id, storage])

  const tableBase = useMemo(() => Table.fromHand(base), [base])
  const table = useMemo(() => Table.replay(tableBase, actions), [tableBase, actions])
  const started = actions.some((a) => a.type !== 'seats') // anything entered beyond who sits out
  const current = useMemo(() => handRecord({ sessionId: session.id, base, actions, note }), [session.id, base, actions, note])

  /** Call before every change: the state now becomes the newest undo step. */
  const remember = useCallback(() => {
    const snap = { session, base, actions, note, hands, editing }
    setHistory((h) => [...h.slice(-(UNDO_LIMIT - 1)), snap])
    setNotice(null)
  }, [actions, base, editing, hands, note, session])

  const load = useCallback((b, acts, n = '') => {
    const h = Table.normalize(b, acts) // a saved hand from before entries had their present shape
    setBase(h.base)
    setActions(h.actions)
    setNote(n)
  }, [])

  const restart = useCallback((next) => {
    setSession(next)
    load(baseHand(next, settings), startActions(next))
    storage.sessions.save(next)
  }, [load, settings, storage])

  const persist = useCallback(async () => {
    await storage.hands.save(current)
    setHands((hs) => byHandNo([...hs.filter((x) => x.id !== current.id), current]))
  }, [current, storage])

  const api = useMemo(() => {
    /** Record one action at the end of the hand (see Table.play: acting for a later player fills in the ones before). */
    const act = (action) => {
      remember()
      const next = [...actions, ...Table.play(table, action, nextId(actions)).entries]
      setActions(next)
      // The hand in progress gets its time with its first action; a saved hand open for editing keeps its own (or none).
      if (!past && !editing) {
        const stamped = withStartTime(base, next, new Date().toISOString())
        if (stamped !== base) setBase(stamped)
      }
    }
    /** An edit's result: the new entries, and a notice when later turns no longer fitted and were taken out. */
    const edited = ({ actions: next, removed }) => {
      remember()
      setActions(next)
      if (removed) setNotice({ text: `${removed} later ${removed === 1 ? 'action no longer fits and was' : 'actions no longer fit and were'} taken out`, key: Date.now() })
    }
    /** Who sits out this hand, also kept for the hands after it (not for a saved hand being edited). */
    const setOut = (out) => {
      if (!editing) {
        const s = withSitOuts(session, out)
        setSession(s)
        storage.sessions.save(s)
      }
      edited(Table.withSeatsOut(tableBase, actions, out))
    }
    const changePlayer = (next) => {
      remember()
      setSession(next)
      storage.sessions.save(next)
      if (editing) setEditing({ ...editing, base: { ...editing.base, ...handExtras(next, settings) } })
      else setBase({ ...base, ...handExtras(next, settings) })
    }
    return {
      act,
      /** Change the turn at entry `i` to `choice` ({ kind, amount? }); what follows is checked again. */
      change: (i, choice) => edited(Table.changeTurn(tableBase, actions, i, choice)),
      /** Take back End Street (and the turns it filled in) or End Hand at entry `i`. */
      reopen: (i) => edited(Table.reopen(tableBase, actions, i)),
      /** Take back End Hand, so the betting goes on where it stopped. */
      continueHand: () => {
        const i = actions.findIndex((a) => a.type === 'end')
        if (i >= 0) edited(Table.reopen(tableBase, actions, i))
      },
      setOut,
      setDealer: (seat) => edited(Table.withDealer(tableBase, actions, seat)),
      /** The table as it was just before entry `i`, the player whose turn it was, and their choices then. */
      turnAt: (i) => Table.turnAt(tableBase, actions, i),
      /** The board so far (up to five cards). */
      setBoard: (cards) => {
        if (cards.join() === (base.board ?? []).join()) return
        remember()
        setBase({ ...base, board: [...cards] })
      },
      /** A player's cards (one or two; none takes them away), at any point. */
      show: (seat, cards) => {
        const shown = { ...(base.shown ?? {}) }
        if (cards.length) shown[seat] = [...cards]
        else delete shown[seat]
        remember()
        setBase({ ...base, shown })
      },
      dismissNotice: () => setNotice(null),
      /** Step back once: the state before the last change, with storage put back to match. */
      undo: async () => {
        const snap = history[history.length - 1]
        if (!snap) return
        setHistory((h) => h.slice(0, -1))
        setSession(snap.session)
        load(snap.base, snap.actions, snap.note)
        setEditing(snap.editing)
        setNotice(null)
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
        if (!Table.isOver(table)) return setActions([...actions, ...Table.play(table, { type: 'end' }, nextId(actions)).entries])
        await persist()
        restart(withNextHand(session, table.dealerSeat))
      },
      /** Reopen a saved hand in place of the current one; the current one is kept aside until Save or Cancel. */
      openHand: (r) => {
        remember()
        if (!editing) setEditing({ base, actions, note })
        load(r.base, r.actions, r.note ?? '')
      },
      /** Delete a saved hand of this session (one step back on Undo, which saves it again). */
      deleteHand: async (r) => {
        remember()
        if (editing && current.id === r.id) {
          load(editing.base, editing.actions, editing.note) // it was open for editing: back to the hand in progress
          setEditing(null)
        }
        setHands((hs) => hs.filter((x) => x.id !== r.id))
        await storage.hands.remove(r.id)
      },
      saveEdit: async () => {
        remember()
        await persist()
        if (past) return onClose?.()
        load(editing.base, editing.actions, editing.note)
        setEditing(null)
      },
      cancelEdit: () => {
        if (past) return onClose?.()
        remember()
        load(editing.base, editing.actions, editing.note)
        setEditing(null)
      },
      /** Replace this hand's note ('' clears it). */
      saveNote: (text) => {
        if (text.trim() === note) return
        remember()
        setNote(text.trim())
      },
      /** A player's stack size or total buy-in in chips, from the menu: from now on, this hand included (the hand in
       *  progress; a saved hand open for editing keeps what it had). */
      setStack: (seat, stack) => changePlayer(withStack(session, seat, stack)),
      setBuyIn: (seat, buyIn) => changePlayer(withBuyIn(session, seat, buyIn)),
      /** Sit a player out or back in from the menu: this hand too while nothing is entered yet, else from the next hand. */
      toggleSitOut: (seat) => {
        const target = session.seats.find((s) => s.seat === seat)
        const next = withSittingOut(session, seat, !target.sittingOut)
        if (activeSeats(next).length < 2) return
        remember()
        if (!started && !editing) setActions(startActions(next))
        setSession(next)
        storage.sessions.save(next)
      },
    }
  }, [actions, base, current, editing, started, hands, history, load, note, onClose, past, persist, remember, restart, session, settings, storage, table, tableBase])

  return {
    session,
    settings,
    /** The current hand in the question-based model (positions, shown hands, hero cards). */
    hand: current.hand,
    hands,
    editing: editing !== null,
    /** A saved hand of a finished session, opened from History. */
    past,
    table,
    actions,
    note,
    /** Each player's stack size and total buy-in at this hand (empty for hands saved before them). */
    stacks: base.stacks ?? {},
    buyIns: base.buyIns ?? {},
    /** The betting as log rows (see Table.logRows). */
    log: Table.logRows(tableBase, actions),
    /** For a moment after an edit took later turns out: { text, key }. */
    notice,
    /** Something beyond who sits out has been entered in this hand. */
    started,
    canUndo: history.length > 0,
    /** The hand was ended with End Hand (not by its betting), so it can go on. */
    canContinue: actions.some((a) => a.type === 'end'),
    inCardsPhase: Table.isOver(table),
    ...api,
  }
}
