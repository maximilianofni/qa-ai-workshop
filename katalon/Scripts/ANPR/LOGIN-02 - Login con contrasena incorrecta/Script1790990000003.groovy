import anpr.Anpr
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

// Contraseña distinta a la válida del .env
Anpr.login(Anpr.usuario(), Anpr.password() + '-incorrecta')

Anpr.verificarError('Cuenta de usuario inválida. Verifique su usuario y/o contraseña.')
Anpr.esperarUrl(/login\.php/)
Anpr.verificarTitulo('Login - ANPR - UltraIP')

Anpr.verificarSinAccesoAlPanel()

WebUI.closeBrowser()
