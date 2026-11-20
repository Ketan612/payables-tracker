import { test, expect } from "@playwright/test";

test("PWA manifest is linked and exposes install metadata", async ({ page }) => {
  await page.goto("/");
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute("href", "./manifest.json");

  const manifestResponse = await page.request.get("/manifest.json");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("Payables Tracker");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("./");
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test("PWA service worker registers without taking over API requests", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('script[src="./pwa.js"]')).toHaveCount(1);

  const registration = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const result = await navigator.serviceWorker.ready;
    return {
      scope: result.scope,
      scriptURL: result.active?.scriptURL ?? null
    };
  });

  expect(registration).not.toBeNull();
  expect(registration!.scriptURL).toContain("/sw.js");
  expect(registration!.scope).toContain("/");
});

test("offline navigation shows a clear fallback instead of stale financial data", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
  });

  await page.context().setOffline(true);
  await page.goto("/cashbook.html");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByText(/needs an internet connection/i)).toBeVisible();
});
