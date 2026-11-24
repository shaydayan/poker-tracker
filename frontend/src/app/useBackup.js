// Backup to a file and back: Export saves everything on the device as a JSON file (keep it in Drive, email it); Import
// reads one, shows what it holds, and on confirm replaces everything on the device with it. `reading` is true from the
// moment the file picker opens until the file is read (the phone may take a while to hand it over, e.g. from Drive).
import { useEffect, useRef, useState } from 'react'
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
  const [reading, setReading] = useState(false)
  const fallback = useRef(null)

  useEffect(() => { storage.persist().then(setKept) }, [storage])
  // A picker closed without a file does not always say so: once the app is back in front, give up waiting after a while.
  useEffect(() => {
    if (!reading) return undefined
    const onFocus = () => { clearTimeout(fallback.current); fallback.current = setTimeout(() => setReading(false), 15000) }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus); clearTimeout(fallback.current) }
  }, [reading])

  return {
    kept,
    pending,
    error,
    reading,
    /** The file picker is opening. */
    picking: () => { setError(null); setReading(true) },
    /** It was closed without a file. */
    pickCancelled: () => setReading(false),
    exportFile: async () => {
      const now = new Date().toISOString()
      download(JSON.stringify(makeBackup(await storage.backup.dump(), now)), backupFileName(now.slice(0, 10)))
    },
    /** Read a chosen file; a usable one waits in `pending` for confirmation. */
    choose: async (file) => {
      setReading(true)
      try {
        setPending(readBackup(await file.text()))
        setError(null)
      } catch (e) {
        setError(e.message)
      } finally {
        setReading(false)
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
