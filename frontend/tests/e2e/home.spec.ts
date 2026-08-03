import { test, expect } from '@playwright/test'

// Smoke-style test: open frontend, use backend API to add a seeded variant to cart and verify via API.
// This is resilient to UI text/localization changes.
test('browse and add to cart', async ({ page, request }) => {
  await page.goto('/')

  // Add to cart via backend API (seeded variant var-1 exists in dev sqlite)
  const addResp = await request.post('http://localhost:4001/api/cart/items', { data: { variant_id: 'var-1', qty: 1 } })
  expect(addResp.ok()).toBeTruthy()
  const addJson = await addResp.json()
  expect(addJson.cart_id).toBeTruthy()

  // Fetch cart and verify the item exists
  const cartResp = await request.get(`http://localhost:4001/api/cart?cart_id=${addJson.cart_id}`)
  expect(cartResp.ok()).toBeTruthy()
  const cartJson = await cartResp.json()
  expect(cartJson.items && cartJson.items.length).toBeGreaterThan(0)

})
