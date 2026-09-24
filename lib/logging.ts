// Logger de la app: consola + memoria, y los ERRORES además salen del teléfono.
//
// 🔴 23/09/2026 (punto 4 de docs/investigacion-producto-2026-09-23.md). Hasta
// hoy todo quedaba en la consola del dispositivo: un fallo de entrada, de pago
// o de sala en el teléfono de otra persona no llegaba a nadie. Ahora `logError`
// anota un evento `error_app` en `analytics_events`, que ya acepta escrituras
// con y sin sesión y cuyas políticas ya están auditadas: no hizo falta una
// tabla ni un servicio nuevo.
//
// ⚠️ Qué NO viaja: el texto que escribió la persona, mails, tokens ni números
// largos (ver `limpiar`). Viaja el contexto que elige quien llama ("Sala: no se
// pudo preparar la videollamada"), el código y el mensaje técnico recortado,
// plataforma y versión. `analytics_events` no es un lugar para contenido.
//
// Tope por apertura de la app y sin repetir el mismo error en un minuto: un
// fallo en un loop no puede llenar la tabla.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registrarEvento } from '@/lib/supabase';

const MAX_ENTRIES = 200;
const logBuffer: string[] = [];

const TOPE_POR_APERTURA = 30;
const VENTANA_REPETIDO_MS = 60_000;
let enviados = 0;
const ultimoEnvio = new Map<string, number>();

function formatEntry(level: string, message: string, error?: unknown): string {
  const timestamp = new Date().toISOString();
  const detail =
    error instanceof Error ? `\n  ${error.stack ?? error.message}` : '';
  return `[${timestamp}] [${level}] ${message}${detail}`;
}

function push(entry: string) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_ENTRIES) logBuffer.shift();
}

/** Saca de un texto técnico lo que podría identificar a alguien o servir de
 *  credencial. Los mensajes de Postgres traen valores ("Key (email)=(…)"). */
export function limpiar(texto: string, max = 300): string {
  return texto
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[mail]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?/g, '[token]')
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1?[…]')
    .replace(/\d{6,}/g, '[número]')
    .slice(0, max);
}

function describir(error: unknown): { codigo: string | null; mensaje: string } {
  if (error == null) return { codigo: null, mensaje: '' };
  if (typeof error === 'string') return { codigo: null, mensaje: error };
  const e = error as { code?: unknown; status?: unknown; message?: unknown };
  const codigo = e.code ?? e.status;
  return {
    codigo: codigo == null ? null : String(codigo),
    mensaje: typeof e.message === 'string' ? e.message : String(error),
  };
}

function enviar(contexto: string, error: unknown, fatal = false) {
  const { codigo, mensaje } = describir(error);
  const clave = `${contexto}|${mensaje}`;
  const ahora = Date.now();
  if (enviados >= TOPE_POR_APERTURA) return;
  if (ahora - (ultimoEnvio.get(clave) ?? 0) < VENTANA_REPETIDO_MS) return;
  enviados++;
  ultimoEnvio.set(clave, ahora);

  registrarEvento('error_app', {
    contexto: limpiar(contexto, 120),
    codigo: codigo ? limpiar(codigo, 40) : null,
    mensaje: limpiar(mensaje),
    fatal,
    plataforma: Platform.OS,
    version_so: String(Platform.Version),
    version_app: Constants.expoConfig?.version ?? null,
  }).catch(() => {});
}

export async function logError(message: string, error?: unknown) {
  const entry = formatEntry('ERROR', message, error);
  push(entry);
  console.error(entry);
  enviar(message, error);
}

export async function logWarn(message: string) {
  const entry = formatEntry('WARN', message);
  push(entry);
  console.warn(entry);
}

export async function logInfo(message: string) {
  const entry = formatEntry('INFO', message);
  push(entry);
  console.log(entry);
}

export async function readLog(): Promise<string> {
  return logBuffer.join('\n');
}

export async function clearLog() {
  logBuffer.length = 0;
}

/**
 * Los errores que nadie atrapó (una pantalla que revienta al renderizar, una
 * excepción suelta). Se instala una vez desde `app/_layout.tsx` y encadena el
 * handler que ya estaba, así que la pantalla roja en desarrollo y el cierre en
 * producción siguen igual: esto solo agrega el aviso.
 */
export function instalarCapturaGlobal() {
  const EU = (globalThis as { ErrorUtils?: {
    getGlobalHandler: () => (e: unknown, fatal?: boolean) => void;
    setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void;
  } }).ErrorUtils;
  if (!EU) return;
  const anterior = EU.getGlobalHandler();
  EU.setGlobalHandler((error, fatal) => {
    try { enviar('Error sin atrapar', error, !!fatal); } catch { /* nunca tapa el original */ }
    anterior(error, fatal);
  });
}
