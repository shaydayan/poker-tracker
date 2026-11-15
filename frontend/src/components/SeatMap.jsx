// Players around an oval table, me at the bottom centre, the others clockwise from me. Every seat is a Button.
// `enabled` limits who can be tapped; `readOnly` shows the table as context only (slightly faded, nothing tappable).
// Every seat shows two lines, name and `status` (blind, last bet or raise, shown cards), so nothing moves when a status appears.
// `hands` shows the cards a player showed beside their seat, toward the middle of the table, so they never cover the seat.
// `board` ({ count, cards, caption, onPick }) draws the five community-card places in the middle: `count` of them dealt,
// the known ones as their card, a caption under them; with `onPick` the board is a button (to pick its cards).
import { Button } from './Button.jsx'
import { Pill } from './Pill.jsx'
import { orderFrom } from '../domain/positions.js'
import { cardLabel, isRed } from '../domain/cards.js'

export function SeatMap({ seats, names, heroSeat, enabled, readOnly = false, active, tones = {}, badges = {}, status = {}, hands = {}, board, onPick }) {
  const order = [heroSeat, ...orderFrom(seats, heroSeat).filter((s) => s !== heroSeat)]
  const n = order.length
  return (
    <div className={`relative h-52 w-full ${readOnly ? 'opacity-70' : ''}`}>
      <div className="absolute inset-x-14 inset-y-7 rounded-[50%] border border-line bg-panel/40" />
      {board && (
        <button
          type="button"
          aria-label={`Board ${board.count} cards`}
          disabled={!board.onPick}
          className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 active:opacity-70 ${readOnly ? 'pointer-events-none' : ''}`}
          onClick={board.onPick}
        >
          <span className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => {
              const card = board.cards?.[i]
              return <Card key={i} card={card} dealt={i < board.count} />
            })}
          </span>
          <span className="h-3.5 text-[10px] text-muted">{board.caption}</span>
        </button>
      )}
      {order.map((s, i) => {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / n
        const x = 50 + 38 * Math.cos(a)
        const y = 50 + 40 * Math.sin(a)
        return (
          <div key={s} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <Button
              aria-label={names[s]}
              size="sm"
              variant={tones[s] ?? 'secondary'}
              active={active === s}
              disabled={enabled ? !enabled.includes(s) : false}
              className={`h-11 w-20 px-1 ${readOnly ? 'pointer-events-none' : ''}`}
              onClick={() => onPick && onPick(s)}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="max-w-full truncate">{names[s]}</span>
                <span className="h-3.5 text-[10px] font-normal opacity-80">{status[s] ?? ''}</span>
              </span>
            </Button>
            {hands[s] && (
              <span className={`absolute left-1/2 flex -translate-x-1/2 gap-0.5 ${y < 50 ? 'top-full mt-0.5' : 'bottom-full mb-0.5'}`} aria-label={`${names[s]} shows`}>
                {Array.isArray(hands[s]) ? hands[s].map((c) => <Card key={c} card={c} dealt />) : <Pill tone="accent">{hands[s]}</Pill>}
              </span>
            )}
            {badges[s] && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">{badges[s]}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** One card: face up when known (red for hearts and diamonds), filled when dealt but unknown, an outline when not dealt. */
function Card({ card, dealt }) {
  const look = card ? `border border-line bg-ink/90 ${isRed(card) ? 'text-raise' : 'text-bg'}` : dealt ? 'border border-accent/70 bg-accent/30' : 'border border-dashed border-line'
  return <span className={`flex h-8 w-6 items-center justify-center rounded text-[10px] font-bold ${look}`}>{card ? cardLabel(card) : ''}</span>
}
