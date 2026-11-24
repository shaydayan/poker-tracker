// The hand's log (both views of the Hand screen), always in the same order: who sits out and the dealer; then the
// betting street by street (a heading with the street's board cards, then one row per player turn, "auto" on the ones the
// app filled in, and End Street / End Hand where they were pressed); then the cards shown and the note. Every row opens
// what changes it: a turn, End Street, End Hand, the dealer and who sits out go to `onEdit` ({ kind: 'turn' | 'mark' |
// 'dealer' | 'out', index? }), a street heading to `onBoard`, a Shown row to `onShown(seat)`, the note to `onNote`.
// Nothing in the log moves or fades when a row is tapped.
import { Row } from '../../components/Row.jsx'
import { cardLabel, handLabel } from '../../domain/cards.js'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

export function LogRows({ c, onEdit, onBoard, onShown, onNote }) {
  const t = c.table
  const names = t.players
  const line = (key, row, band = false) => (
    <div key={key} data-row={key} className={`border-b border-line ${band ? 'bg-panel/50' : ''}`}>
      {row}
    </div>
  )
  return (
    <>
      {line('out', <Row label="Sitting Out" text={t.out.length ? t.out.map((s) => names[s]).join(', ') : 'Nobody'} trailing="▸" onClick={() => onEdit({ kind: 'out' })} />)}
      {t.dealerSeat != null && line('dealer', <Row label="Dealer" text={names[t.dealerSeat]} trailing="▸" onClick={() => onEdit({ kind: 'dealer' })} />)}
      {c.log.map((r, i) => {
        if (r.kind === 'street') {
          const board = r.street !== 'preflop'
          return line(`s${i}`, <Row label={cap(r.street)} text={r.cards.length ? r.cards.map(cardLabel).join(' ') : board ? 'No cards yet' : ''} trailing={board ? '✎' : ''} onClick={board ? onBoard : undefined} />, true)
        }
        if (r.kind === 'mark') return line(`m${i}`, <Row label="" text={r.text} trailing="▸" onClick={() => onEdit({ kind: 'mark', index: r.index })} />)
        return line(`t${i}`, <Row label={names[r.seat]} text={`${r.text}${r.auto ? ' · auto' : ''}`} trailing="▸" onClick={() => onEdit({ kind: 'turn', index: r.index })} />)
      })}
      {Object.entries(t.shownHands).map(([s, cards]) => line(`shown${s}`, <Row label="Shown" text={`${names[s]} · ${handLabel(cards)}`} trailing="✎" onClick={() => onShown(Number(s))} />))}
      {c.note && line('note', <Row label="Note" text={c.note} trailing="✎" onClick={onNote} />)}
    </>
  )
}
