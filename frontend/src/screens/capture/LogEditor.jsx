// What opens from a log row (see LogRows), one sheet for each kind, each making one change and closing:
// - a player's turn: what they could do at that point (lit: what they did), a bet or raise asks the amount;
// - End Street: take it back, with the turns it filled in; End Hand: take it back (the betting goes on);
// - the dealer, who sits out: picked on the table.
// What comes after a change is checked again; anything that no longer fits is taken out (the Hand screen says so).
// `edit` is the row's { kind, index? } (null: closed).
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { SeatMap } from '../../components/SeatMap.jsx'
import { Sheet } from '../../components/Sheet.jsx'
import * as Table from '../../domain/table.js'
import { CHOICE_VARIANT, TurnAmount, choiceLabel } from './Steps.jsx'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** Which of a player's choices their entry is. */
function kindOf(a, t) {
  if (a.type === 'straddle') return 'straddle'
  if (a.type === 'call') return a.check ? 'check' : 'call'
  if (a.type === 'raise') return t.highest === 0 ? 'bet' : 'raise'
  return a.type
}

export function LogEditor({ c, edit, onClose }) {
  const t = c.table
  const names = t.players
  const [amount, setAmount] = useState(null) // 'raise' | 'allin' while its amount is picked
  const [out, setOut] = useState([])
  useEffect(() => {
    setAmount(null)
    if (edit?.kind === 'out') setOut(t.out)
  }, [edit]) // eslint-disable-line react-hooks/exhaustive-deps

  const done = (fn) => {
    fn()
    onClose()
  }
  const entry = edit?.index != null ? c.actions[edit.index] : null

  if (edit?.kind === 'turn' && entry) {
    const at = c.turnAt(edit.index)
    const now = kindOf(entry, at.t)
    const pick = (o) => (o.kind === 'raise' || o.kind === 'bet' || o.kind === 'allin' ? setAmount(o.kind === 'allin' ? 'allin' : 'raise') : done(() => c.change(edit.index, o)))
    return (
      <Sheet open title={`${names[at.seat]} · ${cap(entry.street ?? at.t.street)}`} onClose={onClose}>
        {amount ? (
          <TurnAmount t={at.t} seat={at.seat} kind={amount} current={entry.amount} onAnswer={(v) => done(() => c.change(edit.index, { kind: amount, amount: v }))} onCancel={() => setAmount(null)} />
        ) : (
          <>
            <div className="mb-3 h-4 text-xs text-muted">What they did then; the actions after it are checked again.</div>
            <div className="grid grid-cols-2 gap-2">
              {at.choices.map((o) => (
                <Button key={o.kind} variant={CHOICE_VARIANT[o.kind] ?? 'secondary'} active={o.kind === now} onClick={() => pick(o)}>{choiceLabel(o)}</Button>
              ))}
            </div>
            <Button variant="ghost" className="mt-3 w-full" onClick={onClose}>Cancel</Button>
          </>
        )}
      </Sheet>
    )
  }

  if (edit?.kind === 'mark' && entry) {
    const street = entry.type === 'street-end'
    const n = street ? Table.filledBy(c.actions, edit.index) : 0
    return (
      <Sheet open title={street ? `End Street · ${cap(entry.street)}` : 'End Hand'} onClose={onClose}>
        <div className="mb-3 text-xs text-muted">
          {street
            ? `Takes back End Street${n ? ` and the ${n} ${n === 1 ? 'turn' : 'turns'} it filled in` : ''}: those players are to act again.`
            : 'Takes back End Hand: the betting goes on where it stopped.'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => done(() => c.reopen(edit.index))}>{street ? 'Reopen Street' : 'Continue Hand'}</Button>
        </div>
      </Sheet>
    )
  }

  if (edit?.kind === 'dealer') {
    return (
      <Sheet open title="Dealer" onClose={onClose}>
        <div className="mb-1 text-xs text-muted">Tap the dealer; the actions after it are checked again.</div>
        <SeatMap
          seats={t.allSeats}
          names={names}
          heroSeat={t.heroSeat}
          enabled={t.seats}
          active={t.dealerSeat}
          tones={Object.fromEntries(t.allSeats.map((s) => [s, t.out.includes(s) ? 'ghost' : 'surface']))}
          badges={t.dealerSeat != null ? { [t.dealerSeat]: 'D' } : {}}
          onPick={(s) => done(() => s !== t.dealerSeat && c.setDealer(s))}
        />
        <Button variant="ghost" className="mt-3 w-full" onClick={onClose}>Cancel</Button>
      </Sheet>
    )
  }

  if (edit?.kind === 'out') {
    const playing = t.allSeats.length - out.length
    return (
      <Sheet open title="Sitting Out" onClose={onClose}>
        <div className="mb-1 text-xs text-muted">Tap to switch; the actions after it are checked again.</div>
        <SeatMap
          seats={t.allSeats}
          names={names}
          heroSeat={t.heroSeat}
          status={Object.fromEntries(out.map((s) => [s, 'Out']))}
          tones={Object.fromEntries(t.allSeats.map((s) => [s, out.includes(s) ? 'ghost' : 'surface']))}
          onPick={(s) => setOut(out.includes(s) ? out.filter((x) => x !== s) : [...out, s].sort((a, b) => a - b))}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={playing < 2} onClick={() => done(() => out.join() !== t.out.join() && c.setOut(out))}>{playing < 2 ? 'At Least Two' : 'Done'}</Button>
        </div>
      </Sheet>
    )
  }

  return null
}
