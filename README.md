# Hay Day Manager

A phone-first web app for keeping track of a main Hay Day farm and its baby farms: stock and minimums, truck, boat and visitor orders, and a plan that works out what to make, what to plant and which farm can cover a shortfall. It works offline and keeps all data on your phone.

This is a personal fan tool. It is not made by or affiliated with Supercell.

## Put it on your phone

1. Open the app's link in Chrome on your phone.
2. Tap the menu (⋮), then **Add to Home screen**.
3. Open it from the new icon. It works without internet after the first visit.

Your data stays in that browser on that phone. Use **More → Backup** to export a file now and then, and to move to another phone.

## The catalog

Version 1 covers items unlocked at levels 1–30. Many recipe quantities are best-known values, so check the ones you use and fix them in **More → Catalog** (your edits are kept separately and can be reset). See `docs/catalog-sources.md`.

## Development

```bash
npm install
npm run dev          # local dev server
npm test             # unit and screen tests (Vitest)
npm run typecheck
npm run build        # production build in dist/
npm run e2e          # end-to-end test in a phone-sized browser (Playwright)
npm run build:seed   # regenerate src/catalog/seed.json from scripts/build-seed.mjs
```

If Playwright can't download its browser, point it at an installed Chrome: `PW_EXECUTABLE=/usr/bin/google-chrome npm run e2e`.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`: tests, typecheck, build, then publish to GitHub Pages. In the repository settings, set **Pages → Source** to **GitHub Actions**.

Design and plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
