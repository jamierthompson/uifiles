import { defineConfig, devices } from "@playwright/test"

const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // One built server serves every worker; two keep the CI runner responsive.
  ...(CI ? { workers: 2 } : {}),
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  // Desktop and phone width: axe's target-size and scrollable-region rules
  // only fire once a layout wraps or overflows, and 375 px is where the
  // previews and the home page do.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    // CI runs `pnpm build` first, so e2e exercises the production server.
    command: CI ? "pnpm start" : "pnpm registry:build && pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
