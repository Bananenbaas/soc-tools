import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '/tmp/soc-tools-playwright-results',
  use: {
    baseURL: 'http://127.0.0.1:43999',
    browserName: 'chromium',
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    port: 43999,
    reuseExistingServer: false,
  },
})
