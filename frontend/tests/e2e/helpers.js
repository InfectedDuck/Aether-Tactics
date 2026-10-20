// Shared e2e helpers: Demo Commander login + page-error collection.
// The demo session is fully local (localStorage seed), so no backend needed.
export async function loginAsDemo(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const adminBtn = page.locator("button.gateway-admin");
  await adminBtn.waitFor({ timeout: 20000 });
  await adminBtn.click();
  await page.waitForURL("**/admin", { timeout: 20000 });
}

export function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err).slice(0, 200)));
  return errors;
}
