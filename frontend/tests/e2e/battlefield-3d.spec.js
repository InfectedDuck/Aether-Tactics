import { expect, test } from "@playwright/test";
import { collectPageErrors, loginAsDemo } from "./helpers.js";

// 3D rendering smoke: the AI board mounts a WebGL canvas and the match HUD
// appears (SwiftShader in headless CI, generous timeouts).
test("3D battlefield renders with HUD and no page errors", async ({ page }) => {
  test.setTimeout(120000);
  const errors = collectPageErrors(page);
  await loginAsDemo(page);

  await page.goto("/play/ai", { waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".battle-top-hud")).toBeVisible({ timeout: 30000 });

  expect(errors).toEqual([]);
});
