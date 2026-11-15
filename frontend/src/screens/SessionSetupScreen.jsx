// Before the first hand: a transfer list. Left, the table in seat order (me first, then clockwise); right, the players
// not seated yet. One tap moves a name across; a player sent back returns to the same place in the right-hand list.
import { useState } from 'react'
import { useSessionSetup } from '../app/useSessionSetup.js'
import { Button } from '../components/Button.jsx'
import { Field } from '../components/Field.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { MAX_SEATS } from '../domain/session.js'

/** A name with a trailing mark saying what a tap does. */
const Item = ({ label, mark, ...props }) => (
  <Button size="sm" aria-label={label} {...props}>
    <span className="flex items-center justify-between gap-1">
      <span className="truncate">{label}</span>
      <span className="w-3 text-muted">{mark}</span>
    </span>
  </Button>
)

/** `active` is true while the Session tab is shown: the roster is read again then, so players added in Settings appear. */
export function SessionSetupScreen({ settings, active, onStarted }) {
  const s = useSessionSetup(settings, active, onStarted)
  const [guest, setGuest] = useState(null) // the guest name being typed; null = the sheet is closed
  const seated = s.others.length + 1
  const guestProblem = guest === null ? null : s.guestProblem(guest)
  const addGuest = (e) => { e.preventDefault(); if (guestProblem) return; s.seatGuest(guest); setGuest(null) }

  return (
    <div className="relative flex h-full flex-col">
      <TopBar title="New Session" subtitle="Tap a name to move it across" />
      <div className="flex flex-1 gap-3 overflow-y-auto p-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 text-xs text-muted">At The Table · {seated}/{MAX_SEATS}</div>
          <Item label={`1 · ${s.hero.name} (you)`} mark="" disabled />
          {s.others.map((o, i) => (
            <Item key={o.id ?? `g${o.name}`} label={`${i + 2} · ${o.name}`} mark="✕" onClick={() => s.unseat(i)} />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 text-xs text-muted">Players</div>
          {s.pool.map((p) => (
            <Item key={p.id} label={p.name} mark="+" disabled={s.full} onClick={() => s.seat(p)} />
          ))}
          {s.pool.length === 0 && <div className="flex h-9 items-center text-xs text-muted">Everyone is seated</div>}
          <Button size="sm" variant="primary" disabled={s.full} onClick={() => setGuest('')}>+ Guest</Button>
        </div>
      </div>
      <div className="flex h-20 shrink-0 flex-col justify-center gap-1 border-t border-line px-3">
        <div className="h-4 text-xs text-raise">{s.error ?? ''}</div>
        <Button variant="primary" onClick={s.start}>Start Session</Button>
      </div>

      <Sheet open={guest !== null} title="Add Guest" onClose={() => setGuest(null)}>
        <form className="flex flex-col gap-3" onSubmit={addGuest}>
          <div className="flex flex-col gap-1">
            <Field label="Name" autoFocus placeholder={s.guestDefault} value={guest ?? ''} onChange={(e) => setGuest(e.target.value)} />
            <div className="h-4 text-xs text-raise">{guestProblem ?? ''}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => setGuest(null)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!!guestProblem}>Add</Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
