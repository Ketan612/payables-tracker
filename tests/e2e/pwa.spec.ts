import { test, expect } from "@playwright/test";

const appPages = ["/", "/cashbook.html", "/sms-capture.html", "/sms-admin.html"];

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
  expect(manifest.scope).toBe("./");

  for (const [size, path] of [["192x192", "./icons/icon-192.png"], ["512x512", "./icons/icon-512.png"]]) {
    const icon = manifest.icons.find((item: { src: string }) => item.src === path);
    expect(icon, `Manifest is missing ${size} icon`).toBeTruthy();
    expect(icon.sizes).toBe(size);
    expect(icon.type).toBe("image/png");
    const iconResponse = await page.request.get(path);
    expect(iconResponse.ok(), `Icon failed to load: ${path}`).toBeTruthy();
    expect(iconResponse.headers()["content-type"]).toMatch(/image\/png/);
    const bytes = await iconResponse.body();
    expect(bytes.toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(Number(size.split("x")[0]));
    expect(bytes.readUInt32BE(20)).toBe(Number(size.split("x")[1]));
  }
});

test("PWA service worker is registered on every app page", async ({ page }) => {
  for (const route of appPages) {
    await page.goto(route);
    await expect(page.locator('script[src="./pwa.js"]')).toHaveCount(1);
    const registration = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const result = await navigator.serviceWorker.ready;
      return {
        scope: result.scope,
        scriptURL: result.active?.scriptURL ?? null
      };
    });

    expect(registration, `Service worker unavailable on ${route}`).not.toBeNull();
    expect(registration!.scriptURL).toContain("/sw.js");
    expect(registration!.scope).toContain("/");
  }
});

test("mobile app pages do not introduce horizontal document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of appPages) {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth
    }));
    expect(
      dimensions.document,
      `Horizontal overflow on ${route}: viewport=${dimensions.viewport}, document=${dimensions.document}`
    ).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
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

test("app returns to normal navigation after connectivity is restored", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
  });

  await page.context().setOffline(true);
  await page.goto("/cashbook.html");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();

  await page.context().setOffline(false);
  await page.goto("/cashbook.html");
  await expect(page.locator("body")).not.toContainText("You're offline");
  await expect(page.locator("body")).not.toBeEmpty();
});
