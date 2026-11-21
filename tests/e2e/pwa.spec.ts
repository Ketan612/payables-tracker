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

test("PWA install prompt is displayed and invokes the browser prompt", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    let prompted = false;
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => { prompted = true; } },
      userChoice: { value: Promise.resolve({ outcome: "accepted", platform: "web" }) }
    });
    window.dispatchEvent(event);
    (window as Window & { __installPromptCalled?: () => boolean }).__installPromptCalled = () => prompted;
  });

  const banner = page.locator(".payables-pwa-banner");
  await expect(banner).toContainText("Install Payables Tracker");
  await banner.getByRole("button", { name: "Install" }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __installPromptCalled?: () => boolean }).__installPromptCalled?.()
  )).toBe(true);
});

test("PWA service worker is registered on every app page", async ({ page }) => {
  for (const route of appPages) {
    await page.goto(route);
    await expect(page.locator('script[src="./pwa.js"]')).toHaveCount(1);
    const registration = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const result = await navigator.serviceWorker.ready;
      return { scope: result.scope, scriptURL: result.active?.scriptURL ?? null };
    });
    expect(registration, `Service worker unavailable on ${route}`).not.toBeNull();
    expect(registration!.scriptURL).toContain("/sw.js");
    expect(registration!.scope).toContain("/");
  }
});

test("mobile app pages do not introduce horizontal document overflow", async ({ page }) => {
  for (const width of [320, 360, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of appPages) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth
      }));
      expect(
        dimensions.document,
        `Horizontal overflow on ${route} at ${width}px: document=${dimensions.document}`
      ).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
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

test("iPhone-sized layouts keep form controls at a non-zooming text size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of appPages) {
    await page.goto(route);
    const result = await page.evaluate(() => {
      const controls = [...document.querySelectorAll("input, select, textarea")];
      return {
        viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        undersizedControls: controls
          .filter((control) => {
            const style = getComputedStyle(control);
            return style.display !== "none" && style.visibility !== "hidden" &&
              Number.parseFloat(style.fontSize) < 16;
          })
          .map((control) => ({ id: control.id, fontSize: getComputedStyle(control).fontSize }))
      };
    });
    expect(result.viewportMeta).toMatch(/width=device-width/);
    expect(result.viewportMeta).toMatch(/initial-scale=1/);
    expect(result.documentWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.undersizedControls, `iOS auto-zoom risk on ${route}`).toEqual([]);
  }
});

test("browser and installed PWA use separate auth persistence and inactivity policies", async ({ browser }) => {
  const browserPage = await browser.newPage();
  await browserPage.goto("/");
  const browserPolicy = await browserPage.evaluate(() => ({
    usesSessionStorage: window.payablesAuthStorage() === window.sessionStorage,
    idleTimeoutMs: window.payablesSessionPolicy.getIdleTimeoutMs()
  }));
  expect(browserPolicy.usesSessionStorage).toBe(true);
  expect(browserPolicy.idleTimeoutMs).toBe(30 * 60 * 1000);
  await browserPage.close();

  const appPage = await browser.newPage();
  await appPage.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  });
  await appPage.goto("/");
  const appPolicy = await appPage.evaluate(() => ({
    usesLocalStorage: window.payablesAuthStorage() === window.localStorage,
    idleTimeoutMs: window.payablesSessionPolicy.getIdleTimeoutMs()
  }));
  expect(appPolicy.usesLocalStorage).toBe(true);
  expect(appPolicy.idleTimeoutMs).toBe(15 * 24 * 60 * 60 * 1000);
  await appPage.close();
});

test("installed app session policy is included in the offline shell cache", async ({ page }) => {
  await page.goto("/");
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const response = await caches.match(new URL("./session-policy.js?v=mobile-session-20261121", location.href).toString());
    return !!response;
  });
  expect(cached).toBe(true);
});
