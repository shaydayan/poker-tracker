// Bottom sheet overlay. Floats above the page, so opening it never reflows content.
export function Sheet({ open, title, onClose, children }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="max-h-[85%] overflow-y-auto rounded-t-2xl bg-panel p-4" onClick={(e) => e.stopPropagation()}>
        {title && <div className="mb-3 text-sm font-semibold text-muted">{title}</div>}
        {children}
      </div>
    </div>
  )
}
