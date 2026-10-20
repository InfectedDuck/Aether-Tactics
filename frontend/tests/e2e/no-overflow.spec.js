import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./helpers.js";

// Definition-of-done guard: no horizontal page scroll at 390px.
// (Runs in the mobile project; the tier track scrolls inside its own
// container by design — only the document width is asserted.)
const ROUTES = ["/menu", "/skirmish", "/campaign", "/daily", "/match/summary", "/collection", "/battle-pass", "/codex", "/multiplayer", "/profile", "/settings"];

test("no horizontal page scroll at 390px", async ({ page }) => {
  test.setTimeout(180000);
  await loginAsDemo(page);
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Measure the settled layout: webfonts can swap metrics mid-load and
    // briefly widen nowrap pills, so wait for fonts then poll for stability.
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.scrollWidth), { timeout: 15000 })
      .toBeLessThanOrEqual(390);
  }
});
