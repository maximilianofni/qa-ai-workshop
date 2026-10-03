package anpr

import com.kms.katalon.core.configuration.RunConfiguration
import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.testobject.ConditionType
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.util.KeywordUtil
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

import internal.GlobalVariable

/**
 * Acciones comunes de los casos de ANPR.
 * Los elementos se buscan por selector CSS, igual que en Playwright, Cypress y Selenium.
 */
class Anpr {

	static final int TIMEOUT = 10

	/**
	 * Valor de configuración: primero el que llega por consola (-g_NOMBRE=...),
	 * si no, el del archivo .env del repositorio. Así las credenciales nunca
	 * quedan guardadas en el proyecto de Katalon, y también funciona desde el IDE.
	 */
	static String config(String nombre) {
		String valor = GlobalVariable."${nombre}"
		if (valor) {
			return valor
		}
		File env = new File(RunConfiguration.getProjectDir(), '../.env')
		String linea = env.exists() ? env.readLines('UTF-8').find { it.startsWith("${nombre}=") } : null
		if (!linea) {
			KeywordUtil.markFailedAndStop("Falta ${nombre} en el .env del repositorio")
		}
		return linea.substring(nombre.length() + 1).trim()
	}

	static String usuario() { config('APP_USER') }

	static String password() { config('APP_PASSWORD') }

	static TestObject css(String selector) {
		TestObject objeto = new TestObject(selector)
		objeto.addProperty('css', ConditionType.EQUALS, selector)
		return objeto
	}

	static void abrir(String pagina) {
		WebUI.openBrowser('')
		WebUI.setViewPortSize(1920, 1080)
		WebUI.navigateToUrl(config('BASE_URL') + pagina)
	}

	static void login(String usuario, String password) {
		abrir('login.php')
		WebUI.setText(css('input[name="userName"]'), usuario)
		WebUI.setText(css('input[name="password"]'), password)
		WebUI.click(css('button.login-submit'))
	}

	static void esperarUrl(String patron) {
		long limite = System.currentTimeMillis() + TIMEOUT * 1000
		while (System.currentTimeMillis() < limite) {
			if (WebUI.getUrl() =~ patron) {
				return
			}
			WebUI.delay(0.2)
		}
		KeywordUtil.markFailedAndStop("La URL no coincide con ${patron}: ${WebUI.getUrl()}")
	}

	static void verificarTitulo(String esperado) {
		WebUI.verifyEqual(WebUI.getWindowTitle(), esperado, FailureHandling.STOP_ON_FAILURE)
	}

	static void verificarError(String esperado) {
		TestObject error = css('#loginError')
		WebUI.waitForElementVisible(error, TIMEOUT, FailureHandling.STOP_ON_FAILURE)
		WebUI.verifyEqual(WebUI.getText(error), esperado, FailureHandling.STOP_ON_FAILURE)
	}

	// Sin sesión iniciada, no se puede entrar al Panel de control
	static void verificarSinAccesoAlPanel() {
		WebUI.navigateToUrl(config('BASE_URL') + 'index.php')
		esperarUrl(/login\.php/)
	}

	// Los enlaces del menú de usuario de ANPR no responden al click nativo de Selenium
	// (Katalon usa Selenium por debajo), así que se hace click con JavaScript.
	static void clickJs(TestObject objeto) {
		WebUI.executeJavaScript('arguments[0].click()', [WebUI.findWebElement(objeto, TIMEOUT)])
	}
}
