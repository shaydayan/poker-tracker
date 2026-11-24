// A short message floating over the bottom of the screen for a few seconds, so nothing on the screen moves; `action`
// (a button label) with `onAction` offers one thing to do about it, e.g. Undo. `notice` is { text, key }: a new key
// shows it again.
import { useEffect } from 'react'
import { Button } from './Button.jsx'

const SHOW_MS = 5000

export function Toast({ notice, action, onAction, onDone }) {
  const key = notice?.key
  useEffect(() => {
    if (key === undefined) return undefined
    const id = setTimeout(onDone, SHOW_MS)
    return () => clearTimeout(id)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!notice) return null
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-24 z-30 flex justify-center">
      <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-panel py-1 pr-1 pl-3 text-xs shadow-lg">
        <span>{notice.text}</span>
        {action && <Button size="sm" className="w-16" onClick={onAction}>{action}</Button>}
      </div>
    </div>
  )
}
