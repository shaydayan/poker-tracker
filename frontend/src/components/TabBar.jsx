// Bottom tab bar: equal-width tabs, the current one in accent. Fixed height.
export function TabBar({ tabs, value, onChange }) {
  return (
    <div className="flex h-14 shrink-0 border-t border-line bg-bg">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={t.disabled}
          className={`flex-1 text-xs font-medium active:opacity-70 disabled:opacity-30 ${value === t.id ? 'text-accent' : 'text-muted'}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
