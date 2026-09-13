#!/usr/bin/env bash
#
# Backup de la base de Vita — roles, schema y datos.
#
#   ./scripts/backup.sh              # backup real
#   ./scripts/backup.sh --dry-run    # muestra qué haría, sin bajar nada
#
# Produce tres archivos:
#   · roles   — la configuración de roles del cluster
#   · schema  — tablas, vistas, funciones, políticas RLS, triggers
#   · datos   — el contenido (⚠️ datos personales: mails, mensajes, ánimo)
#
# Se puede cambiar con:  DESTINO=/otra/ruta ./scripts/backup.sh
#
# ── POR QUÉ NO USA `supabase db dump` DIRECTO (13/09/2026) ───────────────────
#
# 🔴 `supabase db dump` **siempre levanta pg_dump adentro de un contenedor**, y
# no tiene ningún flag para evitarlo. En una máquina sin Docker muere en el paso
# 1/3 con "failed to run docker" — que es exactamente lo que pasó la primera vez
# que se intentó correr esto en serio.
#
# La salida es `--dry-run`: el CLI **imprime el script de pg_dump que ejecutaría**
# en vez de ejecutarlo. Ese script se corre acá con un pg_dump nativo. Ventajas:
#   · no hace falta Docker;
#   · los flags los sigue definiendo Supabase (exclusiones de schemas internos,
#     el pipeline de `sed`), así que si ellos los cambian, esto los hereda;
#   · **no hay que guardar ninguna contraseña**: el CLI acuña un rol temporal
#     (`cli_login_postgres`) con vencimiento rodante en cada invocación.
#
# ⚠️ POR ESO EL SCRIPT SE GENERA Y SE EJECUTA EN EL ACTO, y nunca se guarda:
# un script capturado hace cinco minutos ya falla con "password authentication
# failed" — verificado. El `rolvaliduntil` del rol se corre en cada llamada.
#
# ⚠️ Y por eso mismo el script generado tiene una contraseña adentro: se escribe
# en un temporal con permisos 600 que se borra al salir, y NUNCA se imprime.
# 📌 Cuidado con `--dry-run` del CLI a mano en una terminal: imprime esa
# contraseña en pantalla. Ya pasó dos veces en este proyecto.

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

PROYECTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FECHA="$(date +%Y-%m-%d-%H%M)"
DESTINO="${DESTINO:-$HOME/vita-backups}/$FECHA"

# 🔴 GUARDA: un backup dentro del repo terminaría en git, y el archivo de datos
# tiene mails, mensajes y registros de ánimo de personas reales. Si el destino
# cae adentro del proyecto, se corta antes de escribir nada.
case "$(cd "$(dirname "$DESTINO")" 2>/dev/null && pwd || echo "$DESTINO")" in
  "$PROYECTO_DIR"*)
    echo "✋ El destino ($DESTINO) está adentro del repo."
    echo "   El archivo de datos tiene información personal y no puede ir a git."
    exit 1
    ;;
esac

# ── pg_dump nativo ───────────────────────────────────────────────────────────
# `libpq` de Homebrew es keg-only: no se enlaza al PATH para no chocar con una
# instalación de PostgreSQL. Por eso se descubre el prefijo en vez de asumirlo
# (en Apple Silicon es /opt/homebrew, en Intel /usr/local).
PG_BIN=""
if command -v pg_dump >/dev/null 2>&1 && command -v pg_dumpall >/dev/null 2>&1; then
  PG_BIN="$(dirname "$(command -v pg_dump)")"
elif command -v brew >/dev/null 2>&1 && P="$(brew --prefix libpq 2>/dev/null)" && [[ -x "$P/bin/pg_dump" ]]; then
  PG_BIN="$P/bin"
fi

if [[ -z "$PG_BIN" ]]; then
  echo "🔴 No hay pg_dump. Instalalo con:"
  echo "     brew install libpq"
  echo "   (es keg-only; este script encuentra solo el binario, no hace falta tocar el PATH)"
  exit 1
fi
export PATH="$PG_BIN:$PATH"

echo "Backup de Vita"
echo "  destino: $DESTINO"
echo "  pg_dump: $(pg_dump --version 2>/dev/null | head -1) — $PG_BIN"
$DRY_RUN && echo "  MODO PRUEBA: no se escribe nada"
echo

if $DRY_RUN; then
  echo "Haría esto:"
  echo "  mkdir -p $DESTINO"
  echo "  supabase db dump --linked --role-only            --dry-run | bash  > roles.sql"
  echo "  supabase db dump --linked                        --dry-run | bash  > schema.sql"
  echo "  supabase db dump --linked --data-only --use-copy --dry-run | bash  > datos.sql"
  echo "  chmod 600 $DESTINO/*.sql"
  exit 0
fi

mkdir -p "$DESTINO"

# El temporal donde vive el script generado, con su contraseña adentro.
TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

# Genera el script del CLI y lo ejecuta en el acto, volcando a $2.
volcar() {
  local flags="$1" salida="$2" gen="$TMP/gen.sh"
  # shellcheck disable=SC2086
  npx supabase db dump --linked $flags --dry-run 2>/dev/null \
    | grep -v '^npm notice' \
    | sed -n '/^#!/,$p' > "$gen"
  chmod 600 "$gen"
  # Un script vacío significa que el CLI falló (sesión vencida, red, etc.).
  # Sin este chequeo, `bash` de un archivo vacío sale 0 y deja un dump vacío.
  if [[ ! -s "$gen" ]]; then
    echo "🔴 El CLI no devolvió el script de volcado. ¿Sigue linkeado el proyecto?"
    echo "   Probá:  npx supabase projects list"
    exit 1
  fi
  bash "$gen" > "$salida"
  rm -f "$gen"
}

echo "1/3 roles…";  volcar "--role-only"            "$DESTINO/roles.sql"
echo "2/3 schema…"; volcar ""                       "$DESTINO/schema.sql"
echo "3/3 datos…";  volcar "--data-only --use-copy" "$DESTINO/datos.sql"

# Solo el dueño puede leerlos: adentro hay datos personales.
chmod 600 "$DESTINO"/*.sql

# ── Verificación ─────────────────────────────────────────────────────────────
# 🔴 Un backup que no se verifica no es un backup: un dump vacío o truncado pesa
# poco y se ve igual de bien en un listado.
#
# ⚠️ Los umbrales son POR ARCHIVO y no uno solo para los tres. La versión
# anterior usaba 1000 bytes para todos, y `roles.sql` pesa legítimamente ~300:
# el pipeline de `sed` de Supabase comenta todos los roles de plataforma, así
# que lo único que sobrevive es la configuración no-default (tres `ALTER ROLE
# ... SET statement_timeout`). Ese chequeo habría cantado falla sobre un backup
# correcto — medido el 13/09/2026.
echo
falla=false

verificar_tamano() {
  local f="$1" minimo="$2" ruta="$DESTINO/$1.sql"
  local bytes; bytes=$(wc -c < "$ruta" | tr -d ' ')
  if [[ "$bytes" -lt "$minimo" ]]; then
    echo "⚠️  $f.sql pesa $bytes bytes (mínimo esperado: $minimo) — revisalo"
    falla=true
  else
    printf '✅ %-7s %s\n' "$f" "$(du -h "$ruta" | cut -f1)"
  fi
}

verificar_tamano roles     200
verificar_tamano schema  20000
verificar_tamano datos   10000

# Roles: que tenga sentencias de verdad y no solo los `SET` de encabezado.
# Es un chequeo de CONTENIDO y no de tamaño, justamente porque el archivo es
# chico por diseño.
if ! grep -qE '^(CREATE|ALTER|GRANT) ' "$DESTINO/roles.sql"; then
  echo "⚠️  roles.sql no tiene ninguna sentencia CREATE/ALTER/GRANT"
  falla=true
fi

# 🔴 Las tablas se buscan CON COMILLAS. El dump usa `--quote-all-identifier`,
# así que emite `COPY "public"."bookings"` y el literal `public.bookings` no
# aparece nunca. La versión anterior buscaba sin comillas: habría avisado
# "falta bookings en los datos" sobre un backup perfectamente bueno y habría
# salido con código 1 — medido el 13/09/2026.
for tabla in bookings profiles messages; do
  grep -q "\"public\".\"$tabla\"" "$DESTINO/datos.sql" \
    || { echo "⚠️  falta $tabla en los datos"; falla=true; }
done

# Y que el schema traiga las tablas, no solo los `SET`.
grep -q 'CREATE TABLE' "$DESTINO/schema.sql" \
  || { echo "⚠️  schema.sql no tiene ningún CREATE TABLE"; falla=true; }

echo
if $falla; then
  echo "🔴 El backup terminó CON AVISOS. No lo des por bueno sin mirar."
  exit 1
fi
echo "Backup completo en $DESTINO"
echo
echo "Para restaurar (⚠️ sobre una base VACÍA, nunca sobre una con datos):"
echo "  psql <conexión> -f $DESTINO/roles.sql"
echo "  psql <conexión> -f $DESTINO/schema.sql"
echo "  psql <conexión> -f $DESTINO/datos.sql"
echo
echo "📌 psql viene con libpq, en $PG_BIN"
