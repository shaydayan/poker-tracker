// The hands of the session in progress. Tap one to reopen it on the Hand tab; long-press one to delete it (Undo on the
// Hand tab brings it back); End Session closes the evening.
import { useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Row } from '../components/Row.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { recordLabel, recordSummary } from '../domain/record.js'
import { ConfirmSheet } from './ConfirmSheet.jsx'

export function SessionScreen({ session, hands, onOpenHand, onDeleteHand, onEndSession }) {
  const [doomed, setDoomed] = useState(null) // the hand waiting for its delete to be confirmed
  return (
    <div className="relative flex h-full flex-col">
      <TopBar title="Session" subtitle={`${session.date} · ${session.seats.length} players · ${hands.length} hands · long-press to delete`} />
      <div className="flex-1 overflow-y-auto">
        {hands.length === 0 && <div className="p-3 text-xs text-muted">No hands saved yet.</div>}
        {hands.map((r) => (
          <div key={r.id} className="border-b border-line">
            <Row label={recordLabel(r)} text={recordSummary(r)} trailing="▸" onClick={() => onOpenHand(r)} onLongPress={() => setDoomed(r)} />
          </div>
        ))}
      </div>
      <div className="flex h-16 shrink-0 items-center border-t border-line px-3">
        <Button variant="danger" className="w-full" onClick={onEndSession}>End Session</Button>
      </div>
      <ConfirmSheet
        title="Delete Hand"
        message={doomed && `Delete hand #${doomed.handNo} (${recordSummary(doomed)})? Undo on the Hand tab brings it back.`}
        action="Delete"
        onConfirm={() => { onDeleteHand(doomed); setDoomed(null) }}
        onCancel={() => setDoomed(null)}
      />
    </div>
  )
}
