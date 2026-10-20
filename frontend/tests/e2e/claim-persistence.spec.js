import { expect, test } from "@playwright/test";
import { collectPageErrors, loginAsDemo } from "./helpers.js";

// Offline claim persistence: with no backend (vite-only, like CI), claiming
// an achievement as the local Demo Commander must stick — profile and
// inventory persist to localStorage instead of rolling back with an error.
// Without the local-session path in claimAchievement this regresses to 7/8.
test("achievement claims persist locally with no backend", async ({ page }) => {
  const errors = collectPageErrors(page);
  await loginAsDemo(page);

  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("8/8 claimed").first()).toBeVisible({ timeout: 20000 });

  // Un-claim one achievement directly in the seed, then reload.
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("dama-profile"));
    profile.achievements_claimed = (profile.achievements_claimed || []).slice(1);
    localStorage.setItem("dama-profile", JSON.stringify(profile));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("7/8 claimed").first()).toBeVisible({ timeout: 20000 });
  const readyCard = page.locator(".achievement-card.ready").first();
  await expect(readyCard).toBeVisible();

  // Claim it through the UI: count returns to 8/8 and survives a reload.
  await readyCard.click();
  await expect(page.getByText("8/8 claimed").first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".achievement-card.claimed")).toHaveCount(8);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("8/8 claimed").first()).toBeVisible({ timeout: 20000 });

  expect(errors).toEqual([]);
});
