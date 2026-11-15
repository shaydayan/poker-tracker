// Backup to a file and back: Export saves everything on the device as a JSON file (keep it in Drive, email it); Import
// reads one, shows what it holds, and on confirm replaces everything on the device with it.
import { useEffect, useState } from 'react'
import { backupFileName, makeBackup, readBackup } from '../domain/backup.js'
import { useStorage } from './StorageContext.jsx'

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useBackup() {
  const storage = useStorage()
  const [kept, setKept] = useState(null) // whether the browser agreed to keep the data; null until known
  const [pending, setPending] = useState(null) // { exportedAt, data } from a chosen file, waiting for confirmation
  const [error, setError] = useState(null)

  useEffect(() => { storage.persist().then(setKept) }, [storage])

  return {
    kept,
    pending,
    error,
    exportFile: async () => {
      const now = new Date().toISOString()
      download(JSON.stringify(makeBackup(await storage.backup.dump(), now)), backupFileName(now.slice(0, 10)))
    },
    /** Read a chosen file; a usable one waits in `pending` for confirmation. */
    choose: async (file) => {
      try {
        setPending(readBackup(await file.text()))
        setError(null)
      } catch (e) {
        setError(e.message)
      }
    },
    cancel: () => setPending(null),
    /** Replace everything on the device with the pending backup, then start the app again on it. */
    restore: async () => {
      await storage.backup.restore(pending.data)
      window.location.reload()
    },
  }
}
