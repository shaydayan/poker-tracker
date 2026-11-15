// "Are you sure?" for anything that can't be taken back (deleting, replacing data): the existing Sheet and Buttons,
// a short message, Cancel and a red action button.
import { Button } from '../components/Button.jsx'
import { Sheet } from '../components/Sheet.jsx'

/** Open while `message` is set; `action` is the red button's label. */
export function ConfirmSheet({ title, message, action, onConfirm, onCancel }) {
  return (
    <Sheet open={message != null} title={title} onClose={onCancel}>
      <div className="mb-4 text-sm">{message}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>{action}</Button>
      </div>
    </Sheet>
  )
}
