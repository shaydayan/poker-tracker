// The hands of the session in progress. Tap one to reopen it on the Hand tab; End Session closes the evening.
import { Button } from '../components/Button.jsx'
import { Row } from '../components/Row.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { recordLines, recordSummary } from '../domain/record.js'

export function SessionScreen({ session, hands, onOpenHand, onEndSession }) {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="Session" subtitle={`${session.date} · ${session.seats.length} players · ${hands.length} hands`} />
      <div className="flex-1 overflow-y-auto">
        {hands.length === 0 && <div className="p-3 text-xs text-muted">No hands saved yet.</div>}
        {hands.map((r) => (
          <div key={r.id} className="border-b border-line">
            <Row label={`#${r.handNo}${r.heroCards ? ` ${r.heroCards}` : ''}`} text={recordSummary(r)} trailing="▸" onClick={() => onOpenHand(r)} />
          </div>
        ))}
      </div>
      <div className="flex h-16 shrink-0 items-center border-t border-line px-3">
        <Button variant="danger" className="w-full" onClick={onEndSession}>End Session</Button>
      </div>
    </div>
  )
}
