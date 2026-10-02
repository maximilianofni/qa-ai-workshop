import { Builder, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

export const BASE_URL = process.env.BASE_URL!;
export const APP_USER = process.env.APP_USER!;
export const APP_PASSWORD = process.env.APP_PASSWORD!;

// Chrome sin ventana por defecto; con SELENIUM_HEADED=1 se ve el navegador maximizado
export async function crearDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.setAcceptInsecureCerts(true); // Entorno de testing con certificado interno
  if (process.env.SELENIUM_HEADED) {
    options.addArguments('--start-maximized');
  } else {
    options.addArguments('--headless=new', '--window-size=1920,1080');
  }
  return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}
