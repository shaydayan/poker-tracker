// Sitting players out or back in, you included. While nothing beyond that is entered in the hand it changes this hand;
// after that it applies from the next hand (this hand's Sitting Out row changes this one). At least two must play.
import { Button } from '../../components/Button.jsx'
import { Sheet } from '../../components/Sheet.jsx'

export function MenuSheet({ open, onClose, session, started, onToggleSitOut }) {
  const playing = session.seats.filter((s) => !s.sittingOut).length
  return (
    <Sheet open={open} title="Players" onClose={onClose}>
      <div className="mb-3 h-8 text-xs text-muted">
        {started ? 'Changes apply from the next hand. To change this hand, tap its Sitting Out row.' : 'Changes apply to this hand and the ones after it.'}
      </div>
      <div className="flex flex-col gap-2">
        {session.seats.map((s) => (
          <div key={s.seat} className="flex items-center gap-2">
            <div className={`flex-1 text-sm ${s.sittingOut ? 'text-muted' : ''}`}>{s.name}{s.seat === session.heroSeat ? ' (you)' : ''}</div>
            <Button className="w-24" disabled={!s.sittingOut && playing <= 2} onClick={() => onToggleSitOut(s.seat)}>{s.sittingOut ? 'Return' : 'Sit Out'}</Button>
          </div>
        ))}
        <Button variant="primary" className="mt-2" onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  )
}
