import { execFile } from 'child_process';

/**
 * Maneja las aplicaciones de escritorio de VMS (WinForms) con UI Automation de Windows,
 * desde PowerShell. Los controles de VMS son personalizados: no tienen ids fijos ni
 * acciones de accesibilidad, así que se buscan por el texto visible y se manejan con
 * mensajes de Windows (escribir texto y hacer clic), como lo haría una persona.
 */

const PRELUDIO = `
$ErrorActionPreference = 'Stop'
# Salida en UTF-8 para que lleguen bien los acentos ("INICIAR SESIÓN")
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, int m, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, int m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, int f, IntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, IntPtr e);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int SendMessage(IntPtr h, int m, int w, System.Text.StringBuilder l);
  [DllImport("user32.dll")] public static extern int SendMessage(IntPtr h, int m, int w, int l);
  [DllImport("user32.dll")] public static extern int SendMessage(IntPtr h, int m, int w, ref R l);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref P p);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct P { public int X, Y; }
}
'@
$A = [Windows.Automation.AutomationElement]
$Todo = [Windows.Automation.TreeScope]::Descendants
# Ventana visible de la aplicación (algunas, como el Configurator, tienen además ventanas ocultas)
# Si hay varias (por ejemplo un modal aparte), la más grande: la ventana principal
function Ventana { $A::RootElement.FindAll([Windows.Automation.TreeScope]::Children,
    (New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty, [int]$env:VMS_PID))) |
  Where-Object { -not $_.Current.BoundingRectangle.IsEmpty -and $_.Current.BoundingRectangle.Width -gt 0 } |
  Sort-Object { $_.Current.BoundingRectangle.Width * $_.Current.BoundingRectangle.Height } -Descending |
  Select-Object -First 1 }
function Controles { $v = Ventana; if ($v) { $v.FindAll($Todo, [Windows.Automation.Condition]::TrueCondition) } }
# Pasa la ventana al frente: el botón de login de VMS no responde si la ventana no está activa.
# Windows no deja hacerlo si el usuario está usando otra ventana (por ejemplo el navegador con
# Jenkins): se toca Alt (como en Alt+Tab) y se toma prestado el permiso de la ventana activa
function Activar {
  $h = [IntPtr](Ventana).Current.NativeWindowHandle
  for ($i = 0; $i -lt 10 -and [W]::GetForegroundWindow() -ne $h; $i++) {
    $activa = [W]::GetWindowThreadProcessId([W]::GetForegroundWindow(), [IntPtr]::Zero)
    $propio = [W]::GetCurrentThreadId()
    [W]::AttachThreadInput($propio, $activa, $true) | Out-Null
    [W]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [IntPtr]::Zero)
    [W]::BringWindowToTop($h) | Out-Null
    [W]::SetForegroundWindow($h) | Out-Null
    [W]::AttachThreadInput($propio, $activa, $false) | Out-Null
    Start-Sleep -Milliseconds 200
  }
}
# Imagen de la ventana pedida a Windows (PrintWindow) y no copiada de la pantalla: sale bien
# aunque haya otra ventana encima, por ejemplo el navegador con Jenkins
function Capturar {
  $v = Ventana; $r = $v.Current.BoundingRectangle
  $bmp = New-Object Drawing.Bitmap ([int]$r.Width), ([int]$r.Height)
  $g = [Drawing.Graphics]::FromImage($bmp); $hdc = $g.GetHdc()
  [W]::PrintWindow([IntPtr]$v.Current.NativeWindowHandle, $hdc, 2) | Out-Null  # 2 = PW_RENDERFULLCONTENT
  $g.ReleaseHdc($hdc); $g.Dispose()
  $bmp
}
# Lo que se ve en la pantalla en la zona de la ventana: a diferencia de Capturar, incluye los menús,
# las listas desplegables y los diálogos que se abren encima
function CapturarPantalla {
  $r = (Ventana).Current.BoundingRectangle
  $bmp = New-Object Drawing.Bitmap ([int]$r.Width), ([int]$r.Height)
  $g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen([int]$r.X, [int]$r.Y, 0, 0, $bmp.Size); $g.Dispose()
  $bmp
}
# Líneas que lee el OCR de Windows (español) en la imagen, ampliada al doble: lee mejor la letra chica
function Ocr($bmp) {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
  $null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
  $asTask = [WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' } | Select-Object -First 1
  function Esperar($op, [Type]$tipo) {
    $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait() | Out-Null; $t.Result }

  $doble = New-Object Drawing.Bitmap $bmp, ($bmp.Width * 2), ($bmp.Height * 2)
  $ms = New-Object IO.MemoryStream; $doble.Save($ms, [Drawing.Imaging.ImageFormat]::Bmp)
  $stream = [IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
  $decoder = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $imagen = Esperar ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('es-ES'))
  (Esperar ($ocr.RecognizeAsync($imagen)) ([Windows.Media.Ocr.OcrResult])).Lines
}
# Clic con el mouse de verdad (mueve el cursor) en un punto de la pantalla: algunos controles,
# como el menú o el árbol de cámaras, no responden a los mensajes de Windows
function ClicReal([int]$x, [int]$y, [int]$veces = 1) {
  Activar
  [W]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 150
  for ($i = 0; $i -lt $veces; $i++) {
    [W]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 40   # botón abajo
    [W]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero); Start-Sleep -Milliseconds 60   # botón arriba
  }
}
function ClicEnControl($e, [int]$veces = 1) {
  $r = $e.Current.BoundingRectangle
  ClicReal ([int]($r.X + $r.Width / 2)) ([int]($r.Y + $r.Height / 2)) $veces
}
# Campos de texto que se ven (los ocultos no tienen posición en la pantalla)
function CamposVisibles { Controles | Where-Object { $_.Current.ClassName -like 'WindowsForms10.EDIT*' -and -not $_.Current.BoundingRectangle.IsEmpty } }
# Lista desplegable abierta (los combos de VMS abren un LISTBOX de Windows)
function ListaAbierta {
  $c = New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, 'WindowsForms10.LISTBOX.app.0.83a9e6_r8_ad1')
  $l = (Ventana).FindFirst($Todo, $c)
  if (-not $l) { throw 'No hay una lista desplegable abierta' }
  $l
}
function OpcionesDeLista($l) {
  $h = [IntPtr]$l.Current.NativeWindowHandle
  $n = [W]::SendMessage($h, 0x18B, 0, 0)   # LB_GETCOUNT
  for ($i = 0; $i -lt $n; $i++) {
    $sb = New-Object Text.StringBuilder 512; [W]::SendMessage($h, 0x189, $i, $sb) | Out-Null; $sb.ToString() }   # LB_GETTEXT
}
`;

function powershell(script: string, variables: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PRELUDIO + script],
      // Los valores van por variables de entorno: así no hay problemas con comillas ni acentos
      { env: { ...process.env, ...variables }, timeout: 60_000 },
      (error, stdout, stderr) => (error ? reject(new Error(stderr || error.message)) : resolve(stdout.trim()))
    );
  });
}

export interface TextoEnPantalla {
  texto: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export class AppEscritorio {
  private constructor(readonly pid: number) {}

  /** Abre el ejecutable (por ejemplo XDRControlCenter.exe) desde la carpeta de VMS */
  static async abrir(exe: string): Promise<AppEscritorio> {
    const pid = await powershell(
      `(Start-Process (Join-Path $env:VMS_DIR $env:EXE) -WorkingDirectory $env:VMS_DIR -PassThru).Id`,
      { EXE: exe }
    );
    return new AppEscritorio(Number(pid));
  }

  private ejecutar(script: string, variables: Record<string, string> = {}) {
    return powershell(script, { VMS_PID: String(this.pid), ...variables });
  }

  /** Título de la ventana principal ('' si todavía no apareció) */
  titulo(): Promise<string> {
    return this.ejecutar(`$v = Ventana; if ($v) { $v.Current.Name }`);
  }

  /** Todos los textos visibles de la ventana, como los vería el usuario */
  async textos(): Promise<string[]> {
    const salida = await this.ejecutar(`Controles | ForEach-Object { $_.Current.Name } | Where-Object { $_ }`);
    const textos = salida ? salida.split(/\r?\n/) : [];
    // El campo de contraseña del login expone su valor en texto plano: se saca para que no
    // aparezca en los mensajes de error, el reporte ni los logs (va justo después de "Contraseña")
    const i = textos.indexOf('Contraseña');
    if (i >= 0 && textos[i + 1] !== 'Recordar') textos.splice(i + 1, 1);
    return textos;
  }

  /** Escribe en el campo de texto número `indice` de la ventana (0 = el primero) */
  escribir(indice: number, texto: string) {
    return this.ejecutar(
      `$e = @(Controles | Where-Object { $_.Current.ClassName -like 'WindowsForms10.EDIT*' })[[int]$env:INDICE]
       [W]::SendMessage([IntPtr]$e.Current.NativeWindowHandle, 0x0C, [IntPtr]::Zero, $env:TEXTO) | Out-Null`,
      { INDICE: String(indice), TEXTO: texto }
    );
  }

  /** Hace clic en el centro del control que muestra ese texto */
  clic(texto: string) {
    return this.ejecutar(
      `$e = Controles | Where-Object { $_.Current.Name -eq $env:TEXTO } | Select-Object -First 1
       if (-not $e) { throw "No se encontró el control '$env:TEXTO'" }
       Activar
       $r = $e.Current.BoundingRectangle; $h = [IntPtr]$e.Current.NativeWindowHandle
       $pos = [IntPtr](([int]($r.Height / 2) -shl 16) -bor [int]($r.Width / 2))
       [W]::PostMessage($h, 0x201, [IntPtr]1, $pos) | Out-Null
       Start-Sleep -Milliseconds 80
       [W]::PostMessage($h, 0x202, [IntPtr]0, $pos) | Out-Null`,
      { TEXTO: texto }
    );
  }

  /** Captura de la ventana, para adjuntar al reporte */
  async captura(): Promise<Buffer> {
    const base64 = await this.ejecutar(
      `$bmp = Capturar
       $ms = New-Object IO.MemoryStream; $bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
       [Convert]::ToBase64String($ms.ToArray())`
    );
    return Buffer.from(base64, 'base64');
  }

  /**
   * Lee con OCR (el reconocimiento de texto que trae Windows) lo que se ve en la ventana.
   * Hace falta para los mensajes que la app dibuja sin exponerlos a la accesibilidad,
   * como los errores de login ("La contraseña es incorrecta").
   */
  async leerPantalla(): Promise<string> {
    return this.ejecutar(`Ocr (Capturar) | ForEach-Object { $_.Text }`);
  }

  /**
   * Textos que lee el OCR en la pantalla, con su posición (en píxeles de la pantalla). Sirve para
   * hacer clic en lo que la app dibuja sin exponerlo, como el menú o el árbol de cámaras.
   * Con `soloVentana` lee la imagen de la ventana en vez de la pantalla: no ve los menús ni las
   * listas que se abren encima, pero lee bien aunque otra aplicación tape la ventana.
   */
  async textosConPosicion({ soloVentana = false } = {}): Promise<TextoEnPantalla[]> {
    const salida = await this.ejecutar(
      `$r = (Ventana).Current.BoundingRectangle
       Ocr (${soloVentana ? 'Capturar' : 'CapturarPantalla'}) | ForEach-Object {
         $p = $_.Words | ForEach-Object { $_.BoundingRect }
         $x1 = ($p | ForEach-Object { $_.X } | Measure-Object -Minimum).Minimum
         $y1 = ($p | ForEach-Object { $_.Y } | Measure-Object -Minimum).Minimum
         $x2 = ($p | ForEach-Object { $_.X + $_.Width } | Measure-Object -Maximum).Maximum
         $y2 = ($p | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum
         # La imagen del OCR está al doble de tamaño
         '{0}|{1}|{2}|{3}|{4}' -f $_.Text, [int]($r.X + $x1 / 2), [int]($r.Y + $y1 / 2), [int](($x2 - $x1) / 2), [int](($y2 - $y1) / 2)
       }`
    );
    return salida
      .split(/\r?\n/)
      .filter(Boolean)
      .map((linea) => {
        const [texto, x, y, ancho, alto] = linea.split('|');
        return { texto, x: Number(x), y: Number(y), ancho: Number(ancho), alto: Number(alto) };
      });
  }

  /** Busca con OCR el texto en pantalla; falla si no aparece */
  async buscarTexto(texto: string): Promise<TextoEnPantalla> {
    const encontrado = (await this.textosConPosicion()).find((t) => t.texto.includes(texto));
    if (!encontrado) throw new Error(`No se ve "${texto}" en la pantalla`);
    return encontrado;
  }

  /** Clic (o doble clic) con el mouse de verdad en un punto de la pantalla */
  clicEn(x: number, y: number, veces = 1) {
    return this.ejecutar(`ClicReal ${Math.round(x)} ${Math.round(y)} ${veces}`);
  }

  /** Clic con el mouse de verdad en un punto relativo a la esquina de la ventana */
  clicEnVentana(dx: number, dy: number) {
    return this.ejecutar(`$r = (Ventana).Current.BoundingRectangle; ClicReal ([int]$r.X + ${dx}) ([int]$r.Y + ${dy})`);
  }

  /** Clic con el mouse de verdad en el texto que se ve en pantalla (lo busca con OCR) */
  async clicEnTexto(texto: string, veces = 1) {
    const t = await this.buscarTexto(texto);
    await this.clicEn(t.x + t.ancho / 2, t.y + t.alto / 2, veces);
  }

  /** Clic con el mouse de verdad en el control con ese texto; si hay varios, el de más arriba */
  clicReal(texto: string) {
    return this.ejecutar(
      `$e = Controles | Where-Object { $_.Current.Name -eq $env:TEXTO } |
         Sort-Object { $_.Current.BoundingRectangle.Y } | Select-Object -First 1
       if (-not $e) { throw "No se encontró el control '$env:TEXTO'" }
       ClicEnControl $e`,
      { TEXTO: texto }
    );
  }

  /** Sistema elegido en la pantalla de login: el texto que sigue a la etiqueta "Sistema" */
  async sistema(): Promise<string> {
    const textos = await this.textos();
    return textos.includes('Sistema') ? textos[textos.indexOf('Sistema') + 1] : '';
  }

  /**
   * En la pantalla de login, elige el sistema que empieza con ese texto si no es el que está.
   * Al abrir, la app muestra un sistema y enseguida lo cambia por el último usado: se espera a que
   * se quede quieto antes de decidir.
   */
  async elegirSistema(sistema: string) {
    let actual = '';
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 700));
      const ahora = await this.sistema();
      if (ahora && ahora === actual) break;
      actual = ahora;
    }
    if (!actual.startsWith(sistema)) await this.elegirEnCombo(actual, sistema);
  }

  /** Abre el combo que muestra `actual` y elige `opcion` de su lista (o la que empieza con ese texto) */
  elegirEnCombo(actual: string, opcion: string) {
    return this.ejecutar(
      `$e = Controles | Where-Object { $_.Current.Name -eq $env:ACTUAL } | Select-Object -First 1
       if (-not $e) { throw "No se encontró el combo '$env:ACTUAL'" }
       # Clic sobre la flecha, a la derecha del texto. La lista puede tardar en abrirse: se espera hasta
       # 3 segundos y, si no aparece, se vuelve a hacer clic (una vez)
       $r = $e.Current.BoundingRectangle
       $c = New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, 'WindowsForms10.LISTBOX.app.0.83a9e6_r8_ad1')
       $l = $null
       for ($intento = 0; $intento -lt 2 -and -not $l; $intento++) {
         ClicReal ([int]($r.X + $r.Width + 12)) ([int]($r.Y + $r.Height / 2))
         for ($i = 0; $i -lt 10 -and -not $l; $i++) { Start-Sleep -Milliseconds 300; $l = (Ventana).FindFirst($Todo, $c) }
       }
       if (-not $l) { throw 'No se abrió la lista desplegable' }
       Start-Sleep -Milliseconds 300
       $h = [IntPtr]$l.Current.NativeWindowHandle
       # La opción con ese texto o, si no hay, la primera que empieza así ('system 145' → 'system 145(testing)')
       $ops = @(OpcionesDeLista $l); $i = [array]::IndexOf($ops, $env:OPCION)
       if ($i -lt 0) { $i = [array]::FindIndex([string[]]$ops, [Predicate[string]]{ param($o) $o.StartsWith($env:OPCION) }) }
       if ($i -lt 0) { throw "La lista no tiene la opción '$env:OPCION'" }
       $o = New-Object W+R; [W]::SendMessage($h, 0x198, $i, [ref]$o) | Out-Null   # LB_GETITEMRECT
       $p = New-Object W+P; $p.X = [int](($o.Left + $o.Right) / 2); $p.Y = [int](($o.Top + $o.Bottom) / 2)
       [W]::ClientToScreen($h, [ref]$p) | Out-Null
       ClicReal $p.X $p.Y`,
      { ACTUAL: actual, OPCION: opcion }
    );
  }

  /** Campos de texto con su texto y su posición en la pantalla (muchos no tienen nombre) */
  async campos(): Promise<{ texto: string; x: number; y: number }[]> {
    const salida = await this.ejecutar(
      `CamposVisibles | ForEach-Object {
         $r = $_.Current.BoundingRectangle; '{0}|{1}|{2}' -f [int]$r.X, [int]$r.Y, $_.Current.Name }`
    );
    return salida
      .split(/\r?\n/)
      .filter(Boolean)
      .map((linea) => {
        const [x, y, ...texto] = linea.split('|');
        return { x: Number(x), y: Number(y), texto: texto.join('|') };
      });
  }

  /** Escribe en el campo de texto que está en esa posición de la pantalla (sin teclado) */
  escribirEnPosicion(x: number, y: number, texto: string) {
    return this.ejecutar(
      `$e = CamposVisibles | Where-Object {
         [int]$_.Current.BoundingRectangle.X -eq [int]$env:X -and [int]$_.Current.BoundingRectangle.Y -eq [int]$env:Y } |
         Select-Object -First 1
       if (-not $e) { throw "No hay un campo de texto en $env:X,$env:Y" }
       [W]::SendMessage([IntPtr]$e.Current.NativeWindowHandle, 0x0C, [IntPtr]::Zero, $env:TEXTO) | Out-Null`,
      { X: String(x), Y: String(y), TEXTO: texto }
    );
  }

  /**
   * Hace clic en un punto de la pantalla y tipea el texto con el teclado, como una persona (borra
   * antes lo que hubiera). Para los campos que no toman el texto escrito sin teclado.
   */
  tipearEn(x: number, y: number, texto: string) {
    return this.ejecutar(
      `Add-Type -AssemblyName System.Windows.Forms
       ClicReal ([int]$env:X) ([int]$env:Y); Start-Sleep -Milliseconds 300
       [Windows.Forms.SendKeys]::SendWait('^a')
       # SendKeys usa + ^ % ~ ( ) { } [ ] como teclas especiales: se escriben entre llaves
       [Windows.Forms.SendKeys]::SendWait(($env:TEXTO -replace '([+^%~(){}\[\]])', '{$1}'))`,
      { X: String(Math.round(x)), Y: String(Math.round(y)), TEXTO: texto }
    );
  }

  /**
   * Posición en la pantalla de la página web que la app muestra dentro de la ventana (CefSharp, un
   * Chromium embebido). Su contenido no es accesible: se maneja por posición y con el teclado.
   */
  async paginaWeb(): Promise<{ x: number; y: number; ancho: number; alto: number }> {
    const salida = await this.ejecutar(
      `$c = New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, 'Chrome_RenderWidgetHostHWND')
       $w = (Ventana).FindFirst($Todo, $c)
       if (-not $w) { throw 'No hay una página web abierta' }
       $r = $w.Current.BoundingRectangle; '{0} {1} {2} {3}' -f [int]$r.X, [int]$r.Y, [int]$r.Width, [int]$r.Height`
    );
    const [x, y, ancho, alto] = salida.split(' ').map(Number);
    return { x, y, ancho, alto };
  }

  /**
   * Posición en la pantalla del modal con ese título (el control más grande que se llama así, en
   * cualquier ventana de la app), o null si no está abierto
   */
  async modal(titulo: string): Promise<{ x: number; y: number; ancho: number; alto: number } | null> {
    const salida = await this.ejecutar(
      `$c = New-Object Windows.Automation.PropertyCondition($A::NameProperty, $env:TITULO)
       $ws = $A::RootElement.FindAll([Windows.Automation.TreeScope]::Children,
         (New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty, [int]$env:VMS_PID)))
       $m = @($ws | Where-Object { $_.Current.Name -eq $env:TITULO }) + @($ws | ForEach-Object { $_.FindAll($Todo, $c) }) |
         Where-Object { $_ -and -not $_.Current.BoundingRectangle.IsEmpty } |
         Sort-Object { $_.Current.BoundingRectangle.Width * $_.Current.BoundingRectangle.Height } -Descending |
         Select-Object -First 1
       if ($m) { $r = $m.Current.BoundingRectangle; '{0} {1} {2} {3}' -f [int]$r.X, [int]$r.Y, [int]$r.Width, [int]$r.Height }`,
      { TITULO: titulo }
    );
    if (!salida) return null;
    const [x, y, ancho, alto] = salida.split(' ').map(Number);
    return { x, y, ancho, alto };
  }

  /** Aprieta teclas en la app (formato de SendKeys, por ejemplo '{ESC}') */
  tecla(teclas: string) {
    return this.ejecutar(
      `Add-Type -AssemblyName System.Windows.Forms; Activar; [Windows.Forms.SendKeys]::SendWait($env:TECLAS)`,
      { TECLAS: teclas }
    );
  }

  /** Captura de lo que se ve en pantalla en la zona de la ventana (con menús y diálogos) */
  async capturaPantalla(): Promise<Buffer> {
    const base64 = await this.ejecutar(
      `$bmp = CapturarPantalla
       $ms = New-Object IO.MemoryStream; $bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
       [Convert]::ToBase64String($ms.ToArray())`
    );
    return Buffer.from(base64, 'base64');
  }

  /** Cierra la aplicación como el botón X; si no termina en 15 segundos, la fuerza */
  cerrar() {
    return this.ejecutar(
      `$p = Get-Process -Id ([int]$env:VMS_PID) -ErrorAction SilentlyContinue
       if ($p) { $p.CloseMainWindow() | Out-Null; if (-not $p.WaitForExit(15000)) { $p.Kill() } }`
    );
  }
}
