import { expect, test } from "@playwright/test";
import { collectPageErrors, loginAsDemo } from "./helpers.js";

// Demo Commander flow: gateway -> admin -> Play hub + key screens render
// with demo data and zero page errors (backend-independent: local session).
test("demo flow renders the hub, collection and codex", async ({ page }) => {
  const errors = collectPageErrors(page);
  await loginAsDemo(page);

  await page.goto("/menu", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Play" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue|Start skirmish|Play daily/ })).toBeVisible();
  const tiles = page.locator(".at-mode-tile");
  await expect(tiles).toHaveCount(4);
  // Every mode tile must show art (no letter placeholders).
  await expect(tiles.locator(".at-mode-tile__art img")).toHaveCount(4);

  await page.goto("/collection", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Shop" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Inventory" })).toBeVisible();

  await page.goto("/codex", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Factions" })).toBeVisible();

  expect(errors).toEqual([]);
});
