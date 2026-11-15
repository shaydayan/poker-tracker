import { createContext, useContext } from 'react'

const StorageContext = createContext(null)

export function StorageProvider({ storage, children }) {
  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>
}

export function useStorage() {
  const s = useContext(StorageContext)
  if (!s) throw new Error('StorageProvider missing')
  return s
}
