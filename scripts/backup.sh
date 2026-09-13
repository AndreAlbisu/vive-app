#!/usr/bin/env bash
#
# Backup completo de la base de Vita.
#
# 🔴 POR QUÉ EXISTE. En el plan gratuito de Supabase NO hay backups automáticos:
# si algo se borra, no hay de dónde volver. Y hoy la base tiene pagos reales,
# reservas, conversaciones y registros de ánimo de gente que confió.
#
# Genera TRES archivos, y hacen falta los tres para reconstruir el proyecto:
#   · roles   — los roles del cluster
#   · schema  — tablas, vistas, funciones, políticas RLS, triggers
#   · datos   — el contenido
#
# ⚠️ LO QUE ESTE BACKUP **NO** CUBRE:
#   · los archivos del Storage (videos de presentación, fotos, audios);
#   · los secrets de las edge functions;
#   · la configuración del panel (auth, CAPTCHA, rate limits, crons).
#   Las functions y los scripts SQL sí están, pero porque viven en el repo.
#
# Uso:
#   ./scripts/backup.sh              # hace el backup
#   ./scripts/backup.sh --dry-run    # muestra qué haría, sin tocar nada
#
# Destino por defecto: ~/vita-backups/AAAA-MM-DD-HHMM/
# Se puede cambiar con:  DESTINO=/otra/ruta ./scripts/backup.sh

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

echo "Backup de Vita"
echo "  destino: $DESTINO"
$DRY_RUN && echo "  MODO PRUEBA: no se escribe nada"
echo

if $DRY_RUN; then
  echo "Haría esto:"
  echo "  mkdir -p $DESTINO"
  echo "  npx supabase db dump --linked --role-only            -f $DESTINO/roles.sql"
  echo "  npx supabase db dump --linked                        -f $DESTINO/schema.sql"
  echo "  npx supabase db dump --linked --data-only --use-copy -f $DESTINO/datos.sql"
  echo "  chmod 600 $DESTINO/*.sql"
  exit 0
fi

mkdir -p "$DESTINO"

# Los tres dumps. `--use-copy` en los datos: para una base de este tamaño es
# bastante más rápido de escribir y de restaurar que miles de INSERT sueltos.
echo "1/3 roles…";  npx supabase db dump --linked --role-only            -f "$DESTINO/roles.sql"  >/dev/null
echo "2/3 schema…"; npx supabase db dump --linked                        -f "$DESTINO/schema.sql" >/dev/null
echo "3/3 datos…";  npx supabase db dump --linked --data-only --use-copy -f "$DESTINO/datos.sql"  >/dev/null

# Solo el dueño puede leerlos: adentro hay datos personales.
chmod 600 "$DESTINO"/*.sql

# 🔴 Un backup que no se verifica no es un backup. Un dump vacío o truncado pesa
# poco y se ve igual de bien en el listado, así que se chequea que cada archivo
# tenga contenido plausible antes de decir que salió bien.
echo
falla=false
for f in roles schema datos; do
  ruta="$DESTINO/$f.sql"
  bytes=$(wc -c < "$ruta" | tr -d ' ')
  if [[ "$bytes" -lt 1000 ]]; then
    echo "⚠️  $f.sql pesa $bytes bytes — sospechoso, revisalo"
    falla=true
  else
    printf '✅ %-7s %s\n' "$f" "$(du -h "$ruta" | cut -f1)"
  fi
done

# Que el dump de datos mencione las tablas que importan: si falta alguna, el
# backup está incompleto aunque el archivo pese.
for tabla in bookings profiles messages; do
  grep -q "public\.$tabla" "$DESTINO/datos.sql" || { echo "⚠️  falta $tabla en los datos"; falla=true; }
done

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
