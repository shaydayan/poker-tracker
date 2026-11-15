// The screen that stays open all evening: the hand's log on top, what to enter now in the middle, and the table pinned
// at the bottom with the board in its centre. The seat to act is lit and one tap says what that player did; tapping a
// later seat acts for them and resolves the seats in between (fold facing a bet, check otherwise). Tap a log row (↺) to
// enter it again: the rows after it wait faded and come back once it is done, when they still fit.
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Row } from '../components/Row.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { CardPicker } from '../components/CardPicker.jsx'
import { SeatMap } from '../components/SeatMap.jsx'
import { MenuSheet } from './capture/MenuSheet.jsx'
import { AmountControls, StepTitle } from './capture/Steps.jsx'
import * as Table from '../domain/table.js'
import { cardLabel } from '../domain/cards.js'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** `c` is the capture state from useHandCapture, owned by the parent so it survives switching tabs. */
export function HandScreen({ c }) {
  const [sheet, setSheet] = useState(null) // 'board' | 'menu'
  const [shower, setShower] = useState(null) // the player whose shown cards are being picked
  const [pick, setPick] = useState([]) // cards being picked in the board or a player's sheet
  const [actor, setActor] = useState(null) // a seat tapped to act before its turn; null = the seat to act
  const [raising, setRaising] = useState(false) // the amount slider is open
  const logRef = useRef(null)
  const focusRow = useRef(null) // the log row being entered again, kept in view until the next new action
  const { table: t, session } = c
  const names = t.players

  // New actions appear at the bottom, so the log follows them; while a row is entered again (and right after), that row
  // stays in view instead.
  const redoing = c.redoing !== null
  useEffect(() => {
    const el = logRef.current
    if (!el) return
    const target = redoing ? el.querySelector('[data-redo]') : focusRow.current !== null ? el.querySelector(`[data-row="${focusRow.current}"]`) : null
    if (!redoing) focusRow.current = null
    if (target) target.scrollIntoView({ block: 'nearest' })
    else el.scrollTop = el.scrollHeight
  }, [c.actions.length, t.handNo, redoing, raising]) // the amount slider is taller, so the log gets shorter

  const reset = () => { setActor(null); setRaising(false) }
  const act = (a) => { c.act(a); reset() }
  const run = (fn) => () => { fn(); reset() }

  const startShow = (seat) => { setPick([]); setShower(seat) }
  const view = stepView(t, { actor, raising, act, setActor, setRaising, startShow })
  // A player picked under Cards Shown?; a half-entered one (after an old redo or undo) is picked already.
  const showing = t.pendingSeat ?? shower
  const showCards = (cards) => {
    act(t.pendingSeat !== null ? { type: 'cards', cards } : [{ type: 'cards-who', seat: showing }, { type: 'cards', cards }])
    setShower(null)
  }
  const cancelShow = () => (t.pendingSeat !== null ? c.undo() : setShower(null))
  useEffect(() => { if (t.pendingSeat !== null) setPick([]) }, [t.pendingSeat])
  const where = t.dealerSeat == null ? 'No dealer yet' : `You · ${t.positions[t.heroSeat]} · Dealer ${names[t.dealerSeat]}`
  const street = Table.streetNow(t)
  const count = Table.boardCount(t)
  const openBoard = () => { setPick(t.board.slice(0, count)); setSheet('board') }
  const saveBoard = () => {
    if (pick.join() !== t.board.join()) c.act({ type: 'board', cards: pick })
    setSheet(null)
  }
  const board = { count, cards: t.board, caption: street ? `${cap(street)} · pot ${Table.potNow(t)}` : '', onPick: count > 0 ? openBoard : undefined }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <TopBar
        title={c.editing ? `Editing Hand ${t.handNo}` : `Hand ${t.handNo}`}
        subtitle={where}
        right={<Button className="w-11" onClick={() => setSheet('menu')}>⋯</Button>}
      />
      <div ref={logRef} className="flex-1 overflow-y-auto">
        {c.log.map((r, i) => (
          <div key={i} data-row={i} className="border-b border-line">
            <Row label={r.label} text={r.text} trailing={c.redoing ? '' : '↺'} onClick={c.redoing ? undefined : () => { focusRow.current = i; c.redoRow(i); reset() }} />
          </div>
        ))}
        {c.redoing && (
          <>
            <div data-redo className="border-b border-line">
              <Row label={c.redoing.row.label} text={c.redoing.row.text} trailing="↩" active onClick={run(c.restore)} />
            </div>
            {c.redoing.tailRows.map((r, i) => (
              <div key={`t${i}`} className="border-b border-line">
                <Row label={r.label} text={r.text} muted />
              </div>
            ))}
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-line pt-1 pb-2" key={`${t.handNo}-${c.actions.length}-${raising}`}>
        <StepTitle title={view.title} hint={view.hint} />
        {view.controls && <div className="flex flex-col gap-2 px-3">{view.controls}</div>}
      </div>
      <div className="shrink-0 border-t border-line pt-1">
        <SeatMap {...view.map} board={board} />
      </div>
      <div className="flex h-16 shrink-0 items-center gap-2 border-t border-line px-2">
        <Button variant="ghost" className="w-20" disabled={!c.canUndo} onClick={run(c.undo)}>Undo</Button>
        {c.editing && <Button variant="ghost" className="w-20" onClick={run(c.cancelEdit)}>Cancel</Button>}
        <div className="flex-1 text-center text-xs text-muted">{c.redoing ? 'Later rows return if they still fit' : c.editing ? 'Changes apply on Save' : `${c.hands.length} saved`}</div>
        <Button variant="primary" className="w-24" disabled={!!c.redoing} onClick={run(c.editing ? c.saveEdit : c.endHand)}>{c.editing ? 'Save' : c.inCardsPhase ? 'Save Hand' : 'End Hand'}</Button>
      </div>

      <CardsSheet
        open={showing !== null}
        title={showing !== null ? `${names[showing]}'s Cards` : ''}
        count={2}
        hint="Their two cards"
        value={pick}
        taken={Table.usedCards(t)}
        onChange={setPick}
        left={<Button variant="ghost" onClick={cancelShow}>Cancel</Button>}
        okDisabled={pick.length !== 2}
        onOk={() => showCards(pick)}
        onClose={cancelShow}
      />
      <CardsSheet
        open={sheet === 'board'}
        title="Board Cards"
        count={count}
        hint={`Up to ${count}, in order dealt`}
        value={pick}
        taken={Table.usedCards(t).filter((x) => !t.board.includes(x))}
        onChange={setPick}
        left={<Button variant="ghost" onClick={() => setPick([])}>Clear</Button>}
        onOk={saveBoard}
        onClose={() => setSheet(null)}
      />
      <MenuSheet open={sheet === 'menu'} onClose={() => setSheet(null)} session={session} onToggleSitOut={c.toggleSitOut} />
    </div>
  )
}

/** What to enter now: the dealer, each player's action in turn, then the cards shown. @returns {{ title, hint, map, controls }} */
function stepView(t, { actor, raising, act, setActor, setRaising, startShow }) {
  const names = t.players
  const base = { seats: t.seats, names, heroSeat: t.heroSeat, status: Table.seatStatus(t), hands: t.shownHands, badges: t.dealerSeat != null ? { [t.dealerSeat]: 'D' } : {} }

  if (t.street === null) {
    const suggested = t.suggestedDealer
    return {
      title: 'Dealer?',
      hint: suggested != null ? `expected: ${names[suggested]}` : 'first hand',
      map: { ...base, active: suggested, badges: suggested != null ? { [suggested]: 'D' } : {}, onPick: (seat) => act({ type: 'dealer', seat }) },
      controls: null,
    }
  }

  if (Table.isOver(t)) {
    const shown = Object.keys(t.shownHands).map(Number)
    return {
      title: 'Cards Shown?',
      hint: 'tap a player, or save',
      map: {
        ...base,
        enabled: t.seats.filter((s) => !shown.includes(s)), // a player's cards are entered once; tap their row to change them
        tones: Object.fromEntries(shown.map((s) => [s, 'primary'])),
        onPick: startShow, // their cards are picked in a sheet, so nothing on the screen moves
      },
      controls: null,
    }
  }

  const next = Table.toAct(t)
  const seat = actor ?? next
  const owed = Table.toCall(t, seat)
  const skipped = t.queue.slice(0, t.queue.indexOf(seat))
  const skipWord = skipped.length && Table.toCall(t, skipped[0]) > 0 ? 'fold' : 'check'
  const hint = skipped.length ? `${skipped.map((s) => names[s]).join(', ')} ${skipWord} first` : ''
  const map = {
    ...base,
    tones: Object.fromEntries(t.seats.filter((s) => t.status[s].folded).map((s) => [s, 'fold'])),
    enabled: Table.live(t), // folded seats fade out; a live seat that already acted this street just does nothing
    active: seat,
    onPick: (s) => { if (t.queue.includes(s)) { setActor(s); setRaising(false) } },
  }
  if (raising) {
    return {
      title: `${names[seat]} ${t.highest === 0 ? 'Bets' : 'Raises To'}`,
      hint,
      map: { ...map, readOnly: true },
      controls: <AmountControls range={Table.amountRange(t)} bigBlind={t.bigBlind} onAnswer={(amount) => act({ type: 'raise', seat, amount })} onCancel={() => setRaising(false)} />,
    }
  }
  const anyOwed = t.queue.some((s) => Table.toCall(t, s) > 0)
  return {
    title: `${names[seat]}?`,
    hint,
    map,
    controls: (
      <>
        {Table.canStraddle(t) && seat === next && (
          <Button variant="raise" className="h-14" onClick={() => act({ type: 'straddle' })}>Straddle · {t.straddleSize}</Button>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="fold" className="h-14" onClick={() => act({ type: 'fold', seat })}>Fold</Button>
          <Button className="h-14" onClick={() => act({ type: 'call', seat })}>{owed > 0 ? `Call ${t.highest}` : 'Check'}</Button>
          <Button variant="raise" className="h-14" onClick={() => setRaising(true)}>{t.highest === 0 ? 'Bet' : 'Raise'}</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Everyone not entered checks if they can, folds if they face a bet. */}
          <Button variant="ghost" className="h-10" onClick={() => act({ type: 'next-street' })}>{t.street === 'river' ? 'End Betting' : 'Next Street'}</Button>
          <Button variant="ghost" className="h-10" onClick={() => act({ type: 'rest-call' })}>{anyOwed ? 'Rest Call' : 'Rest Check'}</Button>
        </div>
      </>
    ),
  }
}

/** The card picker in a sheet: the cards picked so far, the 13×4 grid, and a left button (Cancel or Clear) with OK. */
function CardsSheet({ open, title, count, hint, value, taken, onChange, left, okDisabled = false, onOk, onClose }) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="mb-2 flex h-5 items-center justify-between text-xs">
        <span className="font-semibold">{[...Array(count)].map((_, i) => (value[i] ? cardLabel(value[i]) : '—')).join('  ')}</span>
        <span className="text-muted">{hint}</span>
      </div>
      <CardPicker value={value} max={count} taken={taken} onChange={onChange} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {left}
        <Button variant="primary" disabled={okDisabled} onClick={onOk}>OK</Button>
      </div>
    </Sheet>
  )
}
