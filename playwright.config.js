import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:8080/";

export default defineConfig({
    testDir: "tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        // Deterministic requests; one PWA test opts back in.
        serviceWorkers: "block",
        // Point at a pre-installed Chromium instead of the version-matched
        // download (sandboxes without network); unset in CI.
        launchOptions: process.env.PW_CHROMIUM_PATH
            ? { executablePath: process.env.PW_CHROMIUM_PATH }
            : {}
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        // Only CI installs these browsers; locally the suite runs on Chromium.
        ...(process.env.CI
            ? [
                  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
                  { name: "webkit", use: { ...devices["Desktop Safari"] } }
              ]
            : [])
    ],
    webServer: {
        timeout: 120_000,
        command: "pnpm build && pnpm preview",
        url: `${BASE_URL}index.html`,
        reuseExistingServer: !process.env.CI
    }
});
