// Screen router: four tabs along the top. Phone-width column, centred when viewed on a desktop browser.
import { useEffect, useState } from 'react'
import { useStorage } from './app/StorageContext.jsx'
import { TabBar } from './components/TabBar.jsx'
import { TopBar } from './components/TopBar.jsx'
import { withEnded } from './domain/session.js'
import { SettingsScreen } from './screens/SettingsScreen.jsx'
import { HistoryScreen } from './screens/HistoryScreen.jsx'
import { SessionSetupScreen } from './screens/SessionSetupScreen.jsx'
import { ActiveSession } from './screens/ActiveSession.jsx'

const TABS = [
  { id: 'settings', label: 'Settings' },
  { id: 'history', label: 'History' },
  { id: 'session', label: 'Session' },
  { id: 'hand', label: 'Hand' },
]

export default function App() {
  const storage = useStorage()
  const [tab, setTab] = useState(null)
  const [settings, setSettings] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => {
    storage.persist() // ask the browser to keep this app's data even when space runs low
    Promise.all([storage.settings.get(), storage.sessions.current()]).then(([s, current]) => {
      setSettings(s)
      setSession(current)
      setTab(!s.heroPlayerId ? 'settings' : current ? 'hand' : 'session')
    })
  }, [storage])

  const endSession = async (s) => {
    await storage.sessions.save(withEnded(s))
    await storage.drafts.remove(s.id)
    setSession(null)
    setTab('session')
  }

  if (!tab) return null
  return (
    // The safe-area padding keeps the app clear of the phone's status bar and gesture bar when it runs installed.
    <div className="mx-auto flex h-full w-full max-w-[430px] flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <TabBar tabs={TABS} value={tab} onChange={setTab} />
      <div className="relative min-h-0 flex-1">
        {tab === 'settings' && <SettingsScreen onChange={setSettings} />}
        {tab === 'history' && <HistoryScreen />}
        {!session && (
          <div className={tab === 'session' ? 'h-full' : 'hidden'}>
            <SessionSetupScreen settings={settings} active={tab === 'session'} onStarted={(s) => { setSession(s); setTab('hand') }} />
          </div>
        )}
        {!session && tab === 'hand' && (
          <div className="flex h-full flex-col">
            <TopBar title="Hand" subtitle="No session in progress" />
            <div className="p-3 text-xs text-muted">Start a session on the Session tab.</div>
          </div>
        )}
        {session && <ActiveSession key={session.id} session={session} settings={settings} tab={tab} onShowHand={() => setTab('hand')} onEndSession={endSession} />}
      </div>
    </div>
  )
}
