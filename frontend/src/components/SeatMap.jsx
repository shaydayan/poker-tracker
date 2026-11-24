// Players around an oval table, me at the bottom centre, the others clockwise from me. Every seat is a Button.
// `enabled` limits who can be tapped; `readOnly` shows the table as context only (slightly faded, nothing tappable).
// Every seat shows two lines, name and `status` (blind, last bet or raise, shown cards), so nothing moves when a status appears.
// `hands` shows the cards a player showed beside their seat, toward the middle of the table, so they never cover the seat.
// `board` ({ count, cards, caption, sub, onPick }) draws the five community-card places in the middle: `count` of them
// dealt, the known ones as their card, a caption under them (and `sub`, a second line, when given); with `onPick` the
// board is a button (to pick its cards).
// `fill` spreads the table over all the space it is given instead of a short strip, with room under every seat for
// `below[seat]` (that player's own controls, a fixed height so nothing moves), and `bets[seat]` ({ text, tone: 'call' |
// 'raise' | 'allin' | 'check' }) as a chip on the felt in front of the seat; the seats look the same.
import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from './Button.jsx'
import { Pill } from './Pill.jsx'
import { orderFrom } from '../domain/positions.js'
import { cardLabel, isRed } from '../domain/cards.js'

/** With `fill`: each seat's space, the seat on top and `below` under it (px). */
const POD = { w: 112, h: 140, below: 92 }

export function SeatMap({ seats, names, heroSeat, enabled, readOnly = false, active, tones = {}, badges = {}, status = {}, hands = {}, board, onPick, fill = false, below = {}, bets = {} }) {
  const [ref, box] = useBox()
  const order = [heroSeat, ...orderFrom(seats, heroSeat).filter((s) => s !== heroSeat)]
  const n = order.length
  const { scale, spots } = fill && box ? fitAround(n, box) : { scale: 1, spots: [] }

  const seatButton = (s) => (
    <>
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
      {badges[s] && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-bg ring-1 ring-bg">{badges[s]}</span>
      )}
    </>
  )

  return (
    <div ref={ref} className={`relative w-full ${fill ? 'h-full' : 'h-52'} ${readOnly ? 'opacity-70' : ''}`}>
      <div
        className={`absolute rounded-[50%] border border-line bg-panel/40 ${fill ? '' : 'inset-x-14 inset-y-7'}`}
        style={fill ? { left: POD.w / 2, right: POD.w / 2, top: POD.h / 2, bottom: POD.h / 2 } : undefined}
      />
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
          {board.sub !== undefined && <span className="h-3.5 max-w-40 truncate text-[10px]">{board.sub}</span>}
        </button>
      )}
      {fill
        ? spots.map((p, i) => {
            const s = order[i]
            return (
              <div key={s} className="absolute flex flex-col items-center" style={{ left: p.x, top: p.y, width: POD.w, height: POD.h, transform: `translate(-50%, -50%) scale(${scale})` }}>
                <div className="relative">{seatButton(s)}</div>
                <div className="mt-1 w-full" style={{ height: POD.below }}>{below[s]}</div>
              </div>
            )
          })
        : order.map((s, i) => {
            const a = Math.PI / 2 + (i * 2 * Math.PI) / n
            const x = 50 + 38 * Math.cos(a)
            const y = 50 + 40 * Math.sin(a)
            return (
              <div key={s} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                {seatButton(s)}
                {hands[s] && (
                  <span className={`absolute left-1/2 flex -translate-x-1/2 gap-0.5 ${y < 50 ? 'top-full mt-0.5' : 'bottom-full mb-0.5'}`} aria-label={`${names[s]} shows`}>
                    {Array.isArray(hands[s]) ? hands[s].map((c) => <Card key={c} card={c} dealt />) : <Pill tone="accent">{hands[s]}</Pill>}
                  </span>
                )}
              </div>
            )
          })}
      {fill &&
        spots.map((p, i) => {
          const bet = bets[order[i]]
          return bet ? <Bet key={`bet${order[i]}`} bet={bet} at={betSpot(p, scale)} scale={scale} /> : null
        })}
    </div>
  )
}

/** Each bet's marker: a round chip (white for a call, red for a bet or raise), a red triangle for all-in. */
const CHIP = { call: 'h-2.5 w-2.5 rounded-full bg-ink', raise: 'h-2.5 w-2.5 rounded-full bg-raise', allin: 'h-2.5 w-3 bg-raise [clip-path:polygon(50%_0,100%_100%,0_100%)]' }

/** A seat's bet on the felt: a chip in the colour of what they did, and the amount (a check has no chip). */
function Bet({ bet, at, scale }) {
  return (
    <span
      className={`absolute flex h-4 items-center gap-1 rounded-full bg-bg/80 px-1.5 text-[10px] font-semibold whitespace-nowrap ${bet.tone === 'check' ? 'text-muted' : ''}`}
      style={{ left: at.x, top: at.y, transform: `${at.shift} scale(${scale})` }}
    >
      {CHIP[bet.tone] && <span className={`ring-1 ring-bg ${CHIP[bet.tone]}`} />}
      {bet.text}
    </span>
  )
}

/** Where a seat's bet goes: toward the middle of the table, just clear of the seat. */
function betSpot(p, scale) {
  const w = (POD.w * scale) / 2 + 3
  const h = (POD.h * scale) / 2 + 2
  if (p.bet === 'up') return { x: p.x, y: p.y - h, shift: 'translate(-50%, -100%)' }
  if (p.bet === 'down') return { x: p.x, y: p.y + h, shift: 'translate(-50%, 0)' }
  if (p.bet === 'right') return { x: p.x + w, y: p.y, shift: 'translate(0, -50%)' }
  return { x: p.x - w, y: p.y, shift: 'translate(-100%, -50%)' }
}

/** The element's size, kept up to date. */
function useBox() {
  const ref = useRef(null)
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box]
}

/** The seats for the whole space at full size, or shrunk just enough that none overlap (a short screen with many
 *  players). */
function fitAround(n, box) {
  let found = null
  for (let scale = 1; scale >= 0.6; scale -= 0.02) {
    const spots = aroundBox(n, box, scale)
    found = { scale, spots }
    const apart = spots.every((p, i) => spots.slice(i + 1).every((q) => Math.abs(p.x - q.x) >= POD.w * scale + 2 || Math.abs(p.y - q.y) >= POD.h * scale + 2))
    if (apart) break
  }
  return found
}

/** Seat centres for the whole space (seats drawn at `scale`): me at the bottom centre, then clockwise up the left side, one at the top centre
 *  when the others are odd in number, and down the right side; symmetric left to right. Two side columns keep seats
 *  apart at the corners, so nine fit on a phone. */
function aroundBox(n, { w, h }, scale) {
  const l = (POD.w * scale) / 2 + 2
  const r = w - (POD.w * scale) / 2 - 2
  const t = (POD.h * scale) / 2 + 2
  const b = h - (POD.h * scale) / 2 - 2
  const others = n - 1
  const top = others % 2
  const side = (others - top) / 2
  // Each side from low to high: the full height for four, a little above my row for fewer, the upper part for one.
  const from = side >= 4 ? b : b - (b - t) * 0.25
  const ys = side === 1 ? [t + (b - t) * 0.25] : Array.from({ length: side }, (_, j) => from - ((from - t) * j) / (side - 1))
  // A bet sits toward the middle: beside a side seat, above one on my row, below one on the top row beside a top seat.
  const toward = (y, inward) => (y === b ? 'up' : top && y === t ? 'down' : inward)
  return [
    { x: w / 2, y: b, bet: 'up' },
    ...ys.map((y) => ({ x: l, y, bet: toward(y, 'right') })),
    ...(top ? [{ x: w / 2, y: t, bet: 'down' }] : []),
    ...[...ys].reverse().map((y) => ({ x: r, y, bet: toward(y, 'left') })),
  ]
}

/** One card: face up when known (red for hearts and diamonds), filled when dealt but unknown (face down), an outline when
 *  not dealt. `small` for a player's cards under their seat. */
export function Card({ card, dealt, small = false }) {
  const look = card ? `border border-line bg-ink/90 ${isRed(card) ? 'text-raise' : 'text-bg'}` : dealt ? 'border border-accent/70 bg-accent/30' : 'border border-dashed border-line'
  return <span className={`flex items-center justify-center rounded font-bold ${small ? 'h-6 w-[18px] text-[9px]' : 'h-8 w-6 text-[10px]'} ${look}`}>{card ? cardLabel(card) : ''}</span>
}
