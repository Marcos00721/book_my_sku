import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174',
    env: {
      VITE_API_BASE_URL: '/api/v1',
      VITE_SUPABASE_URL: 'https://registration-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_test_key',
    },
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
})
