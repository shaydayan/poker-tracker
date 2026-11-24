// IndexedDB adapter for the ports in domain/ports.js: the real on-device storage. Every write resolves only once its
// transaction has committed (with strict durability where the browser supports it), so a resolved save is on disk.
//
// Schema changes: bump DB_VERSION and add a step to `upgrade` for the old version; never drop or rewrite stored hands.
import { DEFAULT_SETTINGS } from '../domain/settings.js'
import { byHandNo } from '../domain/record.js'

const DB_NAME = 'poker-tracker'
const DB_VERSION = 1
const STORES = ['kv', 'players', 'sessions', 'hands', 'drafts']

function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('kv') // settings, under the key 'settings'
    db.createObjectStore('players', { keyPath: 'id', autoIncrement: true })
    db.createObjectStore('sessions', { keyPath: 'id' })
    db.createObjectStore('hands', { keyPath: 'id' }).createIndex('sessionId', 'sessionId')
    db.createObjectStore('drafts', { keyPath: 'sessionId' }) // the hand in progress, one per session
  }
}

function openDb(idb) {
  return new Promise((resolve, reject) => {
    const r = idb.open(DB_NAME, DB_VERSION)
    r.onupgradeneeded = (e) => upgrade(r.result, e.oldVersion)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/** `idb` is the browser's indexedDB (or a stand-in in tests); `nav` its navigator, for persistent storage. */
export function createIndexedDbStorage(idb, nav = globalThis.navigator) {
  const dbp = openDb(idb)

  /** Run `fn(stores)` in one transaction; resolves with the last request's result once it has committed. */
  async function run(names, mode, fn) {
    const db = await dbp
    return new Promise((resolve, reject) => {
      const t = db.transaction(names, mode, { durability: 'strict' })
      const stores = Object.fromEntries([names].flat().map((n) => [n, t.objectStore(n)]))
      const r = fn(stores)
      let result
      if (r) r.onsuccess = () => { result = r.result }
      t.oncomplete = () => resolve(result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error ?? new Error('Storage transaction aborted'))
    })
  }
  const read = (name, fn) => run(name, 'readonly', (s) => fn(s[name]))
  const write = (name, fn) => run(name, 'readwrite', (s) => fn(s[name]))

  return {
    settings: {
      // New settings get their defaults when older stored settings lack them.
      get: async () => ({ ...DEFAULT_SETTINGS, ...((await read('kv', (s) => s.get('settings'))) ?? {}) }),
      save: (settings) => write('kv', (s) => s.put(settings, 'settings')).then(() => undefined),
    },
    players: {
      list: () => read('players', (s) => s.getAll()),
      add: async (name) => ({ id: await write('players', (s) => s.add({ name })), name }),
      rename: (id, name) => write('players', (s) => s.put({ id, name })).then(() => undefined),
      remove: (id) => write('players', (s) => s.delete(id)).then(() => undefined),
    },
    sessions: {
      save: (session) => write('sessions', (s) => s.put(session)).then(() => undefined),
      /** The session, its hands and its draft, in one transaction: all gone or none. */
      remove: (id) =>
        run(['sessions', 'hands', 'drafts'], 'readwrite', (s) => {
          s.sessions.delete(id)
          s.drafts.delete(id)
          s.hands.index('sessionId').openKeyCursor(id).onsuccess = (e) => {
            const c = e.target.result
            if (c) {
              s.hands.delete(c.primaryKey)
              c.continue()
            }
          }
        }).then(() => undefined),
      current: async () => (await read('sessions', (s) => s.getAll())).find((x) => !x.ended) ?? null,
      list: () => read('sessions', (s) => s.getAll()),
    },
    hands: {
      save: (record) => write('hands', (s) => s.put(record)).then(() => undefined),
      remove: (id) => write('hands', (s) => s.delete(id)).then(() => undefined),
      // Stored in id order ("9-10" before "9-2"), so put back in hand order.
      listBySession: async (sessionId) => byHandNo(await read('hands', (s) => s.index('sessionId').getAll(sessionId))),
    },
    drafts: {
      get: async (sessionId) => (await read('drafts', (s) => s.get(sessionId))) ?? null,
      save: (draft) => write('drafts', (s) => s.put(draft)).then(() => undefined),
      remove: (sessionId) => write('drafts', (s) => s.delete(sessionId)).then(() => undefined),
    },
    backup: {
      /** Everything on the device, read in one transaction: { settings, players, sessions, hands, drafts }. */
      dump: async () => {
        const out = {}
        await run(STORES, 'readonly', (s) => {
          s.kv.get('settings').onsuccess = (e) => { out.settings = e.target.result ?? null }
          for (const n of ['players', 'sessions', 'hands', 'drafts']) s[n].getAll().onsuccess = (e) => { out[n] = e.target.result }
        })
        return out
      },
      /** Replace everything on the device with `data`, in one transaction: all of it or none of it. */
      restore: (data) =>
        run(STORES, 'readwrite', (s) => {
          for (const n of STORES) s[n].clear()
          if (data.settings) s.kv.put(data.settings, 'settings')
          for (const n of ['players', 'sessions', 'hands', 'drafts']) for (const item of data[n] ?? []) s[n].put(item)
        }).then(() => undefined),
    },
    /** Ask the browser not to clear this app's data when space runs low; resolves whether it agreed. */
    persist: async () => {
      if (!nav?.storage?.persist) return false
      return (await nav.storage.persisted()) || nav.storage.persist()
    },
  }
}
