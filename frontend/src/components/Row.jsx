// A tappable list row: short label on the left, value in the middle, optional trailing mark. Fixed height.
// `muted` fades a row that is only there for context (not tappable); `wrap` lets a long text run onto more lines
// (the row grows from its usual height instead of cutting the text off); `onLongPress` fires on a press held for half a
// second (or a right-click on a computer), and that press does not also count as a tap.
import { useRef } from 'react'

const HOLD_MS = 500
const MOVE_PX = 10 // a finger that moves this far is scrolling, not pressing

export function Row({ label, text, trailing, active = false, muted = false, wrap = false, onClick, onLongPress }) {
  const timer = useRef(null)
  const start = useRef(null)
  const held = useRef(false)
  const stop = () => clearTimeout(timer.current)
  const fire = () => {
    stop()
    if (held.current) return
    held.current = true
    navigator.vibrate?.(15)
    onLongPress()
  }
  const press = onLongPress
    ? {
        onPointerDown: (e) => {
          held.current = false
          start.current = { x: e.clientX, y: e.clientY }
          timer.current = setTimeout(fire, HOLD_MS)
        },
        onPointerMove: (e) => {
          if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_PX) stop()
        },
        onPointerUp: stop,
        onPointerLeave: stop,
        onPointerCancel: stop,
        onContextMenu: (e) => {
          e.preventDefault()
          fire()
        },
      }
    : {}
  return (
    <button
      type="button"
      aria-label={`${label} ${text}`}
      className={`flex w-full items-center gap-2 px-3 text-xs [-webkit-touch-callout:none] ${wrap ? 'min-h-9 py-2' : 'h-9'} active:opacity-70 ${active ? 'bg-panel' : ''} ${muted ? 'pointer-events-none opacity-50' : ''}`}
      onClick={() => {
        if (held.current) held.current = false // the end of a long press, not a tap
        else onClick?.()
      }}
      {...press}
    >
      <span className="w-20 shrink-0 text-left text-muted">{label}</span>
      <span className={`flex-1 text-left ${wrap ? '' : 'truncate'}`}>{text}</span>
      <span className="w-4 text-muted">{trailing}</span>
    </button>
  )
}
