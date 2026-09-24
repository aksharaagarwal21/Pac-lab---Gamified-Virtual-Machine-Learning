import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.browser.spec.mjs',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:5173', channel: 'chrome', headless: true },
  webServer: { command: 'npm run dev -- --host localhost', url: 'http://localhost:5173', reuseExistingServer: true },
})
