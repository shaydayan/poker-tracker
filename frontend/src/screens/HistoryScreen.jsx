// Every past session. Tap one to see its hands, and a hand to see it street by street; Edit Hand opens it on the Hand
// screen (over this list) to change it like a hand of the session in progress, then Save Changes or Cancel comes back
// here. Long-press a session or a hand to delete it (after a confirmation; a deleted session takes its hands with it).
// Filter narrows the open session's hands: by the players in them and what they did, the dealer, the kind and size of the pot,
// cards shown and notes.
// Stays mounted while other tabs are shown, so a hand half-edited here is not lost; the list is read again when shown.
import { useEffect, useState } from 'react'
import { useStorage } from '../app/StorageContext.jsx'
import { useHandCapture } from '../app/useHandCapture.js'
import { Button } from '../components/Button.jsx'
import { Row } from '../components/Row.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { MIN_POTS, NO_FILTER, POT_TYPES, ROLES, isFiltering, matches } from '../domain/history.js'
import { recordFacts, recordLabel, recordLines, recordSummary } from '../domain/record.js'
import { ConfirmSheet } from './ConfirmSheet.jsx'
import { HandScreen } from './HandScreen.jsx'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const heading = 'mt-4 mb-2 text-xs text-muted'

/** One choice from a few options, as a row of equal buttons. */
function Choice({ options, value, onChange }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => <Button key={o.id} size="sm" active={value === o.id} onClick={() => onChange(o.id)}>{o.label}</Button>)}
    </div>
  )
}

/** The hand filter: players and what they did, the dealer, the kind of pot, its size, cards shown, notes. Applies as you tap. */
function FilterSheet({ open, players, filter, onChange, onClose }) {
  const set = (patch) => onChange({ ...filter, ...patch })
  const toggle = (name) => set({ players: filter.players.includes(name) ? filter.players.filter((p) => p !== name) : [...filter.players, name] })
  return (
    <Sheet open={open} title="Filter Hands" onClose={onClose}>
      <div className="mb-2 text-xs text-muted">Players</div>
      <div className="flex flex-wrap gap-2">
        {players.map((name) => (
          <Button key={name} size="sm" className="w-20 truncate" active={filter.players.includes(name)} onClick={() => toggle(name)}>{name}</Button>
        ))}
      </div>
      <div className="mt-2">
        <Choice options={ROLES} value={filter.role} onChange={(role) => set({ role })} />
      </div>
      <div className={heading}>Dealer</div>
      <div className="flex flex-wrap gap-2">
        {players.map((name) => (
          <Button key={name} size="sm" className="w-20 truncate" active={filter.dealer === name} onClick={() => set({ dealer: filter.dealer === name ? null : name })}>{name}</Button>
        ))}
      </div>
      <div className={heading}>Pot Type</div>
      <Choice options={POT_TYPES} value={filter.potType} onChange={(potType) => set({ potType })} />
      <div className={heading}>Pot Size</div>
      <Choice options={MIN_POTS} value={filter.minPot} onChange={(minPot) => set({ minPot })} />
      <div className={heading}>Hands</div>
      <div className="flex gap-2">
        <Button size="sm" className="w-28" active={filter.shown} onClick={() => set({ shown: !filter.shown })}>Cards Shown</Button>
        <Button size="sm" className="w-28" active={filter.notes} onClick={() => set({ notes: !filter.notes })}>With Notes</Button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="ghost" disabled={!isFiltering(filter)} onClick={() => onChange(NO_FILTER)}>Clear</Button>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  )
}

/** A saved hand of a finished session, open for editing on the Hand screen. */
function PastHand({ session, record, settings, onClose }) {
  const c = useHandCapture(session, settings, { open: record, onClose })
  return <HandScreen c={c} />
}

export function HistoryScreen({ settings, active }) {
  const storage = useStorage()
  const [sessions, setSessions] = useState([])
  const [open, setOpen] = useState(null) // session id
  const [hands, setHands] = useState({}) // session id -> records
  const [openHand, setOpenHand] = useState(null) // record id
  const [doomed, setDoomed] = useState(null) // { session } or { hand } waiting for the delete to be confirmed
  const [editing, setEditing] = useState(null) // { session, record } open on the Hand screen
  const [filter, setFilter] = useState(NO_FILTER)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    if (!active) return
    storage.sessions.list().then((all) => setSessions(all.filter((s) => s.ended).sort((a, b) => (a.date < b.date ? 1 : -1))))
  }, [storage, active])

  const handsOf = async (id) => {
    if (hands[id]) return hands[id]
    const list = await storage.hands.listBySession(id)
    setHands((h) => ({ ...h, [id]: list }))
    return list
  }
  const toggle = async (id) => {
    if (open === id) return setOpen(null)
    setOpen(id)
    // The filter stays, without players who were not in this session.
    const names = sessions.find((s) => s.id === id).seats.map((x) => x.name)
    setFilter((f) => ({ ...f, players: f.players.filter((p) => names.includes(p)), dealer: names.includes(f.dealer) ? f.dealer : null }))
    await handsOf(id)
  }
  // Back from editing: the session's hands as saved now.
  const closeEdit = async () => {
    const id = editing.session.id
    setEditing(null)
    const list = await storage.hands.listBySession(id)
    setHands((h) => ({ ...h, [id]: list }))
  }
  const openSession = sessions.find((s) => s.id === open) ?? null
  const players = openSession ? openSession.seats.map((x) => x.name) : []
  const filtering = isFiltering(filter)
  const allHands = hands[open] ?? []
  const shownHands = filtering ? allHands.filter((r) => matches(recordFacts(r), filter)) : allHands
  const askSession = async (s) => setDoomed({ session: s, count: (await handsOf(s.id)).length })
  const confirm = async () => {
    if (doomed.session) {
      await storage.sessions.remove(doomed.session.id)
      setSessions((ss) => ss.filter((s) => s.id !== doomed.session.id))
    } else {
      await storage.hands.remove(doomed.hand.id)
      setHands((h) => ({ ...h, [doomed.hand.sessionId]: h[doomed.hand.sessionId].filter((r) => r.id !== doomed.hand.id) }))
    }
    setDoomed(null)
  }
  const message = doomed?.session
    ? `Delete the session of ${doomed.session.date} with its ${plural(doomed.count, 'hand')}? This can't be undone.`
    : doomed?.hand
      ? `Delete hand #${doomed.hand.handNo} (${recordSummary(doomed.hand)})? This can't be undone.`
      : null

  return (
    <div className="relative flex h-full flex-col">
      <TopBar
        title="History"
        subtitle={`${openSession && filtering ? `${shownHands.length} of ${plural(allHands.length, 'hand')}` : plural(sessions.length, 'past session')} · long-press to delete`}
        right={<Button size="sm" className="w-16" active={filtering} disabled={!openSession} onClick={() => setFilterOpen(true)}>Filter</Button>}
      />
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && <div className="p-3 text-xs text-muted">No finished sessions yet.</div>}
        {sessions.map((s) => (
          <div key={s.id} className="border-b border-line">
            <Row
              label={s.date}
              text={`${s.seats.length} players · ${s.seats.map((x) => x.name).join(', ')}`}
              trailing={open === s.id ? '▾' : '▸'}
              active={open === s.id}
              onClick={() => toggle(s.id)}
              onLongPress={() => askSession(s)}
            />
            {open === s.id && (
              <div className="bg-panel/50">
                {shownHands.map((r) => (
                  <div key={r.id}>
                    <Row
                      label={recordLabel(r)}
                      text={recordSummary(r)}
                      trailing={openHand === r.id ? '▾' : '▸'}
                      active={openHand === r.id}
                      onClick={() => setOpenHand(openHand === r.id ? null : r.id)}
                      onLongPress={() => setDoomed({ hand: r })}
                    />
                    {openHand === r.id && (
                      <div className="pl-4">
                        {recordLines(r).map((l) => <Row key={l.label} label={l.label} text={l.text} wrap />)}
                        <div className="px-3 py-2">
                          <Button size="sm" className="w-28" onClick={() => setEditing({ session: s, record: r })}>Edit Hand</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {hands[s.id]?.length === 0 && <div className="h-9 px-3 text-xs leading-9 text-muted">No hands recorded.</div>}
                {allHands.length > 0 && shownHands.length === 0 && <div className="h-9 px-3 text-xs leading-9 text-muted">No hands match the filter.</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <div className="absolute inset-0 z-10 bg-bg">
          <PastHand key={editing.record.id} session={editing.session} record={editing.record} settings={settings} onClose={closeEdit} />
        </div>
      )}
      <FilterSheet open={filterOpen} players={players} filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />
      <ConfirmSheet title={doomed?.session ? 'Delete Session' : 'Delete Hand'} message={message} action="Delete" onConfirm={confirm} onCancel={() => setDoomed(null)} />
    </div>
  )
}
