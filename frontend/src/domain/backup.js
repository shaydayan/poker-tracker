// The backup file: everything on the device as one JSON document, so data survives a lost or reset phone. Pure.
// `format` only ever grows; a newer app must keep reading every older format (add a migration here when it changes).

export const BACKUP_FORMAT = 1

/** `data` is { settings, players, sessions, hands, drafts } as the storage port returns it. */
export function makeBackup(data, exportedAt) {
  return { app: 'poker-tracker', format: BACKUP_FORMAT, exportedAt, ...data }
}

/** The data in a backup file's text, or an Error saying why it cannot be used. */
export function readBackup(text) {
  let b
  try {
    b = JSON.parse(text)
  } catch {
    throw new Error('This is not a backup file.')
  }
  if (b?.app !== 'poker-tracker') throw new Error('This is not a backup file.')
  if (!(b.format >= 1 && b.format <= BACKUP_FORMAT)) throw new Error('This backup is from a newer version of the app.')
  for (const k of ['players', 'sessions', 'hands']) if (!Array.isArray(b[k])) throw new Error('This backup file is damaged.')
  return { exportedAt: b.exportedAt ?? null, data: { settings: b.settings ?? null, players: b.players, sessions: b.sessions, hands: b.hands, drafts: b.drafts ?? [] } }
}

/** "poker-tracker-2026-11-15.json" */
export const backupFileName = (date) => `poker-tracker-${date}.json`
