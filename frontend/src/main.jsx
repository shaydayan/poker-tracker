// Composition root: pick concrete adapters and hand them to the app. The real storage is IndexedDB on the device;
// opening the app with ?demo uses throwaway in-memory data with sample players instead.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { StorageProvider } from './app/StorageContext.jsx'
import { createIndexedDbStorage } from './storage/indexeddb.js'
import { createMemoryStorage } from './storage/memory.js'

const demo = new URLSearchParams(window.location.search).has('demo')
const storage = demo ? createMemoryStorage() : createIndexedDbStorage(window.indexedDB)

// The built app caches itself for offline use (dist/sw.js, see scripts/offline-cache.js); the dev server does not.
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StorageProvider storage={storage}>
      <App />
    </StorageProvider>
  </StrictMode>,
)
