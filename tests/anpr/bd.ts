import { Client, types } from 'pg';

/** Consultas a la base de datos de ANPR (PostgreSQL), para verificar lo que se guardó */

/** Ejecuta la consulta en una conexión de solo lectura: el test nunca modifica la base */
async function consultar<T>(sql: string, parametros: unknown[] = []): Promise<T[]> {
  const cliente = new Client({
    host: process.env.ANPR_DB_HOST,
    port: Number(process.env.ANPR_DB_PORT ?? 5432),
    database: process.env.ANPR_DB_NAME ?? 'ANPR',
    user: process.env.ANPR_DB_USER,
    password: process.env.ANPR_DB_PASSWORD,
    connectionTimeoutMillis: 10_000,
    // Las fechas se dejan como texto, tal como las guarda la base (sin zona horaria)
    types: {
      getTypeParser: (oid, formato) => (oid === 1114 ? (v: string) => v : types.getTypeParser(oid, formato)),
    },
  });
  await cliente.connect();
  try {
    await cliente.query('SET default_transaction_read_only = on');
    return (await cliente.query(sql, parametros)).rows as T[];
  } finally {
    await cliente.end();
  }
}

export const hayBd = () => !!process.env.ANPR_DB_HOST && !!process.env.ANPR_DB_USER;

/** Id de la última captura guardada: las nuevas tienen un id mayor */
export async function ultimaCaptura(): Promise<number> {
  const [fila] = await consultar<{ id: string | null }>('SELECT max("idCapture") AS id FROM "ANPR"."Capture"');
  return Number(fila.id ?? 0);
}

export interface CapturaEnBd {
  id: number;
  patente: string;
  formato: string;
  camara: string;
  lat: number;
  lon: number;
  fecha: string;
  registro: string;
  tiposDeAlarma: string[];
}

/** Capturas guardadas después de `desdeId` de esas patentes, en orden */
export async function capturasEnBd(desdeId: number, patentes: string[]): Promise<CapturaEnBd[]> {
  const filas = await consultar<CapturaEnBd & { id: string }>(
    `SELECT c."idCapture" AS id, c."plateString" AS patente, f.name AS formato, cam.name AS camara,
            c.lat, c.lon, c."dateTime" AS fecha, c."registrationDateTime" AS registro,
            ARRAY(SELECT t.name FROM "ANPR"."AlarmType" t
                   WHERE t."idAlarmType" = ANY(c."idAlarmTypes")) AS "tiposDeAlarma"
       FROM "ANPR"."Capture" c
       JOIN "ANPR"."PlateFormat" f USING ("idPlateFormat")
       JOIN "ANPR"."Camera" cam USING ("idCamera")
      WHERE c."idCapture" > $1 AND c."plateString" = ANY($2)
      ORDER BY c."idCapture"`,
    [desdeId, patentes]
  );
  return filas.map((f) => ({ ...f, id: Number(f.id) }));
}

export interface AlarmaEnBd {
  patente: string;
  idCaptura: number;
  tipo: string;
  lista: string;
  estado: string;
}

/** Alarma (el id es el mismo que muestra el widget Alarmas) con su captura, lista y estado actual */
export async function alarmaEnBd(id: number): Promise<AlarmaEnBd | undefined> {
  const [fila] = await consultar<AlarmaEnBd & { idCaptura: string }>(
    `SELECT c."plateString" AS patente, e."idCapture" AS "idCaptura", t.name AS tipo, l.name AS lista, s.name AS estado
       FROM "ANPR"."StationAlarmEvent" e
       JOIN "ANPR"."Capture" c USING ("idCapture")
       JOIN "ANPR"."AlarmType" t USING ("idAlarmType")
       JOIN "ANPR"."PlateList" l USING ("idPlateList")
       JOIN "ANPR"."AlarmState" s USING ("idAlarmState")
      WHERE e."idStationAlarmEvent" = $1`,
    [id]
  );
  return fila && { ...fila, idCaptura: Number(fila.idCaptura) };
}

export interface EstadoDeAlarma {
  estado: string;
  observacion: string;
  accion: string | null;
}

/** Historial de estados de la alarma, del más viejo al más nuevo */
export function historialDeAlarma(id: number): Promise<EstadoDeAlarma[]> {
  return consultar<EstadoDeAlarma>(
    `SELECT s.name AS estado, h.observations AS observacion, a.name AS accion
       FROM "ANPR"."StationAlarmEventState" h
       JOIN "ANPR"."AlarmState" s USING ("idAlarmState")
       LEFT JOIN "ANPR"."UserAction" a USING ("idUserAction")
      WHERE h."idStationAlarmEvent" = $1
      ORDER BY h."idStationAlarmEventState"`,
    [id]
  );
}

/** Patentes activas (no dadas de baja) con ese texto: la baja de ANPR solo las marca como borradas */
export async function patentesActivas(patente: string): Promise<number[]> {
  const filas = await consultar<{ id: string }>(
    'SELECT "idPlate" AS id FROM "ANPR"."Plate" WHERE "plateString" = $1 AND NOT deleted',
    [patente]
  );
  return filas.map((f) => Number(f.id));
}
