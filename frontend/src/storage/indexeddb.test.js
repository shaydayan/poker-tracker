import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createIndexedDbStorage } from './indexeddb.js'
import { createMemoryStorage } from './memory.js'
import { DEFAULT_SETTINGS } from '../domain/settings.js'
import { makeBackup, readBackup } from '../domain/backup.js'

const fresh = () => {
  const idb = new IDBFactory()
  return { idb, storage: createIndexedDbStorage(idb, {}) }
}

describe('IndexedDB storage', () => {
  it('starts empty, with default settings', async () => {
    const { storage } = fresh()
    expect(await storage.settings.get()).toEqual(DEFAULT_SETTINGS)
    expect(await storage.players.list()).toEqual([])
    expect(await storage.sessions.current()).toBe(null)
  })

  it('keeps everything after the app is closed and opened again', async () => {
    const { idb, storage } = fresh()
    await storage.settings.save({ ...DEFAULT_SETTINGS, heroPlayerId: 1, bigBlind: 10 })
    const dani = await storage.players.add('Dani')
    await storage.sessions.save({ id: 7, date: '2026-11-15', seats: [], ended: false })
    await storage.hands.save({ format: 1, id: '7-1', sessionId: 7, handNo: 1, actions: [{ type: 'dealer', seat: 1 }] })
    await storage.hands.save({ format: 1, id: '8-1', sessionId: 8, handNo: 1, actions: [] })
    await storage.drafts.save({ sessionId: 7, base: { handNo: 2 }, actions: [{ type: 'dealer', seat: 2 }] })

    const reopened = createIndexedDbStorage(idb, {})
    expect((await reopened.settings.get()).bigBlind).toBe(10)
    expect(await reopened.players.list()).toEqual([dani])
    expect((await reopened.sessions.current()).id).toBe(7)
    expect((await reopened.hands.listBySession(7)).map((h) => h.id)).toEqual(['7-1'])
    expect((await reopened.drafts.get(7)).actions).toEqual([{ type: 'dealer', seat: 2 }])
  })

  it('gives new settings their defaults when older saved settings lack them', async () => {
    const { storage } = fresh()
    const { straddle, ...older } = { ...DEFAULT_SETTINGS, heroPlayerId: 3 }
    await storage.settings.save(older)
    expect(await storage.settings.get()).toEqual({ ...DEFAULT_SETTINGS, heroPlayerId: 3, straddle })
  })

  it('removes players, hands and drafts', async () => {
    const { storage } = fresh()
    const a = await storage.players.add('A')
    const b = await storage.players.add('B')
    expect(b.id).not.toBe(a.id)
    await storage.players.remove(a.id)
    expect(await storage.players.list()).toEqual([b])
    await storage.players.rename(b.id, 'Bea')
    expect(await storage.players.list()).toEqual([{ id: b.id, name: 'Bea' }])
    await storage.hands.save({ id: '1-1', sessionId: 1 })
    await storage.hands.remove('1-1')
    expect(await storage.hands.listBySession(1)).toEqual([])
    await storage.drafts.save({ sessionId: 1, actions: [] })
    await storage.drafts.remove(1)
    expect(await storage.drafts.get(1)).toBe(null)
  })
})

describe('deleting', () => {
  it('removes a session with its hands and draft, and nothing else', async () => {
    const { idb, storage } = fresh()
    for (const id of [1, 2]) {
      await storage.sessions.save({ id, date: '2026-11-15', seats: [], ended: true })
      await storage.hands.save({ id: `${id}-1`, sessionId: id })
      await storage.hands.save({ id: `${id}-2`, sessionId: id })
      await storage.drafts.save({ sessionId: id, actions: [] })
    }
    await storage.sessions.remove(1)
    const after = await createIndexedDbStorage(idb, {}).backup.dump()
    expect(after.sessions.map((s) => s.id)).toEqual([2])
    expect(after.hands.map((h) => h.id)).toEqual(['2-1', '2-2'])
    expect(after.drafts.map((d) => d.sessionId)).toEqual([2])
  })
})

describe('backup', () => {
  it('round-trips everything through the file into an empty device', async () => {
    const source = createMemoryStorage() // the sample roster, session and hands
    const text = JSON.stringify(makeBackup(await source.backup.dump(), '2026-11-15T20:00:00Z'))
    const { exportedAt, data } = readBackup(text)
    expect(exportedAt).toBe('2026-11-15T20:00:00Z')

    const { idb, storage } = fresh()
    await storage.backup.restore(data)
    const after = await createIndexedDbStorage(idb, {}).backup.dump()
    const before = await source.backup.dump()
    const byId = (xs) => [...xs].sort((x, y) => String(x.id).localeCompare(String(y.id)))
    expect(byId(after.players)).toEqual(byId(before.players))
    expect(byId(after.sessions)).toEqual(byId(before.sessions))
    expect(byId(after.hands)).toEqual(byId(before.hands))
    expect(after.settings).toEqual(before.settings)
  })

  it('replaces what was on the device', async () => {
    const { storage } = fresh()
    await storage.players.add('Old')
    await storage.backup.restore({ settings: null, players: [{ id: 5, name: 'New' }], sessions: [], hands: [], drafts: [] })
    expect(await storage.players.list()).toEqual([{ id: 5, name: 'New' }])
    expect((await storage.players.add('Next')).id).toBe(6) // ids keep counting after the restored ones
  })

  it('refuses files it cannot use', () => {
    expect(() => readBackup('not json')).toThrow('not a backup file')
    expect(() => readBackup('{"app":"other"}')).toThrow('not a backup file')
    expect(() => readBackup('{"app":"poker-tracker","format":99,"players":[],"sessions":[],"hands":[]}')).toThrow('newer version')
    expect(() => readBackup('{"app":"poker-tracker","format":1,"players":[]}')).toThrow('damaged')
  })
})
