import { strict as assert } from 'assert';
import { By, until, WebDriver } from 'selenium-webdriver';
import { APP_PASSWORD, APP_USER, BASE_URL, crearDriver } from '../driver';

const TIMEOUT = 10_000;

describe('Login', function () {
  let driver: WebDriver;

  const login = async (user: string, password: string) => {
    await driver.get(`${BASE_URL}login.php`);
    await driver.findElement(By.css('input[name="userName"]')).sendKeys(user);
    await driver.findElement(By.css('input[name="password"]')).sendKeys(password);
    await driver.findElement(By.css('button.login-submit')).click();
  };

  const textoError = async () => {
    const error = await driver.wait(until.elementLocated(By.id('loginError')), TIMEOUT);
    await driver.wait(until.elementIsVisible(error), TIMEOUT);
    return error.getText();
  };

  // Sin sesión iniciada, no se puede entrar al Panel de control
  const verificarSinAccesoAlPanel = async () => {
    await driver.get(`${BASE_URL}index.php`);
    await driver.wait(until.urlMatches(/login\.php/), TIMEOUT);
  };

  // Cada caso usa un navegador nuevo, sin sesión previa (igual que Playwright y Cypress).
  // Reutilizar el navegador limpiando cookies y almacenamiento no alcanza en ANPR.
  beforeEach(async () => { driver = await crearDriver(); });
  afterEach(async () => { await driver?.quit(); });

  it('LOGIN-01 | Login exitoso con usuario válido', async () => {
    await login(APP_USER, APP_PASSWORD);

    await driver.wait(until.urlMatches(/index\.php/), TIMEOUT);
    await driver.wait(until.titleIs('Panel de control - ANPR - UltraIP'), TIMEOUT);
    const usuario = await driver.wait(until.elementLocated(By.css('a.user')), TIMEOUT);
    assert.equal((await usuario.getText()).trim(), APP_USER);

    // Pausa de 2 segundos para ver el Panel de control
    await driver.sleep(2000);
  });

  it('LOGIN-02 | Login con contraseña incorrecta', async () => {
    // Contraseña distinta a la válida del .env
    await login(APP_USER, `${APP_PASSWORD}-incorrecta`);

    assert.equal(await textoError(), 'Cuenta de usuario inválida. Verifique su usuario y/o contraseña.');
    assert.match(await driver.getCurrentUrl(), /login\.php/);
    assert.equal(await driver.getTitle(), 'Login - ANPR - UltraIP');

    await verificarSinAccesoAlPanel();
  });

  it('LOGIN-03 | Login con campos vacíos', async () => {
    await driver.get(`${BASE_URL}login.php`);

    // Click en Login sin completar usuario ni contraseña
    await driver.findElement(By.css('button.login-submit')).click();

    assert.equal(await textoError(), 'Debe ingresar usuario y contraseña.');
    assert.match(await driver.getCurrentUrl(), /login\.php/);
    assert.equal(await driver.getTitle(), 'Login - ANPR - UltraIP');
  });

  it('LOGOUT-01 | Cerrar sesión vuelve al login', async () => {
    await login(APP_USER, APP_PASSWORD);
    await driver.wait(until.urlMatches(/index\.php/), TIMEOUT);

    // Pausa de 2 segundos para ver el Panel de control
    await driver.sleep(2000);

    // Abrir el menú del usuario y hacer click en Logout.
    // Los enlaces del menú de ANPR no responden al click nativo de Selenium
    // (en Playwright y Cypress sí), así que se hace click con JavaScript.
    const usuario = await driver.findElement(By.css('a.user'));
    await driver.executeScript('arguments[0].click()', usuario);
    const logout = await driver.findElement(By.css('a.logout'));
    await driver.wait(until.elementIsVisible(logout), TIMEOUT);
    await driver.executeScript('arguments[0].click()', logout);

    await driver.wait(until.urlMatches(/login\.php/), TIMEOUT);
    assert.equal(await driver.getTitle(), 'Login - ANPR - UltraIP');

    await verificarSinAccesoAlPanel();
  });
});
