import { defineConfig, devices } from '@playwright/test';

// Поведенческие тесты на демо-страницах: vite отдаёт исходники кита, как при разработке
const PORT = 5199;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npx vite demo --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
});
