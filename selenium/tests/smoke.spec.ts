import { strict as assert } from 'assert';
import { By, until, WebDriver } from 'selenium-webdriver';
import { BASE_URL, crearDriver } from '../driver';

describe('Smoke', function () {
  let driver: WebDriver;

  before(async () => { driver = await crearDriver(); });
  after(async () => { await driver?.quit(); });

  it('SMOKE-01 | La página de login abre en Chrome', async () => {
    await driver.get(`${BASE_URL}login.php`);

    assert.equal(await driver.getTitle(), 'Login - ANPR - UltraIP');
    assert.ok(await driver.wait(until.elementLocated(By.css('input[name="userName"]'))).then((e) => e.isDisplayed()));
    assert.ok(await driver.findElement(By.css('input[name="password"]')).isDisplayed());
    assert.ok(await driver.findElement(By.css('button.login-submit')).isDisplayed());
  });
});
