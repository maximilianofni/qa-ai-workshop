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
}
'@
$A = [Windows.Automation.AutomationElement]
$Todo = [Windows.Automation.TreeScope]::Descendants
# Ventana visible de la aplicación (algunas, como el Configurator, tienen además ventanas ocultas)
function Ventana { $A::RootElement.FindAll([Windows.Automation.TreeScope]::Children,
    (New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty, [int]$env:VMS_PID))) |
  Where-Object { -not $_.Current.BoundingRectangle.IsEmpty } | Select-Object -First 1 }
function Controles { $v = Ventana; if ($v) { $v.FindAll($Todo, [Windows.Automation.Condition]::TrueCondition) } }
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
    return salida ? salida.split(/\r?\n/) : [];
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
      `$r = (Ventana).Current.BoundingRectangle
       $bmp = New-Object Drawing.Bitmap ([int]$r.Width), ([int]$r.Height)
       [Drawing.Graphics]::FromImage($bmp).CopyFromScreen([int]$r.X, [int]$r.Y, 0, 0, $bmp.Size)
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
    return this.ejecutar(
      `Add-Type -AssemblyName System.Runtime.WindowsRuntime
       $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
       $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
       $null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
       $asTask = [WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
         $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
         $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' } | Select-Object -First 1
       function Esperar($op, [Type]$tipo) {
         $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait() | Out-Null; $t.Result }

       # Captura de la ventana al doble de tamaño: el OCR lee mejor la letra chica
       $r = (Ventana).Current.BoundingRectangle
       $bmp = New-Object Drawing.Bitmap ([int]$r.Width), ([int]$r.Height)
       [Drawing.Graphics]::FromImage($bmp).CopyFromScreen([int]$r.X, [int]$r.Y, 0, 0, $bmp.Size)
       $doble = New-Object Drawing.Bitmap $bmp, ([int]$r.Width * 2), ([int]$r.Height * 2)
       $ms = New-Object IO.MemoryStream; $doble.Save($ms, [Drawing.Imaging.ImageFormat]::Bmp)

       $stream = [IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
       $decoder = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
       $imagen = Esperar ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
       $ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('es-ES'))
       (Esperar ($ocr.RecognizeAsync($imagen)) ([Windows.Media.Ocr.OcrResult])).Lines | ForEach-Object { $_.Text }`
    );
  }

  /** Cierra la aplicación como el botón X; si no termina en 15 segundos, la fuerza */
  cerrar() {
    return this.ejecutar(
      `$p = Get-Process -Id ([int]$env:VMS_PID) -ErrorAction SilentlyContinue
       if ($p) { $p.CloseMainWindow() | Out-Null; if (-not $p.WaitForExit(15000)) { $p.Kill() } }`
    );
  }
}
