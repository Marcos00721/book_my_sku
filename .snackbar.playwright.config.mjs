import config from './playwright.config.js'

export default {
  ...config,
  expect: { timeout: 15000 },
  use: { ...config.use, baseURL: 'http://127.0.0.1:5193' },
  webServer: {
    ...config.webServer,
    command: 'npm run dev -- --host 127.0.0.1 --port 5193 --strictPort',
    url: 'http://127.0.0.1:5193',
    reuseExistingServer: false,
  },
}
