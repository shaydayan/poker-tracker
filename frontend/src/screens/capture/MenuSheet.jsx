// Sitting players out or back in.
import { Button } from '../../components/Button.jsx'
import { Sheet } from '../../components/Sheet.jsx'

export function MenuSheet({ open, onClose, session, onToggleSitOut }) {
  return (
    <Sheet open={open} title="Players" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {session.seats.map((s) => (
          <div key={s.seat} className="flex items-center gap-2">
            <div className={`flex-1 text-sm ${s.sittingOut ? 'text-muted' : ''}`}>{s.name}</div>
            <Button className="w-24" disabled={s.seat === session.heroSeat} onClick={() => onToggleSitOut(s.seat)}>{s.sittingOut ? 'Return' : 'Sit Out'}</Button>
          </div>
        ))}
        <Button variant="primary" className="mt-2" onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  )
}
