// The Hand screen's table view: only the table, over the whole screen, and under every seat what can be asked of that
// player now (see Table.seatChoices): Dealer before the hand starts; Fold / Call / Raise / All-In (Check / Bet when
// nothing is owed, Straddle for the first player preflop) while they are still to act; Cards once the betting is over.
// One tap answers for any player still to act: acting for a later one folds or checks the ones before it, as in the
// list view. A raise or all-in asks the amount in a sheet.
// Every player still in the hand holds two cards, face down until entered (then face up); folding takes them away, or
// fades them when they were entered. Next to the cards, at a glance: how many times they bought in (one ✕, bigger with each) and
// their stack size (five bars). What each one put in this street shows as a chip on the felt in front of them (white:
// blind or call, red: bet, raise or straddle, a red triangle: all-in).
// Seats: blue for the player to act, lit for the others still in, faded for those who folded or sit out.
// Tapping a player (name or cards) opens their sheet: their cards to pick right there, Sit Out, buy-in and stack;
// the marks or bars open the same sheet. What is not one player's (End Street, End Hand, Save)
// stays at the bottom. Above it, one Log line shows the last action; tapping it opens the whole log in a sheet, the same
// as the list view's (capture/LogRows.jsx), where a row opens what changes it (`onEdit`, capture/LogEditor.jsx).
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button.jsx'
import { CardPicker } from '../../components/CardPicker.jsx'
import { Card, SeatMap } from '../../components/SeatMap.jsx'
import { Row } from '../../components/Row.jsx'
import { Sheet } from '../../components/Sheet.jsx'
import * as Table from '../../domain/table.js'
import { cardLabel } from '../../domain/cards.js'
import { STACKS, stackLabel } from '../../domain/session.js'
import { CHOICE_VARIANT, TurnAmount, choiceLabel } from './Steps.jsx'
import { LogRows } from './LogRows.jsx'
import { PlayerSheet } from './PlayerSheet.jsx'

const MAX_MARKS = 5

/** A seat's bet this street as a chip, from what they did last (null when nothing is in front of them). */
function betOf(st) {
  const last = st?.last
  if (!last || last === 'Fold') return null
  if (last === 'Check') return { text: 'Check', tone: 'check' }
  const word = last.split(' ')[0]
  if (word === 'All-In') return { text: st.bet ? `All-In ${st.bet}` : 'All-In', tone: 'allin' }
  if (!st.bet) return null
  return { text: `${st.bet}`, tone: ['Bet', 'Raise', 'Str'].includes(word) ? 'raise' : 'call' }
}

/** How many times a player bought in, at a glance: one ✕ that grows with each game buy-in (full size at five or more),
 *  in a fixed box so nothing moves. */
function BuyInMark({ buyIn, unit }) {
  const n = Math.min(MAX_MARKS, Math.max(1, Math.round(buyIn / unit)))
  const size = 6 + ((n - 1) * 10) / (MAX_MARKS - 1)
  const o = (16 - size) / 2
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-ink" aria-hidden="true">
      <path d={`M${o} ${o}L${16 - o} ${16 - o}M${16 - o} ${o}L${o} ${16 - o}`} stroke="currentColor" strokeWidth={1.5 + (n - 1) * 0.25} strokeLinecap="round" />
    </svg>
  )
}

/** A stack size at a glance: five rising bars, as many lit as its place among STACKS. */
function StackBars({ stack }) {
  const level = STACKS.findIndex((k) => k.id === stack) + 1
  return (
    <span className="flex items-end gap-px">
      {STACKS.map((k, i) => <span key={k.id} className={`w-[3px] rounded-sm ${i < level ? 'bg-ink' : 'bg-line'}`} style={{ height: 4 + i * 3 }} />)}
    </span>
  )
}

/** `c` the capture state, `board` the board for the middle, `endHand` ends or saves the hand, `onNote` opens the note,
 *  `onEdit` opens what changes a log row. */
export function TableBody({ c, board, endHand, onNote, onEdit }) {
  const t = c.table
  const names = t.players
  const [amount, setAmount] = useState(null) // { seat, kind: 'raise' | 'allin' } while its amount is picked
  const [player, setPlayer] = useState(null) // seat whose sheet is open
  const [pick, setPick] = useState([]) // that player's cards while the sheet is open
  const [logOpen, setLogOpen] = useState(false)
  const logEnd = useRef(null)
  useEffect(() => { if (logOpen) logEnd.current?.scrollIntoView({ block: 'nearest' }) }, [logOpen]) // opens on the latest rows
  const over = Table.isOver(t)
  const dealt = t.street !== null
  const next = Table.toAct(t)
  const last = [...c.log].reverse().find((r) => r.kind !== 'street')
  const folded = (s) => !!t.status[s]?.folded
  const open = player

  const openPlayer = (s) => {
    setPick(Array.isArray(t.shownHands[s]) ? t.shownHands[s] : [])
    setPlayer(s)
  }
  // The cards picked in the sheet are kept when it closes (a seat's entry is changed in place; none takes it away).
  const closePlayer = () => {
    const had = Array.isArray(t.shownHands[open]) ? t.shownHands[open] : []
    if (dealt && pick.join() !== had.join() && (pick.length || open in t.shownHands)) c.show(open, pick)
    setPlayer(null)
  }

  const answer = (seat, o) => {
    if (o.kind === 'dealer') return c.act({ type: 'dealer', seat })
    if (o.kind === 'fold') return c.act({ type: 'fold', seat })
    if (o.kind === 'call' || o.kind === 'check') return c.act({ type: 'call', seat })
    if (o.kind === 'straddle') return c.act({ type: 'straddle' })
    return setAmount({ seat, kind: o.kind === 'allin' ? 'allin' : 'raise' })
  }

  /** The two cards a player holds: face down, face up once entered; gone when they folded unseen, faded when seen. */
  const holeCards = (s) => {
    if (!dealt || !t.seats.includes(s)) return <span className="w-10 shrink-0" />
    const known = t.shownHands[s]
    if (!known && folded(s)) return <span className="w-10 shrink-0" />
    const face = typeof known === 'string'
      ? <span className="flex h-6 items-center rounded bg-ink/90 px-1 text-[9px] font-bold text-bg">{known}</span>
      : [0, 1].map((i) => <Card key={i} card={known?.[i]} dealt small />)
    return (
      <button type="button" aria-label={`${names[s]}'s cards`} className={`flex w-10 shrink-0 gap-0.5 active:opacity-70 ${folded(s) ? 'opacity-35' : ''}`} onClick={() => openPlayer(s)}>
        {face}
      </button>
    )
  }

  const controls = (s) => {
    const choices = Table.seatChoices(t, s)
    // The seat to act, or the suggested dealer, is the likely tap; later seats are a little quieter (still one tap).
    const likely = !dealt ? s === t.suggestedDealer : s === next
    // The straddle, while on offer, takes the place of the buy-in and stack; the rest go two to a row.
    const straddle = choices.find((o) => o.kind === 'straddle')
    const rest = choices.filter((o) => o !== straddle)
    const rows = [rest.slice(0, 2), rest.slice(2)].filter((r) => r.length)
    const known = c.buyIns[s] != null
    return (
      <div className="flex h-full flex-col gap-1">
        <div className="flex h-7 shrink-0 items-center gap-1">
          {holeCards(s)}
          {straddle && <Button size="xs" variant="raise" className="flex-1" onClick={() => answer(s, straddle)}>Straddle {straddle.amount}</Button>}
          {!straddle && known && (
            <button
              type="button"
              aria-label={`${names[s]}: buy-in ${c.buyIns[s]}, stack ${stackLabel(c.stacks[s])}`}
              disabled={c.past || c.editing}
              className="flex h-full flex-1 items-center justify-end gap-2 active:opacity-70"
              onClick={() => openPlayer(s)}
            >
              <BuyInMark buyIn={c.buyIns[s]} unit={c.settings.buyIn} />
              <StackBars stack={c.stacks[s]} />
            </button>
          )}
        </div>
        {rows.map((r, i) => (
          <div key={i} className={`grid gap-1 ${r.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {r.map((o) => (
              <Button key={o.kind} size="xs" variant={CHOICE_VARIANT[o.kind] ?? 'secondary'} active={likely && o.kind === 'dealer'} className={`px-0.5 ${likely ? '' : 'opacity-60'}`} onClick={() => answer(s, o)}>{choiceLabel(o)}</Button>
            ))}
          </div>
        ))}
        {over && t.seats.includes(s) && <Button size="xs" className="w-full" onClick={() => openPlayer(s)}>Cards</Button>}
      </div>
    )
  }

  // Blue for the player to act, lit for everyone else still in the hand, faded for who folded or sits out.
  const tones = Object.fromEntries(t.allSeats.map((s) => [s, t.out.includes(s) || folded(s) ? 'ghost' : dealt && !over && s === next ? 'primary' : 'surface']))
  const closeLog = (then) => (...args) => { setLogOpen(false); then(...args) }
  const logText = !last ? 'Nothing entered yet' : last.kind === 'mark' ? last.text : `${names[last.seat]} ${last.text}${last.auto ? ' · auto' : ''}`
  const bets = dealt && !over ? Object.fromEntries(t.seats.map((s) => [s, betOf(t.status[s])]).filter(([, b]) => b)) : {}
  const seat = c.session.seats.find((x) => x.seat === open)
  const playing = c.session.seats.filter((x) => !x.sittingOut).length
  const amountSeat = amount?.seat
  const cardsHere = dealt && t.seats.includes(open)
  return (
    <>
      <div className="min-h-0 flex-1 px-1 py-1">
        <SeatMap
          fill
          seats={t.allSeats}
          names={names}
          heroSeat={t.heroSeat}
          status={Table.seatStatus(t)}
          tones={tones}
          badges={t.dealerSeat != null ? { [t.dealerSeat]: 'D' } : {}}
          board={board}
          below={Object.fromEntries(t.allSeats.map((s) => [s, controls(s)]))}
          bets={bets}
          onPick={(s) => openPlayer(s)}
        />
      </div>
      <div className="shrink-0 border-t border-line">
        <Row label="Log" text={logText} trailing="▴" onClick={() => setLogOpen(true)} />
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-line px-3 py-2">
        {!dealt && <div className="flex h-12 items-center justify-center text-xs text-muted">Tap Dealer under the dealer’s seat</div>}
        {dealt && !over && (
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-12" onClick={() => c.act({ type: 'next-street' })}>End Street</Button>
            <Button className="h-12" onClick={endHand}>End Hand</Button>
          </div>
        )}
        {over && (c.canContinue || !c.editing) && (
          <div className={`grid gap-2 ${c.canContinue && !c.editing ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {c.canContinue && <Button className="h-12" onClick={c.continueHand}>Continue Hand</Button>}
            {!c.editing && <Button variant="primary" className="h-12" onClick={endHand}>Save Hand</Button>}
          </div>
        )}
        {c.editing && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="h-12" onClick={c.cancelEdit}>Cancel</Button>
            <Button variant="primary" className="h-12" onClick={c.saveEdit}>Save Changes</Button>
          </div>
        )}
      </div>

      <Sheet open={amount !== null} title={amount && `${names[amountSeat]} ${amount.kind === 'allin' ? 'All-In' : t.highest === 0 ? 'Bets' : 'Raises To'}`} onClose={() => setAmount(null)}>
        {amount && <TurnAmount t={t} seat={amountSeat} kind={amount.kind} onAnswer={(v) => { c.act({ type: amount.kind, seat: amountSeat, amount: v }); setAmount(null) }} onCancel={() => setAmount(null)} />}
      </Sheet>
      <Sheet open={logOpen} title="Hand Log" onClose={() => setLogOpen(false)}>
        <LogRows c={c} onEdit={closeLog(onEdit)} onBoard={closeLog(() => board.onPick?.())} onShown={closeLog(openPlayer)} onNote={closeLog(onNote)} />
        <Button variant="primary" className="mt-4 w-full" onClick={() => setLogOpen(false)}>Done</Button>
        <div ref={logEnd} />
      </Sheet>
      <PlayerSheet
        open={player !== null}
        title={seat && `${seat.name}${seat.seat === t.heroSeat ? ' (you)' : ''}`}
        seat={seat}
        settings={c.settings}
        chips={!c.past && !c.editing} // a saved hand keeps the buy-in and stack it was played with
        top={
          <>
            {cardsHere && (
              <>
                <div className="mb-2 flex h-9 items-center justify-between text-xs">
                  <span className="font-semibold">{[0, 1].map((i) => (pick[i] ? cardLabel(pick[i]) : '—')).join('  ')}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted">One or two cards</span>
                    <Button variant="ghost" size="sm" className="w-14" disabled={!pick.length} onClick={() => setPick([])}>Clear</Button>
                  </span>
                </div>
                <CardPicker value={pick} max={2} taken={Table.usedCards(t, open)} onChange={setPick} />
              </>
            )}
            <Button className="mt-3 w-full" disabled={c.past || (seat && !seat.sittingOut && playing <= 2)} onClick={() => c.toggleSitOut(open)}>{seat?.sittingOut ? 'Return' : 'Sit Out'}</Button>
          </>
        }
        onStack={c.setStack}
        onBuyIn={c.setBuyIn}
        onClose={closePlayer}
      />
    </>
  )
}
