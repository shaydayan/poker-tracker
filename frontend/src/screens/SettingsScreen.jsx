// Your name, blinds, default raise sizes, the saved player roster, and backup. Changes save as you make them.
import { useRef, useState } from 'react'
import { useSettings } from '../app/useSettings.js'
import { useBackup } from '../app/useBackup.js'
import { ConfirmSheet } from './ConfirmSheet.jsx'
import { Button } from '../components/Button.jsx'
import { Field } from '../components/Field.jsx'
import { TopBar } from '../components/TopBar.jsx'

export function SettingsScreen({ onChange }) {
  const s = useSettings(onChange)
  const b = useBackup()
  const fileRef = useRef(null)
  const [newName, setNewName] = useState('')
  const [heroName, setHeroName] = useState(null) // your name as typed; null = as saved
  const heroValue = heroName ?? s.hero?.name ?? ''
  const heroProblem = heroValue.trim() ? s.heroNameProblem(heroValue) : null
  const nameProblem = newName.trim() ? s.nameProblem(newName) : null
  const num = (key) => ({ type: 'number', inputMode: 'decimal', className: 'flex-1', value: s.settings[key], onChange: (e) => s.update({ [key]: Number(e.target.value) }) })

  return (
    <div className="relative flex h-full flex-col">
      <TopBar title="Settings" subtitle="Saved as you type" />
      <div className="h-4 shrink-0 px-3 text-xs text-raise">{s.error ?? ''}</div>
      <div className="flex-1 overflow-y-auto p-3">
        <Field
          label="Your Name"
          placeholder="Name"
          value={heroValue}
          onChange={(e) => { setHeroName(e.target.value); s.saveHeroName(e.target.value) }}
        />
        <div className="mt-1 h-4 text-xs text-raise">{heroProblem ?? ''}</div>
        <div className="mt-5 mb-1 text-xs text-muted">Blinds</div>
        <div className="flex gap-2">
          <Field label="Small Blind" {...num('smallBlind')} />
          <Field label="Big Blind" {...num('bigBlind')} />
          <Field label="Straddle" {...num('straddle')} />
        </div>
        <div className="mt-5 mb-1 text-xs text-muted">Default Raises</div>
        <div className="flex gap-2">
          <Field label="Open Raise" {...num('openRaise')} />
          <Field label="Open Over Straddle" {...num('straddleOpenRaise')} />
        </div>
        <div className="mt-2 flex gap-2">
          <Field label="3-Bet ×" step="0.5" {...num('threeBet')} />
          <Field label="4-Bet+ ×" step="0.5" {...num('fourBet')} />
          <Field label="Postflop Raise ×" step="0.5" {...num('postflopRaise')} />
        </div>
        <div className="mt-5 mb-1 text-xs text-muted">Players</div>
        <div className="flex flex-col gap-2">
          {s.others.map((p) => (
            <div key={p.id} className="flex h-11 items-center gap-2 rounded-lg border border-line bg-panel px-3">
              <span className="flex-1 truncate text-sm">{p.name}</span>
              <Button variant="ghost" size="sm" className="w-16" onClick={() => s.removePlayer(p.id)}>Remove</Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <Field label="Add Player" placeholder="Name" className="flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button className="w-20" disabled={!newName.trim() || !!nameProblem} onClick={async () => { await s.addPlayer(newName); setNewName('') }}>Add</Button>
        </div>
        <div className="mt-1 h-4 text-xs text-raise">{nameProblem ?? ''}</div>
        <div className="mt-5 mb-1 text-xs text-muted">Backup</div>
        <div className="mb-2 text-xs text-muted">
          {b.kept === false ? 'The browser may clear this data when space runs low. Export a backup regularly.' : 'Your data is kept on this device. Export a backup now and then, in case the phone is lost or reset.'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={b.exportFile}>Export Backup</Button>
          <Button onClick={() => fileRef.current.click()}>Import Backup</Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) b.choose(e.target.files[0]); e.target.value = '' }}
        />
        <div className="mt-1 h-4 text-xs text-raise">{b.error ?? ''}</div>
      </div>

      <ConfirmSheet
        title="Import Backup"
        message={b.pending && `Replace everything on this device with the backup${b.pending.exportedAt ? ` from ${b.pending.exportedAt.slice(0, 10)}` : ''}: ${b.pending.data.players.length} players, ${b.pending.data.sessions.length} sessions, ${b.pending.data.hands.length} hands. This can't be undone.`}
        action="Replace"
        onConfirm={b.restore}
        onCancel={b.cancel}
      />
    </div>
  )
}
