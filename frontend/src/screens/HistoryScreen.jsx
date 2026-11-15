// Every past session. Tap one to see its hands, and a hand to see it street by street. Long-press a session or a hand to
// delete it (after a confirmation; a deleted session takes its hands with it).
import { useEffect, useState } from 'react'
import { useStorage } from '../app/StorageContext.jsx'
import { Row } from '../components/Row.jsx'
import { TopBar } from '../components/TopBar.jsx'
import { recordLines, recordSummary } from '../domain/record.js'
import { ConfirmSheet } from './ConfirmSheet.jsx'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function HistoryScreen() {
  const storage = useStorage()
  const [sessions, setSessions] = useState([])
  const [open, setOpen] = useState(null) // session id
  const [hands, setHands] = useState({}) // session id -> records
  const [openHand, setOpenHand] = useState(null) // record id
  const [doomed, setDoomed] = useState(null) // { session } or { hand } waiting for the delete to be confirmed

  useEffect(() => {
    storage.sessions.list().then((all) => setSessions(all.filter((s) => s.ended).sort((a, b) => (a.date < b.date ? 1 : -1))))
  }, [storage])

  const handsOf = async (id) => {
    if (hands[id]) return hands[id]
    const list = (await storage.hands.listBySession(id)).sort((a, b) => a.handNo - b.handNo)
    setHands((h) => ({ ...h, [id]: list }))
    return list
  }
  const toggle = async (id) => {
    if (open === id) return setOpen(null)
    setOpen(id)
    await handsOf(id)
  }
  const askSession = async (s) => setDoomed({ session: s, count: (await handsOf(s.id)).length })
  const confirm = async () => {
    if (doomed.session) {
      await storage.sessions.remove(doomed.session.id)
      setSessions((ss) => ss.filter((s) => s.id !== doomed.session.id))
    } else {
      await storage.hands.remove(doomed.hand.id)
      setHands((h) => ({ ...h, [doomed.hand.sessionId]: h[doomed.hand.sessionId].filter((r) => r.id !== doomed.hand.id) }))
    }
    setDoomed(null)
  }
  const message = doomed?.session
    ? `Delete the session of ${doomed.session.date} with its ${plural(doomed.count, 'hand')}? This can't be undone.`
    : doomed?.hand
      ? `Delete hand #${doomed.hand.handNo} (${recordSummary(doomed.hand)})? This can't be undone.`
      : null

  return (
    <div className="relative flex h-full flex-col">
      <TopBar title="History" subtitle={`${plural(sessions.length, 'past session')} · long-press to delete`} />
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && <div className="p-3 text-xs text-muted">No finished sessions yet.</div>}
        {sessions.map((s) => (
          <div key={s.id} className="border-b border-line">
            <Row
              label={s.date}
              text={`${s.seats.length} players · ${s.seats.map((x) => x.name).join(', ')}`}
              trailing={open === s.id ? '▾' : '▸'}
              active={open === s.id}
              onClick={() => toggle(s.id)}
              onLongPress={() => askSession(s)}
            />
            {open === s.id && (
              <div className="bg-panel/50">
                {(hands[s.id] ?? []).map((r) => (
                  <div key={r.id}>
                    <Row
                      label={`#${r.handNo}${r.heroCards ? ` ${r.heroCards}` : ''}`}
                      text={recordSummary(r)}
                      trailing={openHand === r.id ? '▾' : '▸'}
                      active={openHand === r.id}
                      onClick={() => setOpenHand(openHand === r.id ? null : r.id)}
                      onLongPress={() => setDoomed({ hand: r })}
                    />
                    {openHand === r.id && <div className="pl-4">{recordLines(r).map((l) => <Row key={l.label} label={l.label} text={l.text} wrap />)}</div>}
                  </div>
                ))}
                {hands[s.id]?.length === 0 && <div className="h-9 px-3 text-xs leading-9 text-muted">No hands recorded.</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      <ConfirmSheet title={doomed?.session ? 'Delete Session' : 'Delete Hand'} message={message} action="Delete" onConfirm={confirm} onCancel={() => setDoomed(null)} />
    </div>
  )
}
