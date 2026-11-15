// Controls shown above the seat map on the Hand screen: the step title and the bet/raise amount.
import { useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { Slider } from '../../components/Slider.jsx'
import { raiseLadder } from '../../domain/sizing.js'

/** Slider over the raise ladder; `onCancel`, when given, adds a way back out of the amount. */
export function AmountControls({ range, bigBlind, current, onAnswer, onCancel }) {
  const values = raiseLadder({ ...range, bigBlind })
  const [value, setValue] = useState(current ?? range.def)
  return (
    <>
      <Slider value={value} values={values} onChange={setValue} format={(v) => `${v}`} />
      <div className="flex h-14 items-center gap-2">
        <div className="w-24 text-xs text-muted">{value / bigBlind} big blinds</div>
        {onCancel && <Button variant="ghost" className="w-20" onClick={onCancel}>Cancel</Button>}
        <Button variant="primary" className="h-14 flex-1" onClick={() => onAnswer(value)}>OK</Button>
      </div>
    </>
  )
}

/** Title row, fixed height. */
export function StepTitle({ title, hint }) {
  return (
    <div className="flex h-8 shrink-0 items-baseline justify-between px-3">
      <span className="text-lg font-semibold">{title}</span>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  )
}
