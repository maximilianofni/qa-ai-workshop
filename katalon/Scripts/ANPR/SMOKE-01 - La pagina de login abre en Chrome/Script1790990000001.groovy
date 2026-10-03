import anpr.Anpr
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

Anpr.abrir('login.php')

Anpr.verificarTitulo('Login - ANPR - UltraIP')
WebUI.verifyElementVisible(Anpr.css('input[name="userName"]'))
WebUI.verifyElementVisible(Anpr.css('input[name="password"]'))
WebUI.verifyElementVisible(Anpr.css('button.login-submit'))

WebUI.closeBrowser()
