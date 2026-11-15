// The screen that stays open all evening: the table on top with the board in its centre, the hand's log under it, then
// what to enter now, and Undo / End Hand at the bottom. The seat to act is lit and one tap says what that player did; tapping a
// later seat acts for them and resolves the seats in between (fold facing a bet, check otherwise). Tap a log row (↺) to
// enter it again: the rows after it wait faded and come back once it is done, when they still fit. ✎ adds a note to the
// hand; it shows as the last log row.
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Field } from '../components/Field.jsx'
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
  const [sheet, setSheet] = useState(null) // 'board' | 'menu' | 'note'
  const [noteText, setNoteText] = useState('') // the note while its sheet is open
  const [shower, setShower] = useState(null) // the player whose shown cards are being picked
  const [outPick, setOutPick] = useState([]) // who sits out, while the Sitting Out row is entered again
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
  // Entering the Sitting Out row again starts from who sat out before.
  const redoKind = c.redoing?.kind
  useEffect(() => { if (redoKind === 'seats') setOutPick(c.redoing.removed[0].out) }, [redoKind]) // eslint-disable-line react-hooks/exhaustive-deps
  const view = redoKind === 'seats'
    ? sitOutView(t, outPick, setOutPick, (out) => act({ type: 'seats', out }))
    : stepView(t, { actor, raising, act, setActor, setRaising, startShow, endHand: run(c.endHand), editing: c.editing, redoing: !!c.redoing })
  // A player picked under Cards Shown?; a half-entered one (after an old redo or undo) is picked already.
  const showing = t.pendingSeat ?? shower
  const showCards = (cards) => {
    act(t.pendingSeat !== null ? { type: 'cards', cards } : [{ type: 'cards-who', seat: showing }, { type: 'cards', cards }])
    setShower(null)
  }
  const cancelShow = () => (t.pendingSeat !== null ? c.undo() : setShower(null))
  useEffect(() => { if (t.pendingSeat !== null) setPick([]) }, [t.pendingSeat])
  const me = t.out.includes(t.heroSeat) ? 'You sit out' : `You · ${t.positions[t.heroSeat]}`
  const where = t.dealerSeat == null ? (t.out.includes(t.heroSeat) ? 'You sit out · no dealer yet' : 'No dealer yet') : `${me} · Dealer ${names[t.dealerSeat]}`
  const street = Table.streetNow(t)
  const count = Table.boardCount(t)
  const openBoard = () => { setPick(t.board.slice(0, count)); setSheet('board') }
  const saveBoard = () => {
    if (pick.join() !== t.board.join()) c.act({ type: 'board', cards: pick })
    setSheet(null)
  }
  const openNote = () => { setNoteText(c.note); setSheet('note') }
  const saveNote = (text) => { c.saveNote(text); setSheet(null) }
  const board = { count, cards: t.board, caption: street ? `${cap(street)} · pot ${Table.potNow(t)}` : '', onPick: count > 0 ? openBoard : undefined }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <TopBar
        title={c.editing ? `Editing Hand ${t.handNo}` : `Hand ${t.handNo}`}
        subtitle={where}
        right={
          <>
            <Button className="w-11" aria-label="Undo" disabled={!c.canUndo} onClick={run(c.undo)}>↶</Button>
            <Button className="w-11" aria-label="Note" active={!!c.note} onClick={openNote}>✎</Button>
            <Button className="w-11" aria-label="Menu" onClick={() => setSheet('menu')}>⋯</Button>
          </>
        }
      />
      <div className="shrink-0 border-b border-line pt-1">
        <SeatMap {...view.map} board={board} />
      </div>
      <div ref={logRef} className="flex-1 overflow-y-auto">
        {c.log.map((r, i) => (
          <div key={i} data-row={i} className="border-b border-line">
            <Row label={r.label} text={r.text} trailing={c.redoing ? '' : '↺'} onClick={c.redoing ? undefined : r.board ? openBoard : () => { focusRow.current = i; c.redoRow(i); reset() }} />
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
        {c.note && (
          <div className="border-b border-line">
            <Row label="Note" text={c.note} trailing="✎" onClick={openNote} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-line pt-1 pb-2" key={`${t.handNo}-${c.actions.length}-${raising}`}>
        <StepTitle title={view.title} hint={c.redoing ? 'later rows return if they still fit' : view.hint} action={view.action} />
        {view.controls && <div className="flex flex-col gap-2 px-3">{view.controls}</div>}
        {c.editing && (
          <div className="grid grid-cols-2 gap-2 px-3">
            <Button variant="ghost" className="h-12" onClick={run(c.cancelEdit)}>Cancel</Button>
            <Button variant="primary" className="h-12" disabled={!!c.redoing} onClick={run(c.saveEdit)}>Save Changes</Button>
          </div>
        )}
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
      <Sheet open={sheet === 'note'} title="Hand Note" onClose={() => setSheet(null)}>
        <Field label="Note" placeholder="Anything to remember about this hand" value={noteText} autoFocus onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNote(noteText)} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => saveNote('')}>Clear</Button>
          <Button variant="primary" onClick={() => saveNote(noteText)}>Save</Button>
        </div>
      </Sheet>
      <MenuSheet open={sheet === 'menu'} onClose={() => setSheet(null)} session={session} started={c.started || c.editing} onToggleSitOut={c.toggleSitOut} />
    </div>
  )
}

/** What to enter now: the dealer, each player's action in turn, then the cards shown. @returns {{ title, hint, map, controls }} */
function stepView(t, { actor, raising, act, setActor, setRaising, startShow, endHand, editing, redoing }) {
  const names = t.players
  // Everyone at the table is shown; those sitting this hand out are faded, marked Out, and never tappable.
  const outTones = Object.fromEntries(t.out.map((s) => [s, 'fold']))
  const base = { seats: t.allSeats, names, heroSeat: t.heroSeat, status: Table.seatStatus(t), hands: t.shownHands, tones: outTones, enabled: t.seats, badges: t.dealerSeat != null ? { [t.dealerSeat]: 'D' } : {} }

  if (t.street === null) {
    const suggested = t.suggestedDealer
    const expected = suggested != null && t.seats.includes(suggested)
    return {
      title: 'Dealer?',
      hint: expected ? '' : 'tap the dealer',
      // The seat expected to have the button (after last hand's dealer), as a one-tap answer on the question's line.
      action: expected && <Button size="sm" className="w-28" onClick={() => act({ type: 'dealer', seat: suggested })}>{names[suggested]}</Button>,
      map: { ...base, active: expected ? suggested : undefined, badges: expected ? { [suggested]: 'D' } : {}, onPick: (seat) => act({ type: 'dealer', seat }) },
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
        tones: { ...outTones, ...Object.fromEntries(shown.map((s) => [s, 'primary'])) },
        onPick: startShow, // their cards are picked in a sheet, so nothing on the screen moves
      },
      // Saving moves the button and deals the next hand; a saved hand open for editing has its own Save Changes.
      controls: editing ? null : <Button variant="primary" className="h-12" disabled={redoing} onClick={endHand}>Save Hand</Button>,
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
    tones: { ...outTones, ...Object.fromEntries(t.seats.filter((s) => t.status[s].folded).map((s) => [s, 'fold'])) },
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
          {/* End Street: everyone not entered checks if they can, folds if they face a bet. End Hand: stop the betting here. */}
          <Button className="h-12" onClick={() => act({ type: 'next-street' })}>End Street</Button>
          <Button className="h-12" disabled={redoing} onClick={endHand}>End Hand</Button>
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

/** Who sits this hand out: tap seats to switch them, Done to keep it (at least two must play). */
function sitOutView(t, out, setOut, onDone) {
  const playing = t.allSeats.length - out.length
  return {
    title: 'Sitting Out?',
    hint: 'tap to switch',
    map: {
      seats: t.allSeats,
      names: t.players,
      heroSeat: t.heroSeat,
      status: Object.fromEntries(out.map((s) => [s, 'Out'])),
      tones: Object.fromEntries(out.map((s) => [s, 'fold'])),
      onPick: (s) => setOut(out.includes(s) ? out.filter((x) => x !== s) : [...out, s].sort((a, b) => a - b)),
    },
    controls: (
      <Button variant="primary" className="h-14" disabled={playing < 2} onClick={() => onDone(out)}>
        {playing < 2 ? 'At Least Two Must Play' : 'Done'}
      </Button>
    ),
  }
}
