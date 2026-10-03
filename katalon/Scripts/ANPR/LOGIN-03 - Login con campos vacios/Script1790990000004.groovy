import anpr.Anpr
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

Anpr.abrir('login.php')

// Click en Login sin completar usuario ni contraseña
WebUI.click(Anpr.css('button.login-submit'))

Anpr.verificarError('Debe ingresar usuario y contraseña.')
Anpr.esperarUrl(/login\.php/)
Anpr.verificarTitulo('Login - ANPR - UltraIP')

WebUI.closeBrowser()
