// Labelled text/number input.
export function Field({ label, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      <input className="h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-sm text-ink" {...props} />
    </label>
  )
}
