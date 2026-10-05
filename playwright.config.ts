import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const chrome = {
  ...devices['Desktop Chrome'],
  channel: 'chrome',
  // Navegador maximizado (pantalla completa) al correr con --headed
  viewport: null,
  deviceScaleFactor: undefined,
  launchOptions: { args: ['--start-maximized'] },
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    // Entorno de testing con certificado interno
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Un proyecto por producto, cada uno con su ambiente
  projects: [
    {
      name: 'anpr',
      testIgnore: 'biblioteca-digital/**',
      use: { ...chrome, baseURL: process.env.BASE_URL },
    },
    {
      name: 'biblioteca-digital',
      testDir: './tests/biblioteca-digital',
      use: { ...chrome, baseURL: process.env.BD_BASE_URL },
    },
  ],
});
