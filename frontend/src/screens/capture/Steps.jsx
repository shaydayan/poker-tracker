// Controls of the Hand screen: the step title, the bet/raise/all-in amount, and a player's choices as buttons.
import { useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { Slider } from '../../components/Slider.jsx'
import { nearestOnLadder, raiseLadder } from '../../domain/sizing.js'
import { amountRange } from '../../domain/table.js'

/** Slider over the raise ladder; `onCancel`, when given, adds a way back out of the amount; `allowed`, when given, turns
 *  OK off for an amount it refuses and `describe` says what the amount means (both for the all-in, whose ladder starts at 0). */
export function AmountControls({ range, bigBlind, current, onAnswer, onCancel, allowed = () => true, describe }) {
  const values = raiseLadder({ ...range, bigBlind })
  const [value, setValue] = useState(() => nearestOnLadder(values, current ?? range.def))
  return (
    <>
      <Slider value={value} values={values} onChange={setValue} format={(v) => `${v}`} />
      <div className="flex h-14 items-center gap-2">
        <div className="w-24 text-xs text-muted">{describe ? describe(value) : `${value / bigBlind} big blinds`}</div>
        {onCancel && <Button variant="ghost" className="w-20" onClick={onCancel}>Cancel</Button>}
        <Button variant="primary" className="h-14 flex-1" disabled={!allowed(value)} onClick={() => onAnswer(value)}>OK</Button>
      </div>
    </>
  )
}

/** Title row, fixed height; `action` (a small button) takes the hint's place on the right. */
export function StepTitle({ title, hint, action }) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between px-3">
      <span className="text-lg font-semibold">{title}</span>
      {action ?? <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}

/** A player's choices (Table.seatChoices) as button labels and looks, the same wherever they are offered. */
const CHOICE_LABEL = { fold: 'Fold', check: 'Check', bet: 'Bet', raise: 'Raise', allin: 'All-In', dealer: 'Dealer' }
export const choiceLabel = (o) => (o.kind === 'call' ? `Call ${o.amount}` : o.kind === 'straddle' ? `Straddle ${o.amount}` : CHOICE_LABEL[o.kind])
export const CHOICE_VARIANT = { fold: 'fold', bet: 'raise', raise: 'raise', straddle: 'raise' }

/** The amount of a bet or raise (`kind` 'raise') or an all-in (`kind` 'allin') by `seat` at table `t`, as the table view
 *  and the log ask it: an all-in is their whole bet this street, from 0 up, adding to what they already put in. */
export function TurnAmount({ t, seat, kind, current, onAnswer, onCancel }) {
  const range = amountRange(t)
  if (kind === 'raise') return <AmountControls range={range} bigBlind={t.bigBlind} current={current} onAnswer={onAnswer} onCancel={onCancel} />
  const mine = t.status[seat]?.bet ?? 0
  return (
    <AmountControls
      range={{ min: 0, def: t.highest, max: range.max }}
      bigBlind={t.bigBlind}
      current={current}
      allowed={(v) => v > mine}
      describe={(v) => (v > t.highest ? (t.highest === 0 ? 'a bet' : 'a raise') : v === t.highest ? 'a call' : v > mine ? 'a call for less' : '')}
      onAnswer={onAnswer}
      onCancel={onCancel}
    />
  )
}
