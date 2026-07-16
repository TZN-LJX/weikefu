import { defineConfig, devices } from '@playwright/test'

const systemEdge = process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : undefined

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/weikefu/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: systemEdge ? { executablePath: systemEdge } : undefined,
  },
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/weikefu/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'huawei-mobile',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 412, height: 915 },
      },
    },
  ],
})
