import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * NAMING: specs are `*.e2e.ts`, not `*.spec.ts` or `*.test.ts`. `npm test` runs
 * `node --test`, whose default file patterns include `**\/*.test.ts`. A Playwright
 * spec picked up by the Node test runner fails confusingly, because
 * `@playwright/test` cannot run outside its own runner. The distinct suffix keeps
 * the two suites from ever selecting each other's files.
 *
 * BROWSERS: chromium only. It is the single engine whose binary is installed
 * (`npx playwright install chromium`). Adding firefox/webkit projects without
 * their binaries would produce failures that look like application bugs.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: "list",

  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Tests run against a real production build, not the dev server: the CSS
  // pipeline (Tailwind + tokens) and React Server Component rendering both differ
  // in development, and it is the production output that ships.
  webServer: {
    command: "npm run build && npm run start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
