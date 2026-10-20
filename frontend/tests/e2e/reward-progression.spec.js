import { expect, test } from "@playwright/test";
import { collectPageErrors, loginAsDemo } from "./helpers.js";

// Reward progression renders from persisted state: the Demo Commander seed
// is a mid-season pass (Tier 5, missions 4/10, claimable rewards badged),
// while a fresh visitor is gated. UI claims are backend-coupled on purpose
// (atomic Vault RPCs), so click-to-claim is NOT covered here.
test("battle pass progression reflects the persisted pass state", async ({ page }) => {
  const errors = collectPageErrors(page);
  await loginAsDemo(page);

  await page.goto("/battle-pass", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Battle Pass" })).toBeVisible();
  await expect(page.getByText(/tier 5 of 10/i)).toBeVisible();
  await expect(page.getByRole("tab", { name: /missions 4\/10/i })).toBeVisible();
  // Full 10-tier track with a details preview for the selected tier.
  await expect(page.locator(".at-track-col")).toHaveCount(10);
  await expect(page.locator(".at-bp-preview")).toBeVisible();
  // Claimable rewards surface as a nav badge.
  await expect(page.locator(".at-rail__dot").first()).toBeVisible();

  // Missions tab shows segmented progress with reward chips.
  await page.getByRole("tab", { name: /missions/i }).click();
  await expect(page.locator(".at-mission")).not.toHaveCount(0);
  await expect(page.getByText(/bp xp is added automatically/i)).toBeVisible();

  expect(errors).toEqual([]);
});

test("guests are locked out of progression screens", async ({ page }) => {
  await page.goto("/battle-pass", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Battle Pass Locked", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /login \/ register/i }).first()).toBeVisible();
});
