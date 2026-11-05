import { render } from '@testing-library/react'
import App from '../../src/App'
import { createDb, type HayDayDB } from '../../src/data/db'
import type { Catalog } from '../../src/types'
import { testCatalog } from '../fixtures/testCatalog'

/** Renders the whole app at `path` with a fresh database and the test catalog. */
export function renderApp(path = '/', opts: { db?: HayDayDB; seed?: Catalog } = {}) {
  const db = opts.db ?? createDb(crypto.randomUUID())
  window.location.hash = `#${path}`
  const utils = render(<App db={db} seed={opts.seed ?? testCatalog} />)
  return { db, ...utils }
}
