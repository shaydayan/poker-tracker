// One player's sheet: `top` (this player's other controls, when given) and their total buy-in and stack size as sliders
// (left out with `chips={false}`). Used from the Players menu and from a seat in the table view.
import { Button } from '../../components/Button.jsx'
import { Sheet } from '../../components/Sheet.jsx'
import { Slider } from '../../components/Slider.jsx'
import { STACKS, buyInOf, buyInValues, stackLabel, stackOf } from '../../domain/session.js'

const heading = 'mt-4 mb-1 text-xs text-muted'

export function PlayerSheet({ open, title, seat, settings, top, chips = true, onStack, onBuyIn, onClose }) {
  const sliders = seat && chips && (
    <div>
      <div className={heading}>Buy-In (all so far)</div>
      <Slider value={buyInOf(seat, settings)} values={buyInValues(settings.buyIn)} onChange={(v) => onBuyIn(seat.seat, v)} />
      <div className={heading}>Stack</div>
      <Slider value={stackOf(seat)} values={STACKS.map((k) => k.id)} onChange={(v) => onStack(seat.seat, v)} format={stackLabel} />
    </div>
  )
  return (
    <Sheet open={open && !!seat} title={title} onClose={onClose}>
      {seat && (
        <>
          {top}
          {sliders}
          <Button variant="primary" className="mt-4 w-full" onClick={onClose}>Done</Button>
        </>
      )}
    </Sheet>
  )
}
