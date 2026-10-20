import { expect, test } from "@playwright/test";
import { collectPageErrors, loginAsDemo } from "./helpers.js";

// Room sync over the local lobby channel (localStorage + BroadcastChannel,
// no backend): host creates a lobby, guest joins with the code, both ready,
// both land on the live board.
test("private lobby host, join, ready and launch stay in sync", async ({ page, context }) => {
  test.setTimeout(180000);
  const errorsA = collectPageErrors(page);
  await loginAsDemo(page);

  // Host a lobby from the multiplayer screen.
  await page.goto("/multiplayer", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /host private lobby/i }).click();
  await page.waitForURL("**/lobby/**", { timeout: 20000 });
  const code = (await page.locator(".at-page-title").first().innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Guest joins with the code in a second page (same storage session).
  const guest = await context.newPage();
  const errorsB = collectPageErrors(guest);
  await guest.goto(`/lobby/${code}`, { waitUntil: "domcontentloaded" });
  await guest.locator('input[placeholder="A1B2C3"]').fill(code);
  await guest.getByRole("button", { name: /join lobby/i }).click();
  await expect(guest.getByText(/two commanders connected/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/two commanders connected/i)).toBeVisible({ timeout: 30000 });

  // Host readies up; guest sees it.
  await page.getByRole("button", { name: /^ready$/i }).click();
  await expect(guest.getByText(/host[\s\S]*ready/i).first()).toBeVisible({ timeout: 30000 });

  // Guest readies up; both launch into the live match.
  await guest.getByRole("button", { name: /^ready$/i }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60000 });
  await expect(guest.locator("canvas").first()).toBeVisible({ timeout: 60000 });

  expect(errorsA).toEqual([]);
  expect(errorsB).toEqual([]);
  await guest.close();
});
