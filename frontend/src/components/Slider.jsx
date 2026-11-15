// Slider over a fixed list of allowed values (not necessarily evenly spaced), with a large readout.
export function Slider({ value, values, onChange, format = (v) => v }) {
  const index = Math.max(0, values.indexOf(value))
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-12 font-mono text-4xl font-semibold">{format(value)}</div>
      <input
        type="range"
        className="h-11 w-full accent-accent"
        min={0}
        max={values.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(values[Number(e.target.value)])}
      />
      <div className="flex w-full justify-between text-xs text-muted">
        <span>{format(values[0])}</span>
        <span>{format(values[values.length - 1])}</span>
      </div>
    </div>
  )
}
