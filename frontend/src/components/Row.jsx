// A tappable list row: short label on the left, value in the middle, optional trailing mark. Fixed height.
// `muted` fades a row that is only there for context (not tappable); `wrap` lets a long text run onto more lines
// (the row grows from its usual height instead of cutting the text off).
export function Row({ label, text, trailing, active = false, muted = false, wrap = false, onClick }) {
  return (
    <button
      type="button"
      aria-label={`${label} ${text}`}
      className={`flex w-full items-center gap-2 px-3 text-xs ${wrap ? 'min-h-9 py-2' : 'h-9'} active:opacity-70 ${active ? 'bg-panel' : ''} ${muted ? 'pointer-events-none opacity-50' : ''}`}
      onClick={onClick}
    >
      <span className="w-20 shrink-0 text-left text-muted">{label}</span>
      <span className={`flex-1 text-left ${wrap ? '' : 'truncate'}`}>{text}</span>
      <span className="w-4 text-muted">{trailing}</span>
    </button>
  )
}
