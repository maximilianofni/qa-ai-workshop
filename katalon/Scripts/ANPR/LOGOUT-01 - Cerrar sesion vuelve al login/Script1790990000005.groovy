import anpr.Anpr
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

Anpr.login(Anpr.usuario(), Anpr.password())
Anpr.esperarUrl(/index\.php/)

// Pausa de 2 segundos para ver el Panel de control
WebUI.delay(2)

// Abrir el menú del usuario y hacer click en Logout
Anpr.clickJs(Anpr.css('a.user'))
WebUI.waitForElementVisible(Anpr.css('a.logout'), Anpr.TIMEOUT)
Anpr.clickJs(Anpr.css('a.logout'))

Anpr.esperarUrl(/login\.php/)
Anpr.verificarTitulo('Login - ANPR - UltraIP')

Anpr.verificarSinAccesoAlPanel()

WebUI.closeBrowser()
