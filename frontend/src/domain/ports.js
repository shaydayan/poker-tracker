// Ports the domain/app need from the outside world. Implemented in src/storage, wired in main.jsx.
// All persistence goes through these; nothing else may touch storage.
//
// settings: { get(): Promise<Settings>, save(settings): Promise<void> }
// players:  { list(): Promise<Player[]>, add(name): Promise<Player>, rename(id, name): Promise<void>, remove(id): Promise<void> }
//           (you are a player too, the one settings.heroPlayerId points at; the Players list in Settings leaves you out)
// sessions: { save(session): Promise<void>, current(): Promise<Session|null> (the one not ended), list(): Promise<Session[]> }
// hands:    { save(record): Promise<void>, remove(id): Promise<void>, listBySession(sessionId): Promise<HandRecord[]> }
//           HandRecord = { format, id, sessionId, handNo, base, actions, heroCards, hand } (see domain/record.js)
// drafts:   { get(sessionId): Promise<Draft|null>, save(draft): Promise<void>, remove(sessionId): Promise<void> }
//           Draft = { sessionId, base, actions }: the hand in progress, so closing the app mid-hand loses nothing
// backup:   { dump(): Promise<Data>, restore(data): Promise<void> } (Data = { settings, players, sessions, hands, drafts };
//           restore replaces everything, all or nothing; see domain/backup.js for the file)
// persist(): Promise<boolean>: ask the browser to keep the data even when space runs low
export const PORT_NAMES = ['settings', 'players', 'sessions', 'hands', 'drafts', 'backup']
