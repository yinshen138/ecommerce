import { test, expect } from '@playwright/test';

test('browse and add to cart', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('text=View');
  await page.click('text=View');
  await page.waitForSelector('text=Add to cart');

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Added to cart');
    await dialog.accept();
  });

  await page.click('text=Add to cart');

  // Verify cart via browser fetch (backend is expected on port 4001 in CI)
  const cart = await page.evaluate(async () => {
    const r = await fetch('http://localhost:4001/api/cart');
    return r.json();
  });

  expect(cart.items.length).toBeGreaterThan(0);
});
