import { defineConfig, devices } from "@playwright/test";

// Aether Tactics e2e suite ("If I Kept Going": automated browser tests for
// 3D rendering, room sync, and reward progression).
// Backend-independent by design: the Demo Commander session is a local
// session (localStorage seed + fallbacks), lobby sync runs over localStorage
// + BroadcastChannel, and persistence-backed claims are NOT covered here
// (they need Supabase; DB routes return 503 without keys).
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173",
    url: "http://localhost:5173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: "desktop",
      testIgnore: ["**/no-overflow.spec.js"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 900 },
        launchOptions: {
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
        },
      },
    },
    {
      name: "mobile",
      testMatch: ["**/no-overflow.spec.js"],
      use: {
        // Custom 390px context (not a named device: e.g. Pixel 7 is 412px
        // wide, which would assert the wrong width for this DoD check).
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions: { args: ["--no-sandbox"] },
      },
    },
  ],
});
