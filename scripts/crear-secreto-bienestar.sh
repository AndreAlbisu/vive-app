#!/bin/bash
# crear-secreto-bienestar.sh — crea y carga el secreto maestro con el que se
# calculan las claves del diario y la gratitud (ver la cabecera de
# supabase/functions/wellbeing-key/index.ts).
#
# Uso:
#   bash scripts/crear-secreto-bienestar.sh                 # producción
#   bash scripts/crear-secreto-bienestar.sh <project-ref>   # otro proyecto (pruebas)
#
# 🔴 SE CORRE UNA SOLA VEZ POR PROYECTO. Un secreto nuevo deja ilegibles todos
# los diarios escritos con el anterior, sin vuelta atrás. Por eso este script:
#   · si ya hay una copia local, la REUTILIZA (no genera otra);
#   · si Supabase ya tiene el secreto y acá no hay copia, SE NIEGA a seguir.
#
# El secreto nunca se imprime. Queda en ~/.config/vita/, fuera del repo.
set -euo pipefail

REF="${1:-ggygiihhnkjrerpinhha}"
DIR="$HOME/.config/vita"
FILE="$DIR/wellbeing-master-key.$REF.env"

if [ ! -f "$FILE" ]; then
  if supabase secrets list --project-ref "$REF" 2>/dev/null | grep -q "WELLBEING_MASTER_KEY"; then
    echo "🔴 Supabase ($REF) YA tiene WELLBEING_MASTER_KEY y acá no hay copia en $FILE."
    echo "   No se genera uno nuevo: pisaría el actual y se perderían todos los diarios."
    echo "   Buscá la copia que guardaste (gestor de contraseñas) y ponela en ese archivo como:"
    echo "   WELLBEING_MASTER_KEY=<el valor>"
    exit 1
  fi
  mkdir -p "$DIR"
  chmod 700 "$DIR"
  (umask 077 && printf 'WELLBEING_MASTER_KEY=%s\n' "$(openssl rand -base64 48)" > "$FILE")
  echo "Secreto nuevo generado en $FILE"
else
  echo "Ya había una copia en $FILE: se reutiliza, no se genera otra."
fi

supabase secrets set --env-file "$FILE" --project-ref "$REF"

echo
echo "✅ Cargado en Supabase ($REF)."
echo "🔴 Falta lo más importante: guardar una SEGUNDA copia fuera de esta computadora."
echo "   Abrí $FILE y pegá su contenido en tu gestor de contraseñas."
echo "   Si se pierden las dos copias, nadie puede volver a leer ningún diario."
