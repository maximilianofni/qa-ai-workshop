import { Client } from 'ssh2';

export interface Resultado {
  salida: string;
  codigo: number | null;
}

/**
 * Ejecuta un comando en el servidor de analíticas por SSH (como en PuTTY).
 * Con `sudo: true` la contraseña se pasa por stdin con `sudo -S`, así no queda
 * visible en la línea de comandos del servidor.
 */
export function ejecutar(comando: string, { sudo = false } = {}): Promise<Resultado> {
  const password = process.env.AS_PASSWORD!;
  const conexion = new Client();

  return new Promise((resolve, reject) => {
    conexion
      .on('ready', () => {
        const cmd = sudo ? `sudo -S -p '' ${comando}` : comando;
        conexion.exec(cmd, (error, stream) => {
          if (error) return reject(error);
          let salida = '';
          stream.on('data', (d: Buffer) => (salida += d));
          stream.stderr.on('data', (d: Buffer) => (salida += d));
          stream.on('close', (codigo: number | null) => {
            conexion.end();
            resolve({ salida, codigo });
          });
          if (sudo) stream.write(`${password}\n`);
        });
      })
      .on('error', reject)
      .connect({
        host: process.env.AS_HOST,
        username: process.env.AS_USER,
        password,
        readyTimeout: 20_000,
      });
  });
}
