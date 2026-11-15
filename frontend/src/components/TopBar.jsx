// Fixed-height header: title on the left, optional controls on the right.
export function TopBar({ title, subtitle, right }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3">
      <div className="min-w-0">
        <div className="truncate text-base font-semibold">{title}</div>
        <div className="h-4 truncate text-xs text-muted">{subtitle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  )
}
