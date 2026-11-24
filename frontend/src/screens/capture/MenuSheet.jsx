// Each player, you included: total buy-in and stack size (tap a player for their sliders), and sitting out. Buy-in and
// stack apply from now on, this hand included. Sitting out changes this hand while nothing beyond it is entered, after
// that it applies from the next hand (this hand's Sitting Out row changes this one). At least two must play.
import { useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { Row } from '../../components/Row.jsx'
import { Sheet } from '../../components/Sheet.jsx'
import { buyInOf, stackLabel, stackOf } from '../../domain/session.js'
import { PlayerSheet } from './PlayerSheet.jsx'

export function MenuSheet({ open, onClose, session, settings, started, onToggleSitOut, onStack, onBuyIn }) {
  const [chips, setChips] = useState(null) // seat whose buy-in and stack are open
  const playing = session.seats.filter((s) => !s.sittingOut).length
  const seat = session.seats.find((s) => s.seat === chips)
  const name = (s) => `${s.name}${s.seat === session.heroSeat ? ' (you)' : ''}`
  return (
    <>
      <Sheet open={open} title="Players" onClose={onClose}>
        <div className="mb-3 h-8 text-xs text-muted">
          {started ? 'Sitting out applies from the next hand; tap the Sitting Out row to change this one. Buy-in and stack apply now.' : 'Changes apply to this hand and the ones after it.'}
        </div>
        <div className="mb-1 flex items-center gap-2 px-3 text-xs text-muted">
          <span className="w-20">Player</span>
          <span className="flex-1">Buy-In · Stack</span>
        </div>
        <div className="flex flex-col">
          {session.seats.map((s) => (
            <div key={s.seat} className="flex items-center gap-2 border-b border-line">
              <div className={`min-w-0 flex-1 ${s.sittingOut ? 'opacity-50' : ''}`}>
                <Row label={name(s)} text={`${buyInOf(s, settings)} · ${stackLabel(stackOf(s))}`} trailing="▸" onClick={() => setChips(s.seat)} />
              </div>
              <Button size="sm" className="w-20" disabled={!s.sittingOut && playing <= 2} onClick={() => onToggleSitOut(s.seat)}>{s.sittingOut ? 'Return' : 'Sit Out'}</Button>
            </div>
          ))}
          <Button variant="primary" className="mt-3" onClick={onClose}>Done</Button>
        </div>
      </Sheet>
      <PlayerSheet open={open} title={seat && name(seat)} seat={seat} settings={settings} onStack={onStack} onBuyIn={onBuyIn} onClose={() => setChips(null)} />
    </>
  )
}
