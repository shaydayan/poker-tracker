// Owns the capture state for the session in progress and shows either its hands (Session tab) or the current hand (Hand tab).
// Stays mounted while other tabs are shown, so a half-captured hand is never lost.
import { useHandCapture } from '../app/useHandCapture.js'
import { HandScreen } from './HandScreen.jsx'
import { SessionScreen } from './SessionScreen.jsx'

export function ActiveSession({ session, settings, tab, onShowHand, onEndSession }) {
  const c = useHandCapture(session, settings)
  return (
    <>
      <div className={tab === 'session' ? 'h-full' : 'hidden'}>
        <SessionScreen session={c.session} hands={c.hands} onOpenHand={(r) => { c.openHand(r); onShowHand() }} onDeleteHand={c.deleteHand} onEndSession={() => onEndSession(c.session)} />
      </div>
      <div className={tab === 'hand' ? 'h-full' : 'hidden'}>
        <HandScreen c={c} />
      </div>
    </>
  )
}
