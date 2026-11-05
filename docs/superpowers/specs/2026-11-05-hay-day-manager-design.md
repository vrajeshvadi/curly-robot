# Hay Day Manager — Design Spec

- **Date:** 2026-11-05
- **Status:** Draft, awaiting review
- **Path:** Architectural (new project)

## 1. Purpose

A personal, phone-first web app for managing one main Hay Day farm plus several baby farms. Before a play session, the user opens it, enters orders, and immediately sees:

- what they already have,
- what they must make or plant (down to raw crops),
- which other farm can cover a shortfall,
- which items are below their chosen minimum.

It is a fan tool for personal use. No login, no sharing, no game artwork or logos.

### Success criteria

1. A truck, boat or visitor order can be entered in under a minute.
2. A plan for all open orders on a farm appears with no extra steps after the orders are entered.
3. Planner numbers match hand calculation on the test catalog (enforced by tests).
4. Works fully offline after the first load and installs to the phone home screen.
5. A backup exported on one phone restores identical data on another.

## 2. Scope

### In version 1

| Area | Features |
|---|---|
| Farms | Main + any number of baby farms; name, level, barn/silo capacity, machines owned with slot counts, fields, animal counts, tree/bush counts |
| Catalog | Pre-filled, editable catalog of items, machines and recipes; user edits stored separately with "reset to original"; user-added items; "used in" lookup |
| Stock | Per farm and item: total, reserved, free, minimum; +/− and typed counts; quick count mode; low-stock list |
| Orders | Truck, boat, visitor; item lines; reserve switch; mark done (deducts stock, releases reservation); "can fill now" badge |
| Planning | Combined to-make list across chosen orders; low-stock top-ups; cross-farm transfer suggestions; replant-aware crop maths; locked-item handling; machine/field/animal time estimate; barn/silo overflow warning |
| Calculator | Breakdown for one item and quantity, against empty stock or current stock |
| Production log | "Made 1 batch" adds the product and deducts ingredients |
| Data | Backup export/import (JSON file); persistent storage request; last-backup date |
| App | Installable PWA, offline, light/dark mode, update prompt |

### Parked (not in version 1)

Order value/profit check, live production queue and timers, catalog-update merge tool, special handling for expansion materials, order priority and boat deadline, transfer tracker, Derby, neighborhood, roadside-shop sales tracking. Expansion materials exist in the catalog as ordinary items.

## 3. Architecture

**Stack:** React + TypeScript, built with Vite. IndexedDB via Dexie. PWA via `vite-plugin-pwa`. Schema validation via Zod. Tests: Vitest + React Testing Library; one Playwright end-to-end test. Hash-based routing (works on static hosting). Hosted on GitHub Pages, deployed by GitHub Actions.

No server. All data lives in the phone's browser storage.

### Units

| Unit | Responsibility | Depends on |
|---|---|---|
| `catalog/` | Seed data file, override merging, validation (ingredients exist, no cycles, positive values) | nothing |
| `data/` | Dexie database, typed repositories for farms, stock, orders, overrides; backup export/import | `catalog/` types |
| `planner/` | Pure functions: demand, netting, transfers, breakdown, time and storage estimates; calculator | `catalog/` types only. No storage, no React |
| `actions/` | Stock-changing operations: mark order done, log batch, quick-count save. Each runs in one database transaction | `data/`, `catalog/` |
| `ui/` | Screens and components | everything above |

The planner receives plain data and returns plain data, so it is fully testable without a browser.

## 4. Data model

```ts
type ItemId = string;          // slug, e.g. "bread"
type FarmId = string;

type Category = "crop" | "tree" | "animal" | "made" | "material";
type Storage = "barn" | "silo";

interface Ingredient { itemId: ItemId; qty: number }

interface Item {
  id: ItemId;
  name: string;
  category: Category;
  storage: Storage;
  unlockLevel: number;
  source:
    | { kind: "field"; seedUsed: number; harvestYield: number; minutes: number }
    | { kind: "tree"; treeId: string; yield: number; minutes: number }
    | { kind: "animal"; animalId: string; yield: number; minutes: number; ingredients: Ingredient[] }
    | { kind: "machine"; machineId: string; yield: number; minutes: number; ingredients: Ingredient[] }
    | { kind: "none" };        // materials and anything not produced
}

interface Machine { id: string; name: string; unlockLevel: number }

interface Farm {
  id: FarmId;
  name: string;
  level: number;
  barnCapacity: number;
  siloCapacity: number;
  fields: number;
  machines: Record<string, { owned: boolean; slots: number }>;
  animals: Record<string, number>;   // animalId -> count
  trees: Record<string, number>;     // treeId -> count
}

interface StockRow { farmId: FarmId; itemId: ItemId; total: number; min: number }

type OrderType = "truck" | "boat" | "visitor";
interface Order {
  id: string;
  farmId: FarmId;
  type: OrderType;
  lines: Ingredient[];
  reserve: boolean;
  status: "open" | "done";
  createdAt: string;
}

interface CatalogOverride { itemId: ItemId; item: Item }   // full replacement
interface CustomItem extends Item {}                        // user-added
```

### Rules

- An item with no `StockRow` on a farm has `total = 0` and `min = 0`.
- **Low stock** = `min > 0` and `free < min`.
- **Top-ups** chosen on Home or Plan are kept in app state for the session (not saved to storage).
- **Effective catalog** = seed items, each replaced by its override if one exists, plus custom items. Seed data is never modified. "Reset to original" deletes the override.
- **Reserved** for an item on a farm = sum of that item's lines across open orders with `reserve = true`.
- **Free** = `max(0, total − reserved)`. If reserved exceeds total, the item shows a warning.
- **Spare** (offered to other farms) = `max(0, free − min)`.
- **Locked**: an item is locked on a farm if `unlockLevel > farm.level`, or its machine/animal/tree is not owned there.
- Stock never goes below zero. Any deduction that would go negative is floored at zero and reported to the user.

## 5. Planner

### Input

Target farm, the effective catalog, all farms with their stock and orders, the chosen order IDs, top-up item IDs, and a `useOtherFarms` switch (default on).

### Steps

1. **Demand.** Sum lines of the chosen orders. For each top-up item whose stock is low, add `min`. Netting against free stock in step 3 then leaves exactly `min − free` to make, on top of any order demand.
2. **Available stock.** For the target farm: `total − reserved by open orders not in this plan`, floored at zero. Reserved orders inside the plan can therefore use their own reservation.
3. **Process items top-down.** Sort the recipe graph topologically (finished goods first). For each item, once every parent has added its demand:
   1. Take from available stock.
   2. If `useOtherFarms`, take from other farms' spare, largest spare first, and record a transfer suggestion `{from, itemId, qty}`.
   3. Any remainder is the shortfall:
      - **Locked on target farm:** list under "can't make here".
      - **`machine` / `animal`:** `batches = ceil(shortfall / yield)`; add `ingredient.qty × batches` to each ingredient's demand.
      - **`field`:** `netYield = harvestYield − seedUsed`; `plantings = ceil(shortfall / netYield)`. If available stock before this item's deductions is below `seedUsed` (no seed for the first planting), flag "no seed". (Revised 2026-11-05: checking after deductions flagged almost every crop shortfall, since the first planting happens before the stock is used.)
      - **`tree`:** `harvests = ceil(shortfall / yield)`.
      - **`none`:** list under "missing, can't be produced".
4. **Time estimate.**
   - Machine: `Σ batches × minutes` across every item made on it (one batch at a time).
   - Field: `ceil(total plantings / farm.fields)` rounds × crop minutes, per crop.
   - Animal / tree: `ceil(batches / count)` rounds × minutes.
   - Each item's cost is its resource time for this plan. The **overall estimate** is the largest sum of costs along any ingredient chain. It ignores boosts and time away and is labelled "estimate".
5. **Storage check.** Projected barn use = current barn total − barn ingredients consumed + barn goods produced + transfers in; same for silo. Warn if either exceeds capacity.

### Output

```ts
interface Plan {
  fromStock: Ingredient[];
  transfers: { fromFarmId: FarmId; itemId: ItemId; qty: number }[];
  make: { itemId: ItemId; batches: number; resourceId: string }[];
  plant: { itemId: ItemId; plantings: number }[];
  cantMakeHere: Ingredient[];
  missing: Ingredient[];
  warnings: (
    | { kind: "no-seed"; itemId: ItemId; have: number; need: number }
    | { kind: "barn-overflow" | "silo-overflow"; projected: number; capacity: number }
    | { kind: "reserved-exceeds-total"; itemId: ItemId; reserved: number; total: number }
  )[];
  time: { perResource: Record<string, number>; overallMinutes: number };
}
```

Each `make` row also shows **queue refills** = `ceil(batches / farm.machines[machineId].slots)`: how many times the machine's queue must be filled to finish those batches. Slots do not change the time estimate.

If the topological sort finds a loop (should be impossible because edits are validated), the planner returns an error result instead of a plan.

### Calculator

Calls the planner with one demand line. "Empty stock" mode passes zero stock and no other farms; "my stock" mode uses the current farm as normal.

### "Can fill now"

An order can be filled now when every line's qty ≤ available stock on its farm (with its own reservation counted as available).

## 6. Stock-changing actions

Each action runs in one Dexie transaction and either fully applies or does nothing.

- **Mark order done:** deduct each line from total (floored at zero, shortfalls reported), set status to done. Its reservation disappears automatically because reservations are derived from open orders.
- **Log batch (`Made 1 batch`):** add `yield` to the product, deduct ingredients (floored, reported). For crops: add `harvestYield − seedUsed`.
- **Quick count save:** write all edited totals at once; cancelling writes nothing.
- **+/− and typed count:** single-row update.

## 7. Screens

Phone-first. Farm switcher at the top. Bottom bar: **Home, Stock, Orders, Plan, More**. Plain text and simple icons, light/dark mode.

- **Home:** open orders with "can fill now" badges; low-stock list with "add to to-make"; barn and silo fill bars; **Plan all open orders** button.
- **Stock:** search and filters (barn/silo, category). Row: name, total / reserved / free, minimum, +/−; tap to type a count or minimum. **Quick count:** full-screen, one item at a time in category order, number pad, Next/Skip, Done/Cancel.
- **Orders:** tabs Truck / Boat / Visitor. Add/edit: search items, set quantities, reserve switch. **Mark done** previews deductions and warns if stock is short.
- **Plan:** choose orders (default all open), add top-ups, "use other farms" switch; results in sections matching the `Plan` output; **Made 1 batch** on each make row.
- **More:** Calculator, Catalog (browse, search, item detail with recipe and "used in", edit/add, "edited" mark and reset), Farms (add/edit), Backup (export, import with confirm, last-backup date).

Only items unlocked on the current farm are shown by default, with a "show locked" switch.

## 8. Error handling

| Case | Behaviour |
|---|---|
| Catalog edit creates a loop or references a missing item | Save blocked with the reason |
| Seed catalog fails validation | Build fails (test) |
| Deduction would go negative | Floored at zero; user shown which items were short |
| Reserved exceeds total | Warning on the item and in plans |
| Import file invalid or wrong schema version | Rejected before any write; existing data untouched |
| Import valid | Confirm dialog, then replace everything in one transaction |
| Storage unavailable (e.g. private tab) | Banner explaining data cannot be saved |
| Persistent storage denied | Note on Backup screen recommending regular exports |

## 9. Backup format

```json
{
  "app": "hay-day-manager",
  "schemaVersion": 1,
  "exportedAt": "2026-11-05T12:00:00Z",
  "farms": [],
  "stock": [],
  "orders": [],
  "catalogOverrides": [],
  "customItems": []
}
```

Validated with Zod on import. File name: `hay-day-backup-YYYY-MM-DD.json`.

## 10. Pre-filled catalog

Compiled from public Hay Day references: item names, unlock levels, sources, times, yields and recipes. Facts only; no artwork or copied text. Stored as `catalog/seed.json` with a `catalogVersion`. Values may be wrong or outdated; every item is editable, and the validation check runs on the seed and on every edit.

## 11. Testing

- **Planner (unit, test catalog):** netting; shared ingredients counted once; replant net yield; reserved stock excluded except for its own order; other farms never taken below minimum; finished goods transferred before ingredients; locked items; no-seed flag; time estimate on a known chain; barn/silo overflow; calculator in both modes; "can fill now".
- **Catalog validation:** seed passes; loop and missing-ingredient edits rejected.
- **Actions:** mark done deducts and clears reservation; log batch (machine and crop); flooring at zero with shortfall report; quick count cancel writes nothing.
- **Backup:** export → import round-trip is identical; invalid file rejected with data untouched.
- **End-to-end (Playwright, phone viewport):** add farm → add order → plan → mark done.

## 12. Deployment

GitHub repository with a GitHub Actions workflow that runs tests, builds, and deploys to GitHub Pages on every push to `main`. The user opens the URL in Chrome on their phone and uses **Add to Home screen**. A new version shows "Update available" and switches only when the user taps it.

## 13. Risks

- **Catalog accuracy:** large dataset from community sources; mitigated by editability and validation.
- **Browser storage eviction:** mitigated by persistent-storage request and backup.
- **Time estimate is approximate:** labelled as an estimate.
