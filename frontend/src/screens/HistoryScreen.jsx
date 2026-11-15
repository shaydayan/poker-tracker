// Every past session. Tap one to see its hands, and a hand to see it street by street.
import { useEffect, useState } from 'react'
import { useStorage } from '../app/StorageContext.jsx'
import { Row } from '../components/Row.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { recordLines, recordSummary } from '../domain/record.js'

export function HistoryScreen() {
  const storage = useStorage()
  const [sessions, setSessions] = useState([])
  const [open, setOpen] = useState(null) // session id
  const [hands, setHands] = useState({}) // session id -> records
  const [openHand, setOpenHand] = useState(null) // record id

  useEffect(() => {
    storage.sessions.list().then((all) => setSessions(all.filter((s) => s.ended).sort((a, b) => (a.date < b.date ? 1 : -1))))
  }, [storage])

  const toggle = async (id) => {
    if (open === id) return setOpen(null)
    setOpen(id)
    if (!hands[id]) {
      const list = await storage.hands.listBySession(id)
      setHands((h) => ({ ...h, [id]: list.sort((a, b) => a.handNo - b.handNo) }))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="History" subtitle={`${sessions.length} past sessions`} />
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && <div className="p-3 text-xs text-muted">No finished sessions yet.</div>}
        {sessions.map((s) => (
          <div key={s.id} className="border-b border-line">
            <Row label={s.date} text={`${s.seats.length} players · ${s.seats.map((x) => x.name).join(', ')}`} trailing={open === s.id ? '▾' : '▸'} active={open === s.id} onClick={() => toggle(s.id)} />
            {open === s.id && (
              <div className="bg-panel/50">
                {(hands[s.id] ?? []).map((r) => (
                  <div key={r.id}>
                    <Row label={`#${r.handNo}${r.heroCards ? ` ${r.heroCards}` : ''}`} text={recordSummary(r)} trailing={openHand === r.id ? '▾' : '▸'} active={openHand === r.id} onClick={() => setOpenHand(openHand === r.id ? null : r.id)} />
                    {openHand === r.id && <div className="pl-4">{recordLines(r).map((l) => <Row key={l.label} label={l.label} text={l.text} wrap />)}</div>}
                  </div>
                ))}
                {hands[s.id]?.length === 0 && <div className="h-9 px-3 text-xs leading-9 text-muted">No hands recorded.</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
