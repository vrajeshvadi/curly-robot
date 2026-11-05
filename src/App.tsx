import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import type { HayDayDB } from './data/db'
import type { Catalog } from './types'
import { AppProviders } from './ui/AppState'
import { BottomBar } from './ui/components/BottomBar'
import { FarmSwitcher } from './ui/components/FarmSwitcher'
import { StorageBanner } from './ui/components/StorageBanner'
import { Backup } from './ui/screens/Backup'
import { CalculatorScreen } from './ui/screens/Calculator'
import { CatalogScreen } from './ui/screens/Catalog'
import { FarmFormScreen } from './ui/screens/FarmForm'
import { Farms } from './ui/screens/Farms'
import { Home } from './ui/screens/Home'
import { ItemDetail } from './ui/screens/ItemDetail'
import { ItemEditorScreen } from './ui/screens/ItemEditor'
import { More } from './ui/screens/More'
import { OrderEditorScreen } from './ui/screens/OrderEditor'
import { Orders } from './ui/screens/Orders'
import { PlanScreen } from './ui/screens/Plan'
import { QuickCount } from './ui/screens/QuickCount'
import { Stock } from './ui/screens/Stock'
import './ui/styles/tokens.css'
import './ui/styles/app.css'

export default function App({ db, seed }: { db: HayDayDB; seed: Catalog }) {
  const [storageFailed, setStorageFailed] = useState(false)
  useEffect(() => { db.open().catch(() => setStorageFailed(true)) }, [db])

  return (
    <AppProviders db={db} seed={seed}>
      <HashRouter>
        <header className="top-bar"><FarmSwitcher /></header>
        {storageFailed && <StorageBanner />}
        <main className="screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/stock/count" element={<QuickCount />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderEditorScreen />} />
            <Route path="/plan" element={<PlanScreen />} />
            <Route path="/more" element={<More />} />
            <Route path="/more/calculator" element={<CalculatorScreen />} />
            <Route path="/more/catalog" element={<CatalogScreen />} />
            <Route path="/more/catalog/new" element={<ItemEditorScreen />} />
            <Route path="/more/catalog/:itemId" element={<ItemDetail />} />
            <Route path="/more/catalog/:itemId/edit" element={<ItemEditorScreen />} />
            <Route path="/more/farms" element={<Farms />} />
            <Route path="/more/farms/:id" element={<FarmFormScreen />} />
            <Route path="/more/backup" element={<Backup />} />
          </Routes>
        </main>
        <BottomBar />
      </HashRouter>
    </AppProviders>
  )
}
