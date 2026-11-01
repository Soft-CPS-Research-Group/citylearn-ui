import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: process.env.UI_TEST_OUTPUT_DIR || "test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3177",
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.UI_CHROME_EXECUTABLE
      ? { executablePath: process.env.UI_CHROME_EXECUTABLE }
      : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port 3177 --strictPort${process.env.UI_BUILD_DIR ? ' --outDir "' + process.env.UI_BUILD_DIR + '"' : ""}`,
    url: "http://127.0.0.1:3177",
    reuseExistingServer: false,
  },
});
