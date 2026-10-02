import { defineConfig } from 'cypress';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

export default defineConfig({
  // Reporte HTML (mochawesome), con capturas de los tests que fallan
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'cypress/reports',
    reportPageTitle: 'Reporte Cypress - ANPR',
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
  },
  e2e: {
    baseUrl: process.env.BASE_URL,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on) {
      require('cypress-mochawesome-reporter/plugin')(on);
    },
    env: {
      APP_USER: process.env.APP_USER,
      APP_PASSWORD: process.env.APP_PASSWORD,
    },
  },
  // Pantalla completa, igual que en Playwright
  viewportWidth: 1920,
  viewportHeight: 1080,
  video: false,
  screenshotOnRunFailure: true,
});
