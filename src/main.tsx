import '@fontsource-variable/bricolage-grotesque'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { seedCatalog } from './catalog/seed'
import { db } from './data/db'
import { setMeta } from './data/repo'
import { UpdatePrompt } from './ui/components/UpdatePrompt'

// Ask the browser to keep our storage; the Backup screen warns if it says no.
void navigator.storage?.persist?.().then((granted) => setMeta(db, 'persisted', granted)).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App db={db} seed={seedCatalog} />
    <UpdatePrompt />
  </StrictMode>,
)
