# Hay Day Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first, offline, installable web app that tracks stock, orders and plans across a main Hay Day farm and its baby farms.

**Architecture:** Pure TypeScript core (`catalog/`, `planner/`) with no storage or React; a Dexie data layer (`data/`) and transactional stock actions (`actions/`); React screens (`ui/`) on top. Static build deployed to GitHub Pages.

**Tech Stack:** React + TypeScript, Vite, Dexie (+ `dexie-react-hooks`), Zod, `vite-plugin-pwa`, `react-router-dom` (HashRouter), Vitest + React Testing Library + `fake-indexeddb`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-hay-day-manager-design.md`

## Global Constraints

- No server. All data lives in the phone's browser storage (IndexedDB via Dexie).
- Hash-based routing (works on static hosting).
- Plain text and simple icons only: no game artwork or logos.
- Phone-first layout; light and dark mode.
- Stock never goes below zero. Any deduction that would go negative is floored at zero and reported to the user.
- Seed data is never modified. "Reset to original" deletes the override.
- Backup: `"app": "hay-day-manager"`, `"schemaVersion": 1`; file name `hay-day-backup-YYYY-MM-DD.json`.
- Free = `max(0, total − reserved)`. Spare = `max(0, free − min)`. Low stock = `min > 0` and `free < min`.
- An item with no `StockRow` on a farm has `total = 0` and `min = 0`.
- Time estimates are labelled "estimate".
- Install the current stable version of each dependency; Node 20 or later.
- Use `crypto.randomUUID()` for farm and order IDs.
- UI tasks (10–15) load the `frontend-design` skill once for visual direction before their first component.

## Review Focus

1. **Resource count of zero** (farm has 0 fields, 0 chickens, 0 of a tree): items made there are treated as locked ("can't make here"), never a divide-by-zero or `Infinity` minutes. Test in Task 3.
2. **Typed counts that aren't whole non-negative numbers** (`""`, `"-3"`, `"2.5"`, `"abc"`, `"1e3"`): rejected with no write; `"007"` reads as 7. Test in Task 7 and Task 11.
3. **Same item added twice to one order:** lines merged into one, so reservations and "can fill now" are not double-counted. Test in Task 6.
4. **Deleting a farm that has stock and orders:** confirm first, then its stock rows and orders are deleted with it; other farms untouched. Test in Task 6.
5. **Backup or stock referencing an item ID not in the catalog** (e.g. a deleted custom item, or a backup from a newer catalog): data is kept and shown as "Unknown item (id)", never a crash; the planner treats it as `missing`. Tests in Task 4 and Task 8.

---

## File Structure

```
src/
  types.ts                    domain types (spec §4) + Catalog, Resource
  catalog/
    build.ts                  buildCatalog: seed + overrides + custom
    validate.ts               validateCatalog, validateItemEdit, usedIn
    seed.json                 pre-filled catalog
  planner/
    stock.ts                  stockLevels, isLocked, canFillNow
    breakdown.ts              demand, netting, transfers, breakdown
    estimate.ts               estimateTime, checkStorage, queueRefills
    plan.ts                   plan(), calculate()
  data/
    db.ts                     Dexie database
    repo.ts                   farms, stock, orders, overrides, custom items, meta
    backup.ts                 export/parse/import
  actions/
    stockActions.ts           markOrderDone, logBatch, saveQuickCount, setCount, adjustCount, setMin
  lib/
    parseCount.ts
    newFarm.ts
  ui/
    AppState.tsx              current farm, session top-ups
    useCatalog.ts             live effective catalog
    components/               BottomBar, FarmSwitcher, StorageBanner, ItemPicker, FillBar, UpdatePrompt
    screens/                  Home, Stock, QuickCount, Orders, OrderEditor, Plan, More, Calculator,
                              Catalog, ItemDetail, ItemEditor, Farms, FarmForm, Backup
    styles/tokens.css
  App.tsx, main.tsx
tests/
  fixtures/testCatalog.ts     small hand-made catalog with known answers
  fixtures/builders.ts        makeFarm, makeStock, makeOrder helpers
  setup.ts                    fake-indexeddb + RTL setup
e2e/order-flow.spec.ts
.github/workflows/deploy.yml
```

## Test catalog (used by Tasks 2–5, 7)

`tests/fixtures/testCatalog.ts` exports `testCatalog: Catalog` with `catalogVersion: 0`:

| id | category | storage | level | source |
|---|---|---|---|---|
| `wheat` | crop | silo | 1 | field, seedUsed 1, harvestYield 2, 2 min |
| `corn` | crop | silo | 2 | field, seedUsed 1, harvestYield 2, 5 min |
| `chicken_feed` | made | barn | 1 | machine `feed_mill`, yield 3, 5 min, wheat 2 + corn 1 |
| `egg` | animal | barn | 1 | animal `chicken`, yield 1, 20 min, chicken_feed 1 |
| `bread` | made | barn | 2 | machine `bakery`, yield 1, 5 min, wheat 3 |
| `cornbread` | made | barn | 2 | machine `bakery`, yield 1, 30 min, corn 2 + egg 2 |
| `blackberry_muffin` | made | barn | 40 | machine `bakery`, yield 1, 30 min, wheat 2 |
| `apple` | tree | barn | 10 | tree `apple_tree`, yield 1, 60 min |
| `bolt` | material | barn | 1 | none |

Machines: `feed_mill` (1), `bakery` (2). Animals: `chicken` (1). Trees: `apple_tree` (10).

`tests/fixtures/builders.ts`: `makeFarm(overrides?: Partial<Farm>): Farm` defaults to `{ id: "main", name: "Main", level: 20, barnCapacity: 100, siloCapacity: 100, fields: 10, machines: { feed_mill: {owned: true, slots: 2}, bakery: {owned: true, slots: 2} }, animals: { chicken: 6 }, trees: { apple_tree: 2 } }`; `makeStock(farmId, rows: Record<ItemId, number | {total, min}>): StockRow[]`; `makeOrder(farmId, lines: Record<ItemId, number>, opts?: Partial<Order>): Order` (open, truck, reserve false).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tests/setup.ts`, `tests/smoke.test.tsx`, `.gitignore`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` (= `vitest run`), `npm run typecheck` (= `tsc --noEmit`). Vitest uses `jsdom`, `tests/setup.ts` imports `fake-indexeddb/auto` and `@testing-library/jest-dom/vitest`.

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`, then install `dexie dexie-react-hooks zod react-router-dom` and dev `vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fake-indexeddb`. Set Vite `base: "./"`.
- [ ] **Step 2: Write `tests/smoke.test.tsx`:** renders `<App />`, asserts `screen.getByText("Hay Day Manager")` is in the document.
- [ ] **Step 3:** Run `npm test` — expected FAIL (text missing).
- [ ] **Step 4:** Replace Vite's demo `App.tsx` with a component rendering an `<h1>Hay Day Manager</h1>`; remove demo assets.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run build` — expected all pass.
- [ ] **Step 6: Commit** `chore: scaffold Vite React TS app with Vitest`

### Task 2: Domain types and catalog validation

**Files:**
- Create: `src/types.ts`, `src/catalog/build.ts`, `src/catalog/validate.ts`, `tests/fixtures/testCatalog.ts`, `tests/fixtures/builders.ts`
- Test: `tests/catalog/validate.test.ts`, `tests/catalog/build.test.ts`

**Interfaces:**
- Produces (`src/types.ts`): every type in spec §4 verbatim, plus
  ```ts
  interface Resource { id: string; name: string; unlockLevel: number }
  type Machine = Resource;
  interface Catalog {
    catalogVersion: number;
    items: Record<ItemId, Item>;
    machines: Record<string, Resource>;
    animals: Record<string, Resource>;
    trees: Record<string, Resource>;
  }
  type CatalogIssue = { kind: "missing-ingredient" | "cycle" | "non-positive" | "unknown-resource"; itemId: ItemId; detail: string };
  ```
- Produces (`catalog/`): `buildCatalog(seed: Catalog, overrides: CatalogOverride[], custom: Item[]): Catalog`; `validateCatalog(c: Catalog): CatalogIssue[]`; `validateItemEdit(c: Catalog, item: Item): CatalogIssue[]` (validates `c` with `item` inserted/replaced, returns only issues); `usedIn(c: Catalog, itemId: ItemId): ItemId[]` (sorted by name); `ingredientsOf(item: Item): Ingredient[]` (empty for field/tree/none).

- [ ] **Step 1: Write tests.**
  - `validateCatalog(testCatalog)` → `[]`.
  - bread with ingredient `{itemId: "flour", qty: 1}` → one issue `missing-ingredient` on `bread`.
  - wheat edited to machine source with ingredient bread (bread needs wheat) → an issue `cycle`.
  - bread yield 0, minutes 0, or ingredient qty 0 → `non-positive`; field `harvestYield <= seedUsed` → `non-positive`.
  - bread machineId `"oven"` → `unknown-resource`.
  - `buildCatalog(testCatalog, [{itemId: "bread", item: {...bread, name: "Bread!"}}], [customJam])`: `items.bread.name === "Bread!"`, `items.jam` exists, `testCatalog.items.bread.name === "Bread"` (seed untouched).
  - `usedIn(testCatalog, "wheat")` → `["blackberry_muffin", "bread", "chicken_feed"]`.
- [ ] **Step 2:** Run `npx vitest run tests/catalog` — expected FAIL (modules missing).
- [ ] **Step 3:** Implement. Cycle detection: DFS with white/grey/black colouring over `ingredientsOf`.
- [ ] **Step 4:** Run `npx vitest run tests/catalog` — expected PASS.
- [ ] **Step 5: Commit** `feat: domain types and catalog validation`

### Task 3: Stock levels, locking, can-fill-now

**Files:**
- Create: `src/planner/stock.ts`
- Test: `tests/planner/stock.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces:
  ```ts
  interface StockLevel { total: number; reserved: number; free: number; spare: number; min: number; low: boolean }
  function stockLevels(farmId: FarmId, stock: StockRow[], orders: Order[], excludeOrderIds?: Set<string>): Map<ItemId, StockLevel>;
  function levelOf(levels: Map<ItemId, StockLevel>, itemId: ItemId): StockLevel; // zeros if absent
  function isLocked(item: Item, farm: Farm, catalog: Catalog): boolean;
  function canFillNow(order: Order, stock: StockRow[], orders: Order[]): boolean;
  ```
  `excludeOrderIds` lists open orders whose reservations should not count (used by the planner for orders in the plan).

- [ ] **Step 1: Write tests.**
  - wheat total 5 min 3, open reserved order wheat 4 → `{total 5, reserved 4, free 1, spare 0, min 3, low true}`.
  - same, with that order's ID in `excludeOrderIds` → reserved 0, free 5, spare 2, low false.
  - reserved 7 with total 5 → free 0 (not negative).
  - done orders and orders on other farms don't reserve.
  - `isLocked`: blackberry_muffin on level-20 farm → true; bread with `bakery.owned false` → true; wheat with `fields: 0` → true; egg with `chicken: 0` → true; apple with `apple_tree` missing → true; bread on default farm → false; bolt (none) → false.
  - `canFillNow`: reserved order wheat 4 with total 5 → true; another unreserved order wheat 2 → false (only 1 free).
- [ ] **Step 2:** Run `npx vitest run tests/planner/stock.test.ts` — FAIL.
- [ ] **Step 3:** Implement. `isLocked` = `unlockLevel > farm.level`, or resource not owned / count ≤ 0 (machine `owned && slots > 0`, field `fields > 0`, animal/tree count > 0).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: stock levels, locking and can-fill-now`

### Task 4: Breakdown (demand, netting, transfers, recipe expansion)

**Files:**
- Create: `src/planner/breakdown.ts`
- Test: `tests/planner/breakdown.test.ts`

**Interfaces:**
- Consumes: Task 3 `stockLevels`, `levelOf`, `isLocked`; Task 2 `ingredientsOf`.
- Produces:
  ```ts
  interface PlanInput {
    catalog: Catalog; targetFarmId: FarmId; farms: Farm[]; stock: StockRow[]; orders: Order[];
    orderIds: string[]; topUps: ItemId[]; extraDemand?: Ingredient[]; useOtherFarms: boolean;
  }
  type ResourceKey = string; // "machine:<id>" | "field:<itemId>" | "animal:<id>" | "tree:<id>"
  interface Breakdown {
    fromStock: Ingredient[];
    transfers: { fromFarmId: FarmId; itemId: ItemId; qty: number }[];
    make: { itemId: ItemId; batches: number; resourceId: ResourceKey }[]; // machine, animal and tree items
    plant: { itemId: ItemId; plantings: number }[];
    cantMakeHere: Ingredient[];
    missing: Ingredient[];               // source none, or itemId not in catalog
    noSeed: { itemId: ItemId; have: number; need: number }[];
    produced: Record<ItemId, number>;    // batches×yield, plantings×harvestYield
    consumed: Record<ItemId, number>;    // ingredient use + plantings×seedUsed
  }
  function breakdown(input: PlanInput): { ok: true; breakdown: Breakdown } | { ok: false; error: "cycle" };
  ```
  All output arrays sorted by item name (unknown IDs by ID); `transfers` sorted by item name, then qty descending. Tree items appear in `make` with `batches` = harvests and `resourceId: "tree:<id>"`.

- [ ] **Step 1: Write tests** (target farm `main` from `makeFarm()` unless stated):
  1. Order bread 2, wheat stock 1 → make `[{bread, 2, "machine:bakery"}]`, fromStock `[{wheat, 1}]`, plant `[{wheat, 5}]`, noSeed `[{wheat, have 0, need 1}]`.
  2. Shared ingredients: orders bread 1 + cornbread 1, stock wheat 10, corn 10 → make bread 1, chicken_feed 1, cornbread 1, egg 2; fromStock corn 3, wheat 5; plant `[]`.
  3. Transfer: main needs corn 6 (order), baby `b1` corn total 14 min 4 → transfers `[{b1, corn, 6}]`, plant `[]`.
  4. Other farm's minimum respected: baby corn total 8 min 4 → transfer 4, plant corn 2.
  5. Largest spare first: `bA` corn spare 3, `bB` corn spare 5, need 6 → transfers `[{bB, corn, 5}, {bA, corn, 1}]`.
  6. Finished goods first: main needs bread 2, baby has bread 2 spare and wheat 10 spare → transfers `[{b1, bread, 2}]` only; make `[]`.
  7. `useOtherFarms: false` → no transfers even when spare exists.
  8. Locked: blackberry_muffin 1 on level-20 main → cantMakeHere `[{blackberry_muffin, 1}]`, no wheat demand. With baby level 45 holding spare 1 → transfer 1, cantMakeHere `[]`.
  9. Reservation: open reserved order A wheat 3, stock wheat 5; plan only order B wheat 4 → fromStock wheat 2, plant wheat 2. Plan A + B → fromStock wheat 5, plant wheat 2.
  10. Top-ups: wheat total 1 min 5, `topUps: ["wheat"]` → plant wheat 4.
  11. `missing`: bolt 2 with none in stock → missing `[{bolt, 2}]`; order line `{itemId: "ghost", qty: 1}` → missing `[{ghost, 1}]` (Review Focus 5).
  12. Cycle in catalog (bypassing validation) → `{ok: false, error: "cycle"}`.
  13. `produced`/`consumed` for test 1: produced bread 2, wheat 10; consumed wheat 6 + 5 = 11.
- [ ] **Step 2:** Run `npx vitest run tests/planner/breakdown.test.ts` — FAIL.
- [ ] **Step 3: Implement** per spec §5 steps 1–3. Algorithm the spec fixes:
  ```
  demand = sum(order lines in orderIds) + topUps(min, for each item whose level is low) + extraDemand
           // adding min (not min − free) because netting against free stock below then leaves exactly min − free to make
  avail  = levelOf(stockLevels(target, stock, orders, new Set(orderIds))).free per item
  spare  = per other farm: levelOf(stockLevels(farm, stock, orders)).spare
  order items: topological sort of all items reachable from demand (parents before ingredients); cycle → error
  for item in order:
    need = demand[item]; take min(need, avail) → fromStock; avail -= taken
    if useOtherFarms: for farms by spare desc: take → transfers
    rest = remaining need; if 0 continue
    unknown or source none → missing
    isLocked on target → cantMakeHere
    field: plantings = ceil(rest / (harvestYield − seedUsed)); if avail[item] < seedUsed → noSeed{have: avail, need: seedUsed}
    machine/animal/tree: batches = ceil(rest / yield); add ingredient.qty × batches to demand[ingredient]
  ```
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: planner breakdown with transfers and recipe expansion`

### Task 5: Time, storage, queue refills, plan() and calculate()

**Files:**
- Create: `src/planner/estimate.ts`, `src/planner/plan.ts`
- Test: `tests/planner/estimate.test.ts`, `tests/planner/plan.test.ts`

**Interfaces:**
- Consumes: Task 4 `breakdown`, `PlanInput`, `Breakdown`, `ResourceKey`.
- Produces:
  ```ts
  function estimateTime(b: Breakdown, catalog: Catalog, farm: Farm): { perResource: Record<ResourceKey, number>; overallMinutes: number };
  function checkStorage(b: Breakdown, catalog: Catalog, farm: Farm, stock: StockRow[]): PlanWarning[]; // overflow only
  function queueRefills(batches: number, slots: number): number; // ceil(batches / slots)
  type PlanWarning = Plan["warnings"][number]; // exactly the warnings element union in spec §5
  interface Plan extends Omit<Breakdown, "make" | "noSeed" | "produced" | "consumed"> {
    make: { itemId: ItemId; batches: number; resourceId: ResourceKey; queueRefills: number | null }[]; // null for non-machine
    warnings: PlanWarning[]; time: { perResource: Record<ResourceKey, number>; overallMinutes: number };
  }
  type PlanResult = { ok: true; plan: Plan } | { ok: false; error: "cycle" };
  function plan(input: PlanInput): PlanResult;
  function calculate(catalog: Catalog, farm: Farm, itemId: ItemId, qty: number,
                     mode: "empty" | "mine", data: { farms: Farm[]; stock: StockRow[]; orders: Order[] }): PlanResult;
  ```

- [ ] **Step 1: Write tests.**
  - Time: breakdown of Task 4 test 1 on farm with `fields: 2` → `perResource["field:wheat"] === 6` (ceil(5/2)=3 rounds × 2), `perResource["machine:bakery"] === 10`, `overallMinutes === 16`.
  - Animal: egg 2 batches, chickens 6 → `animal:chicken` 20; egg 7 batches → 40.
  - Overall picks the longest chain, not the sum of all resources (bread 1 + apple 1 with stock wheat 10 → overall 60).
  - Storage: barnCapacity 9, stock bolt 8, plan makes bread 2 from stock wheat → warning `{kind: "barn-overflow", projected: 10, capacity: 9}`; no silo warning.
  - Transfers count into projected storage.
  - `queueRefills(5, 2) === 3`.
  - `plan()` maps noSeed to warnings `{kind: "no-seed", ...}` and adds `reserved-exceeds-total` for any demanded item where reserved > total on the target farm.
  - `calculate(..., "bread", 50, "empty", ...)` → make bread 50, plant wheat 150, transfers `[]`, even when the farm has wheat 150 and another farm has spare bread; `"mine"` with wheat 150 → plant `[]`.
  - Top-up with an order: wheat free 1 min 5, order wheat 2, `topUps: ["wheat"]` → plant wheat 6.
- [ ] **Step 2:** Run `npx vitest run tests/planner` — FAIL.
- [ ] **Step 3:** Implement per spec §5 steps 4–5. Overall: memoised longest path where `cost(item)` = `perResource[resourceKey(item)]` if the item is in `make`/`plant`, else 0, and `chain(item) = cost(item) + max(chain(ingredient))` over ingredients that are in `make`/`plant`; overall = max over all made/planted items.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: plan time and storage estimates, calculator`

### Task 6: Database and repositories

**Files:**
- Create: `src/data/db.ts`, `src/data/repo.ts`, `src/lib/newFarm.ts`
- Test: `tests/data/repo.test.ts`, `tests/lib/newFarm.test.ts`

**Interfaces:**
- Produces (`db.ts`): `class HayDayDB extends Dexie` with tables `farms: "id"`, `stock: "[farmId+itemId], farmId"`, `orders: "id, farmId, status"`, `overrides: "itemId"`, `customItems: "id"`, `meta: "key"` (rows `{key: string; value: unknown}`); `createDb(name = "hay-day-manager"): HayDayDB`; app singleton `db`.
- Produces (`repo.ts`), all `async` and taking `db` first:
  `listFarms`, `saveFarm(db, farm)`, `deleteFarm(db, farmId)` (deletes its stock and orders in one transaction), `listStock(db)`, `listOrders(db)`, `saveOrder(db, order)` (applies `normalizeLines`), `deleteOrder`, `saveOverride(db, o)`, `deleteOverride(db, itemId)`, `saveCustomItem(db, item)`, `deleteCustomItem(db, catalog, itemId): Promise<{ok: true} | {ok: false; reason: "used-in-recipe" | "in-orders" | "in-stock"}>`, `getMeta<T>(db, key): Promise<T | undefined>`, `setMeta(db, key, value)`.
  `normalizeLines(lines: Ingredient[]): Ingredient[]` — merges duplicate item IDs, drops qty ≤ 0, sorted by insertion order.
- Produces (`newFarm.ts`): `newFarm(catalog: Catalog, name: string, level: number): Farm` — machines with `unlockLevel <= level` get `{owned: true, slots: 2}`, others `{owned: false, slots: 2}`; `fields: 0`, animals and trees 0; capacities 50.

- [ ] **Step 1: Write tests** (each test uses `createDb(crypto.randomUUID())`):
  - save/list farm round-trip.
  - `deleteFarm("b1")` removes b1's stock rows and orders, leaves `main`'s (Review Focus 4).
  - `saveOrder` with lines bread 2, bread 3, wheat 0 → stored lines `[{bread, 5}]` (Review Focus 3).
  - `deleteCustomItem`: blocked with `used-in-recipe` when another item uses it, `in-orders` when an open order has it, `in-stock` when any total > 0; otherwise ok.
  - `newFarm(testCatalog, "Baby 1", 1)` → `feed_mill.owned` true, `bakery.owned` false.
- [ ] **Step 2:** Run `npx vitest run tests/data tests/lib` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: Dexie database and repositories`

### Task 7: Stock actions and count parsing

**Files:**
- Create: `src/actions/stockActions.ts`, `src/lib/parseCount.ts`
- Test: `tests/actions/stockActions.test.ts`, `tests/lib/parseCount.test.ts`

**Interfaces:**
- Consumes: Task 6 `HayDayDB`; Task 2 `Catalog`.
- Produces (each runs in one `db.transaction("rw", ...)`):
  ```ts
  type ShortReport = { short: Ingredient[] }; // items floored at zero and by how much
  function markOrderDone(db, orderId: string): Promise<ShortReport>;
  function previewOrderDone(db, orderId: string): Promise<ShortReport>; // no writes
  function logBatch(db, catalog: Catalog, farmId: FarmId, itemId: ItemId): Promise<ShortReport>;
  function saveQuickCount(db, farmId: FarmId, counts: Record<ItemId, number>): Promise<void>;
  function setCount(db, farmId, itemId, total: number): Promise<void>;
  function adjustCount(db, farmId, itemId, delta: number): Promise<void>; // floors at 0
  function setMin(db, farmId, itemId, min: number): Promise<void>;
  function parseCount(input: string): number | null; // /^\d{1,6}$/ → int, else null
  ```

- [ ] **Step 1: Write tests.**
  - `markOrderDone`: stock wheat 5, order wheat 7 → wheat total 0, status `"done"`, returns `short: [{wheat, 2}]`.
  - `logBatch` bread: wheat 4 → bread +1, wheat 1, short `[]`; wheat 1 → wheat 0, short `[{wheat, 2}]`.
  - `logBatch` wheat (crop): +1 (harvestYield − seedUsed).
  - `logBatch` on unknown item rejects with an `Error`.
  - `saveQuickCount` sets several totals at once and keeps existing `min`.
  - `adjustCount(-10)` on total 3 → 0.
  - `parseCount`: `"007"` → 7; `"0"` → 0; `""`, `"-3"`, `"2.5"`, `"abc"`, `"1e3"`, `"1234567"` → null (Review Focus 2).
- [ ] **Step 2:** Run `npx vitest run tests/actions tests/lib/parseCount.test.ts` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: transactional stock actions and count parsing`

### Task 8: Backup export and import

**Files:**
- Create: `src/data/backup.ts`
- Test: `tests/data/backup.test.ts`

**Interfaces:**
- Consumes: Task 6 db and tables.
- Produces:
  ```ts
  interface BackupFile { app: "hay-day-manager"; schemaVersion: 1; exportedAt: string; farms: Farm[]; stock: StockRow[]; orders: Order[]; catalogOverrides: CatalogOverride[]; customItems: Item[] }
  function exportBackup(db, now?: Date): Promise<BackupFile>;  // also setMeta("lastBackupAt", iso)
  function backupFileName(d: Date): string;                    // "hay-day-backup-2026-11-05.json" (local date)
  function parseBackup(json: unknown): { ok: true; data: BackupFile } | { ok: false; error: string };
  function importBackup(db, data: BackupFile): Promise<void>;  // clears and replaces all tables except meta, one transaction
  ```
  Zod schemas mirror the types; item IDs are any non-empty string (not checked against the catalog).

- [ ] **Step 1: Write tests.**
  - Round trip: seed db with 2 farms, stock, orders, an override and a custom item; export, import into a fresh db, export again → equal except `exportedAt`.
  - `parseBackup({...valid, schemaVersion: 2})` → `ok: false`; `parseBackup("nope")` → `ok: false`; invalid file leaves existing db data unchanged (parse fails before any write).
  - Stock row with `itemId: "ghost"` survives round-trip (Review Focus 5).
  - `backupFileName(new Date(2026, 10, 5))` → `"hay-day-backup-2026-11-05.json"`.
  - After export, `getMeta(db, "lastBackupAt")` is set.
- [ ] **Step 2:** Run `npx vitest run tests/data/backup.test.ts` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: backup export and import`

### Task 9: Pre-filled catalog

**Files:**
- Create: `src/catalog/seed.json`, `src/catalog/seed.ts` (typed export `seedCatalog: Catalog`), `docs/catalog-sources.md`
- Test: `tests/catalog/seed.test.ts`

**Interfaces:**
- Produces: `seedCatalog: Catalog` with `catalogVersion: 1`. IDs are snake_case of the in-game name.

- [ ] **Step 1: Write tests.**
  - `validateCatalog(seedCatalog)` → `[]`.
  - Every machine, animal and tree in the seed produces at least one item.
  - Every item ID matches `/^[a-z0-9_]+$/` and is unique; every name is unique.
  - Spot checks: `wheat` field seedUsed 1 harvestYield 2, 2 min, level 1; `bread` bakery 5 min, wheat 3; `chicken_feed` feed_mill yield 3, wheat 2 + corn 1; `egg` animal chicken 20 min, chicken_feed 1. If the sources consulted disagree with any of these, use the sources and update the assertion, noting why in `docs/catalog-sources.md`.
- [ ] **Step 2:** Run `npx vitest run tests/catalog/seed.test.ts` — FAIL.
- [ ] **Step 3:** Research public Hay Day references (WebSearch/WebFetch) and compile every crop, tree/bush, animal product, machine product and expansion/storage material with unlock level, source, time, yield and ingredients. Facts only; no images or copied prose. Materials use `source: {kind: "none"}`. List URLs consulted in `docs/catalog-sources.md`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: pre-filled Hay Day catalog`

### Task 10: App shell, farms and app state

**Files:**
- Create: `src/ui/AppState.tsx`, `src/ui/useCatalog.ts`, `src/ui/components/{BottomBar,FarmSwitcher,StorageBanner}.tsx`, `src/ui/screens/{Farms,FarmForm}.tsx`, `src/ui/styles/tokens.css`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `tests/ui/shell.test.tsx`, `tests/ui/farms.test.tsx`

**Interfaces:**
- Consumes: Tasks 2, 6, 9.
- Produces:
  - `useCatalog(): Catalog` — `buildCatalog(seedCatalog, overrides, customItems)` from `useLiveQuery`.
  - `useAppState(): { farmId: FarmId | null; setFarmId(id): void; topUps: ItemId[]; addTopUp(id): void; removeTopUp(id): void; clearTopUps(): void }` — `farmId` persisted via `setMeta("currentFarmId")`; top-ups kept per farm in memory only.
  - `<AppProviders db={HayDayDB} seed={Catalog = seedCatalog}>` wraps the app so tests can inject a fresh db and the test catalog; `useDb(): HayDayDB`. `useCatalog` builds from the provider's `seed`.
  - Routes (HashRouter): `/` Home, `/stock`, `/stock/count`, `/orders`, `/orders/:id`, `/plan`, `/more`, `/more/calculator`, `/more/catalog`, `/more/catalog/:itemId`, `/more/catalog/:itemId/edit`, `/more/farms`, `/more/farms/:id`, `/more/backup`. Unbuilt screens render a placeholder heading until their task.
  - `main.tsx` calls `navigator.storage?.persist()` once and stores the result with `setMeta("persisted", boolean)`. If opening the db fails, `<StorageBanner>` shows "Storage isn't available here, so nothing can be saved. Open the app in a normal (non-private) tab."
- [ ] **Step 1: Write tests.**
  - With no farms: Home shows "Add your first farm" linking to `/more/farms/new`.
  - Farm form: entering name "Main", level 20, fields 12 and saving → "Main" appears in the farm switcher and is selected.
  - Switching farm in the switcher updates `farmId`.
  - Deleting a farm asks for confirmation (text includes the farm's name) and removes it.
  - Bottom bar has links Home, Stock, Orders, Plan, More.
- [ ] **Step 2:** Run `npx vitest run tests/ui` — FAIL.
- [ ] **Step 3:** Implement. Farm form edits every `Farm` field: name, level, barn/silo capacity, fields, owned + slots per machine, count per animal and tree (only those unlocked at the farm's level, with "show locked"). Defaults from `newFarm`. Tokens define colours for light and dark (`prefers-color-scheme`).
- [ ] **Step 4:** Run — PASS. Also `npm run typecheck`.
- [ ] **Step 5: Commit** `feat: app shell, farm management and app state`

### Task 11: Stock screen and quick count

**Files:**
- Create: `src/ui/screens/{Stock,QuickCount}.tsx`
- Test: `tests/ui/stock.test.tsx`

**Interfaces:**
- Consumes: Task 3 `stockLevels`, `isLocked`; Task 7 `setCount`, `adjustCount`, `setMin`, `saveQuickCount`, `parseCount`; Task 10 hooks.
- Produces: `/stock` and `/stock/count` screens.
- [ ] **Step 1: Write tests** (`AppProviders` with `seed={testCatalog}`):
  - Rows show name and `total / reserved / free` and minimum; locked items hidden until "Show locked" is on.
  - Reserved 7 with total 5 shows the warning "More reserved than in stock".
  - Search "whe" shows only Wheat; filter Silo hides Bread.
  - Tapping + on Wheat increments total.
  - Typing "abc" as a count shows "Enter a whole number" and does not change stock (Review Focus 2).
  - Quick count: enter 3 for the first item, Next, Cancel → stock unchanged; repeat and Done → stock updated for entered items only (skipped items untouched).
- [ ] **Step 2:** Run `npx vitest run tests/ui/stock.test.tsx` — FAIL.
- [ ] **Step 3:** Implement. Quick count order: category order crop, tree, animal, made, material, then by name; numeric keypad (`inputMode="numeric"`).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: stock screen and quick count`

### Task 12: Orders screen

**Files:**
- Create: `src/ui/screens/{Orders,OrderEditor}.tsx`, `src/ui/components/ItemPicker.tsx`
- Test: `tests/ui/orders.test.tsx`

**Interfaces:**
- Consumes: Task 6 `saveOrder`, `deleteOrder`; Task 7 `previewOrderDone`, `markOrderDone`; Task 3 `canFillNow`.
- Produces: `<ItemPicker onPick={(itemId) => void} />` (search over unlocked items, reused by Calculator); `/orders`, `/orders/:id` (`new` for a new order).
- [ ] **Step 1: Write tests.**
  - Tabs Truck / Boat / Visitor filter open orders by type.
  - New truck order: pick Bread twice with qty 2 and 3, save → one line Bread × 5.
  - Reserve switch saved; stock screen shows the reservation.
  - Mark done with enough stock: preview lists deductions; confirm → order leaves the open list, stock deducted.
  - Mark done with short stock: warning "Your counts may be out of date" listing Wheat short by 2, with "Fix counts" and "Mark done anyway".
  - "Can fill now" badge shown on fillable orders only.
- [ ] **Step 2:** Run `npx vitest run tests/ui/orders.test.tsx` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: orders screen with reserve and mark done`

### Task 13: Home screen

**Files:**
- Create: `src/ui/screens/Home.tsx`, `src/ui/components/FillBar.tsx`
- Test: `tests/ui/home.test.tsx`

**Interfaces:**
- Consumes: Task 3, Task 10 `useAppState().addTopUp`.
- Produces: `/` screen; "Plan all open orders" navigates to `/plan?orders=all`.
- [ ] **Step 1: Write tests.**
  - Open orders listed with "Can fill now" badge where applicable.
  - Low-stock list shows Wheat (total 1, min 5); "Add to to-make" adds `wheat` to top-ups and the button changes to "Added".
  - Barn and silo bars show `used / capacity` (barn 8 / 100).
  - "Plan all open orders" navigates to Plan with all open orders selected.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: home dashboard`

### Task 14: Plan screen

**Files:**
- Create: `src/ui/screens/Plan.tsx`
- Test: `tests/ui/plan.test.tsx`

**Interfaces:**
- Consumes: Task 5 `plan`; Task 7 `logBatch`; Task 10 `useAppState` (top-ups).
- Produces: `/plan`. Query `orders=all` preselects all open orders; otherwise the last selection in memory, default all.
- [ ] **Step 1: Write tests.**
  - Sections render in order: From stock, Transfers, Make, Plant, Can't make here, Missing, Warnings, Time (estimate). Empty sections hidden.
  - Make row "Bread × 2 · Bakery · 1 refill" and Plant row "Wheat × 5 fields".
  - Transfer row reads "Baby 1 → Main: Corn × 6".
  - Toggling "Use other farms" off removes the Transfers section.
  - "Made 1 batch" on Bread adds 1 bread and deducts 3 wheat; the plan updates.
  - Time shows "About 16 min (estimate)" (farm with 2 fields, wheat 1, order bread 2).
  - A top-up added on Home appears as a removable chip.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement. Minutes formatted as `1 h 20 min` / `16 min`. Unknown item IDs shown as "Unknown item (id)".
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: plan screen`

### Task 15: More: calculator, catalog, backup

**Files:**
- Create: `src/ui/screens/{More,Calculator,Catalog,ItemDetail,ItemEditor,Backup}.tsx`
- Test: `tests/ui/calculator.test.tsx`, `tests/ui/catalog.test.tsx`, `tests/ui/backup.test.tsx`

**Interfaces:**
- Consumes: Task 5 `calculate`; Task 2 `validateItemEdit`, `usedIn`; Task 6 override/custom-item repo functions; Task 8 backup functions; Task 12 `ItemPicker`.
- Produces: the `/more/*` screens.
- [ ] **Step 1: Write tests.**
  - Calculator: Bread × 50, "Empty stock" → Make Bread × 50, Plant Wheat × 150.
  - Catalog: search lists items; detail shows recipe and "Used in" (Wheat → Blackberry Muffin, Bread, Chicken Feed).
  - Edit Bread yield to 2 and save → detail shows "Edited" and new yield; "Reset to original" restores yield 1.
  - Edit that creates a loop shows the issue text and does not save.
  - Add custom item "Jam" → appears in catalog; delete blocked with a message when it's used in an open order.
  - Backup: Export triggers a download named `hay-day-backup-YYYY-MM-DD.json` and shows "Last backup: today"; importing an invalid file shows "This file isn't a valid Hay Day Manager backup" and changes nothing; importing a valid file asks "Replace all data?" before writing.
  - When `meta.persisted` is false, Backup shows "Your browser may clear this data. Export a backup regularly."
- [ ] **Step 2:** Run `npx vitest run tests/ui` — FAIL for new tests.
- [ ] **Step 3:** Implement. Download via `Blob` + temporary `<a download>`; import via `<input type="file" accept="application/json">`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat: calculator, catalog editor and backup screens`

### Task 16: PWA, end-to-end test and deployment

**Files:**
- Create: `src/ui/components/UpdatePrompt.tsx`, `public/icon-192.png`, `public/icon-512.png` (plain generated icon: letters "HD" on a solid colour), `e2e/order-flow.spec.ts`, `playwright.config.ts`, `.github/workflows/deploy.yml`, `README.md`
- Modify: `vite.config.ts`, `src/App.tsx`, `package.json`

**Interfaces:**
- Produces: `npm run e2e` (= `playwright test` against `vite preview`).
- [ ] **Step 1:** Configure `vite-plugin-pwa` with `registerType: "prompt"`, manifest name "Hay Day Manager", `display: "standalone"`, both icons, precache all build assets. `<UpdatePrompt>` uses `useRegisterSW` and shows "Update available" with an "Update" button.
- [ ] **Step 2: Write `e2e/order-flow.spec.ts`** at a 390×844 viewport: add farm "Main" (level 20, fields 12) → set Wheat to 10 on Stock → add truck order Bread × 2 → Plan shows "Bread × 2" → tap "Made 1 batch" twice → mark the order done → Stock shows Bread 0 and Wheat 4. Then reload with the network offline (`context.setOffline(true)`) and assert the Home screen still renders.
- [ ] **Step 3:** Run `npm run build && npm run e2e` — expected PASS.
- [ ] **Step 4:** Write `deploy.yml`: on push to `main`, Node 20, `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, deploy `dist/` with `actions/upload-pages-artifact` + `actions/deploy-pages`.
- [ ] **Step 5:** Write `README.md`: what the app does, `npm` scripts, and phone install steps (open the Pages URL in Chrome → menu → Add to Home screen).
- [ ] **Step 6:** Run `npm test && npm run typecheck && npm run build` — all pass.
- [ ] **Step 7: Commit** `feat: installable PWA, e2e test and GitHub Pages deploy`
- [ ] **Step 8:** With the user: create the GitHub repository, push, enable Pages (source: GitHub Actions), and confirm the site loads on their phone.
