// The screen that stays open all evening: the table on top with the board in its centre, the hand's log under it, then
// what to enter now, and Undo / End Hand at the bottom. The seat to act is lit and one tap says what that player did; tapping a
// later seat acts for them and fills in the seats in between (fold facing a bet, check otherwise; those rows read "auto").
// The log (capture/LogRows.jsx) reads in a fixed order: who sits out and the dealer, the betting street by street, the
// cards shown and the note. Tapping any row opens what changes it, in one step (capture/LogEditor.jsx); what comes after
// is checked again, and a note floats up for a moment if anything no longer fitted (Undo puts it back). The hand stays
// open at its end for more. Cards (or, once the betting is over, a tap on a player) enters a player's cards at any point.
// The ☰ / ◎ button switches to the table view (capture/TableBody.jsx): only the table, each player's buttons under their
// seat. The choice is remembered on this device.
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Field } from '../components/Field.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { Toast } from '../components/Toast.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { CardPicker } from '../components/CardPicker.jsx'
import { SeatMap } from '../components/SeatMap.jsx'
import { LogEditor } from './capture/LogEditor.jsx'
import { LogRows } from './capture/LogRows.jsx'
import { MenuSheet } from './capture/MenuSheet.jsx'
import { TableBody } from './capture/TableBody.jsx'
import { AmountControls, StepTitle } from './capture/Steps.jsx'
import * as Table from '../domain/table.js'
import { cardLabel } from '../domain/cards.js'

const cap = (s) => s[0].toUpperCase() + s.slice(1)
const VIEW_KEY = 'poker-tracker.handView'

/** 'list' (table, log and the question at the bottom) or 'table' (the table only), remembered on this device. */
function useHandView() {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'list' } catch { return 'list' }
  })
  const change = (v) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* not kept; fine */ }
  }
  return [view, change]
}

/** `c` is the capture state from useHandCapture, owned by the parent so it survives switching tabs. */
export function HandScreen({ c }) {
  const [sheet, setSheet] = useState(null) // 'board' | 'menu' | 'note'
  const [noteText, setNoteText] = useState('') // the note while its sheet is open
  const [shower, setShower] = useState(null) // the player whose shown cards are being picked
  const [edit, setEdit] = useState(null) // the log row whose sheet is open ({ kind, index? })
  const [pick, setPick] = useState([]) // cards being picked in the board or a player's sheet
  const [actor, setActor] = useState(null) // a seat tapped to act before its turn; null = the seat to act
  const [raising, setRaising] = useState(false) // the amount slider is open
  const [allIn, setAllIn] = useState(false) // the all-in amount is being typed
  const [choosing, setChoosing] = useState(false) // Cards was tapped: the next seat tapped is whose cards to enter
  const [mode, setMode] = useHandView()
  const logRef = useRef(null)
  const { table: t, session } = c
  const names = t.players

  // New actions appear at the bottom, so the log follows them (an edit leaves it where it is).
  const length = c.actions.length
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [length, t.handNo, raising, allIn]) // eslint-disable-line react-hooks/exhaustive-deps -- the amount controls are taller, so the log gets shorter

  const reset = () => { setActor(null); setRaising(false); setAllIn(false); setChoosing(false) }
  const act = (a) => { c.act(a); reset() }
  const run = (fn) => () => { fn(); reset() }

  const startShow = (seat) => { setPick(Array.isArray(t.shownHands[seat]) ? t.shownHands[seat] : []); setShower(seat) }
  const view = stepView(t, { actor, raising, allIn, choosing, act, setActor, setRaising, setAllIn, setChoosing, startShow, endHand: run(c.endHand), continueHand: run(c.continueHand), canContinue: c.canContinue, editing: c.editing })
  const showing = shower
  const showCards = (cards) => {
    c.show(showing, cards)
    reset()
    setShower(null)
  }
  const hadCards = showing !== null && showing in t.shownHands
  const cancelShow = () => setShower(null)
  const me = t.out.includes(t.heroSeat) ? 'You sit out' : `You · ${t.positions[t.heroSeat]}`
  const where = t.dealerSeat == null ? (t.out.includes(t.heroSeat) ? 'You sit out · no dealer yet' : 'No dealer yet') : `${me} · Dealer ${names[t.dealerSeat]}`
  const street = Table.streetNow(t)
  const count = Table.boardCount(t)
  const openBoard = () => { setPick(t.board.slice(0, count)); setSheet('board') }
  const saveBoard = () => {
    c.setBoard(pick)
    setSheet(null)
  }
  const openNote = () => { setNoteText(c.note); setSheet('note') }
  const saveNote = (text) => { c.saveNote(text); setSheet(null) }
  const board = { count, cards: t.board.slice(0, count), caption: street ? `${cap(street)} · pot ${Table.potNow(t)}` : '', onPick: count > 0 ? openBoard : undefined }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <TopBar
        title={c.editing ? `Editing Hand ${t.handNo}` : `Hand ${t.handNo}`}
        subtitle={where}
        right={
          <>
            <Button className="w-11" aria-label={mode === 'table' ? 'List View' : 'Table View'} onClick={() => { setMode(mode === 'table' ? 'list' : 'table'); reset() }}>{mode === 'table' ? '☰' : '◎'}</Button>
            <Button className="w-11" aria-label="Undo" disabled={!c.canUndo} onClick={run(c.undo)}>↶</Button>
            <Button className="w-11" aria-label="Note" active={!!c.note} onClick={openNote}>✎</Button>
            {/* Sitting players out means nothing for a finished session's hand. */}
            <Button className="w-11" aria-label="Menu" disabled={c.past} onClick={() => setSheet('menu')}>⋯</Button>
          </>
        }
      />
      {mode === 'table' && <TableBody c={c} board={board} endHand={run(c.endHand)} onNote={openNote} onEdit={setEdit} />}
      {mode === 'list' && (
        <>
        <div className="shrink-0 border-b border-line pt-1">
          <SeatMap {...view.map} board={board} />
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto">
          <LogRows c={c} onEdit={(e) => { reset(); setEdit(e) }} onBoard={openBoard} onShown={startShow} onNote={openNote} />
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-line pt-1 pb-2" key={`${t.handNo}-${c.actions.length}-${raising}-${allIn}`}>
          <StepTitle title={view.title} hint={view.hint} action={view.action} />
          {view.controls && <div className="flex flex-col gap-2 px-3">{view.controls}</div>}
          {c.editing && (
            <div className="grid grid-cols-2 gap-2 px-3">
              <Button variant="ghost" className="h-12" onClick={run(c.cancelEdit)}>Cancel</Button>
              <Button variant="primary" className="h-12" onClick={run(c.saveEdit)}>Save Changes</Button>
            </div>
          )}
        </div>
        </>
      )}

      <CardsSheet
        open={showing !== null}
        title={showing !== null ? `${names[showing]}'s Cards` : ''}
        count={2}
        hint="One or two cards"
        value={pick}
        taken={Table.usedCards(t, showing)}
        onChange={setPick}
        left={<Button variant="ghost" onClick={() => setPick([])}>Clear</Button>}
        okDisabled={pick.length === 0 && !hadCards}
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
      <LogEditor c={c} edit={edit} onClose={() => setEdit(null)} />
      <Toast notice={c.notice} action="Undo" onAction={run(c.undo)} onDone={c.dismissNotice} />
      <MenuSheet open={sheet === 'menu'} onClose={() => setSheet(null)} session={session} started={c.started || c.editing} onToggleSitOut={c.toggleSitOut} onStack={c.setStack} onBuyIn={c.setBuyIn} settings={c.settings} />
    </div>
  )
}

/** What to enter now: the dealer, each player's action in turn, then the cards shown. @returns {{ title, hint, map, controls }} */
function stepView(t, { actor, raising, allIn, choosing, act, setActor, setRaising, setAllIn, setChoosing, startShow, endHand, continueHand, canContinue, editing }) {
  const names = t.players
  // Everyone at the table is shown, in the table view's colours: lit while in the hand, faded once folded or sitting out
  // (marked Out; tapping them does nothing), blue for the player being entered.
  const tonesFor = (blue) => Object.fromEntries(t.allSeats.map((s) => [s, s === blue ? 'primary' : t.out.includes(s) || t.status[s]?.folded ? 'ghost' : 'surface']))
  const playing = (pick) => (s) => { if (t.seats.includes(s)) pick(s) }
  const base = { seats: t.allSeats, names, heroSeat: t.heroSeat, status: Table.seatStatus(t), hands: t.shownHands, tones: tonesFor(null), badges: t.dealerSeat != null ? { [t.dealerSeat]: 'D' } : {} }

  if (t.street === null) {
    const suggested = t.suggestedDealer
    const expected = suggested != null && t.seats.includes(suggested)
    return {
      title: 'Dealer?',
      hint: expected ? '' : 'tap the dealer',
      // The seat expected to have the button (after last hand's dealer), as a one-tap answer on the question's line.
      action: expected && <Button size="sm" className="w-28" onClick={() => act({ type: 'dealer', seat: suggested })}>{names[suggested]}</Button>,
      map: { ...base, active: expected ? suggested : undefined, badges: expected ? { [suggested]: 'D' } : {}, onPick: playing((seat) => act({ type: 'dealer', seat })) },
      controls: null,
    }
  }

  if (Table.isOver(t)) {
    return {
      title: 'Cards Shown?',
      hint: 'tap a player, or save',
      map: {
        ...base,
        onPick: playing(startShow), // their cards are picked in a sheet, so nothing on the screen moves; a player who already has cards opens them to change
      },
      // Saving moves the button and deals the next hand; a saved hand open for editing has its own Save Changes.
      // A hand ended with End Hand can go on (Continue Hand).
      controls: editing && !canContinue ? null : (
        <div className={`grid gap-2 ${canContinue && !editing ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canContinue && <Button className="h-12" onClick={continueHand}>Continue Hand</Button>}
          {!editing && <Button variant="primary" className="h-12" onClick={endHand}>Save Hand</Button>}
        </div>
      ),
    }
  }

  if (choosing) {
    return {
      title: 'Whose Cards?',
      hint: 'tap a player',
      map: { ...base, onPick: playing(startShow) },
      controls: <Button variant="ghost" className="h-12" onClick={() => setChoosing(false)}>Back</Button>,
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
    tones: tonesFor(seat), // tapping a seat not to act this street does nothing
    onPick: (s) => { if (t.queue.includes(s)) { setActor(s); setRaising(false); setAllIn(false) } },
  }
  if (allIn) {
    return {
      title: `${names[seat]} All-In`,
      hint,
      map: { ...map, readOnly: true },
      // Their whole bet this street, from 0 up (their stack is not known); it must add to what they already put in.
      controls: (
        <AmountControls
          range={{ min: 0, def: t.highest, max: Table.amountRange(t).max }}
          bigBlind={t.bigBlind}
          allowed={(v) => v > (t.status[seat]?.bet ?? 0)}
          describe={(v) => (v > t.highest ? (t.highest === 0 ? 'a bet' : 'a raise') : v === t.highest ? 'a call' : v > (t.status[seat]?.bet ?? 0) ? 'a call for less' : '')}
          onAnswer={(amount) => act({ type: 'allin', seat, amount })}
          onCancel={() => setAllIn(false)}
        />
      ),
    }
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
        <div className="grid grid-cols-4 gap-2">
          <Button variant="fold" className="h-14" onClick={() => act({ type: 'fold', seat })}>Fold</Button>
          <Button className="h-14" onClick={() => act({ type: 'call', seat })}>{owed > 0 ? `Call ${t.highest}` : 'Check'}</Button>
          <Button variant="raise" className="h-14" onClick={() => setRaising(true)}>{t.highest === 0 ? 'Bet' : 'Raise'}</Button>
          <Button className="h-14" onClick={() => setAllIn(true)}>All-In</Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Cards: enter someone's cards now. End Street: everyone not entered checks if they can, folds if they face a bet.
              End Hand: stop the betting here. */}
          <Button className="h-12" onClick={() => setChoosing(true)}>Cards</Button>
          <Button className="h-12" onClick={() => act({ type: 'next-street' })}>End Street</Button>
          <Button className="h-12" onClick={endHand}>End Hand</Button>
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
