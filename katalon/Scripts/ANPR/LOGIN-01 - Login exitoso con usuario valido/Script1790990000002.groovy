import anpr.Anpr
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

Anpr.login(Anpr.usuario(), Anpr.password())

Anpr.esperarUrl(/index\.php/)
Anpr.verificarTitulo('Panel de control - ANPR - UltraIP')
WebUI.verifyElementText(Anpr.css('a.user'), Anpr.usuario())

// Pausa de 2 segundos para ver el Panel de control
WebUI.delay(2)

WebUI.closeBrowser()
