import { expect, test } from '@playwright/test'

test('add a farm, plan an order, make it, mark it done, then reopen offline', async ({ page, context }) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'Add your first farm' }).click()
  await page.getByLabel('Farm name').fill('Main')
  await page.getByLabel('Level', { exact: true }).fill('20')
  await page.getByLabel('Fields', { exact: true }).fill('12')
  await page.getByRole('button', { name: 'Save farm' }).click()
  await expect(page.getByRole('combobox', { name: 'Farm' })).toHaveValue(/.+/)

  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Stock' }).click()
  await page.getByRole('button', { name: 'Edit Wheat' }).click()
  await page.getByLabel('Count').fill('10')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('listitem', { name: 'Wheat' }).locator('.stock-total')).toHaveText('10')

  await nav.getByRole('link', { name: 'Orders' }).click()
  await page.getByRole('link', { name: 'New truck order' }).click()
  await page.getByLabel('Find an item').fill('bread')
  await page.getByRole('button', { name: 'Add Bread', exact: true }).click()
  await page.getByLabel('Bread quantity').fill('2')
  await page.getByRole('button', { name: 'Save order' }).click()
  await expect(page.getByRole('listitem', { name: 'Bread × 2' })).toBeVisible()

  await nav.getByRole('link', { name: 'Plan' }).click()
  const make = page.getByRole('listitem', { name: 'Bread × 2' })
  await expect(make).toBeVisible()
  await make.getByRole('button', { name: 'Made 1 batch' }).click()
  await page.getByRole('listitem', { name: 'Bread × 1' }).getByRole('button', { name: 'Made 1 batch' }).click()
  await expect(page.getByText('Everything is in stock.')).toBeVisible()

  await nav.getByRole('link', { name: 'Orders' }).click()
  await page.getByRole('button', { name: 'Mark done' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByText('No open truck orders.')).toBeVisible()

  await nav.getByRole('link', { name: 'Stock' }).click()
  await expect(page.getByRole('listitem', { name: 'Bread', exact: true }).locator('.stock-total')).toHaveText('0')
  await expect(page.getByRole('listitem', { name: 'Wheat' }).locator('.stock-total')).toHaveText('4')

  // Offline: once the service worker is active, opening the app again works without the network.
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Main' })).toBeVisible()
})
