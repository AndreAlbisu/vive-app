#!/bin/bash
TOKEN="${VITA_TEST_ACCESS_TOKEN:?Definí VITA_TEST_ACCESS_TOKEN con una sesión de prueba}"
TEST_USER_ID="${VITA_TEST_USER_ID:?Definí el usuario de prueba}"
ANON="${VITA_SUPABASE_ANON_KEY:?Definí la clave pública del entorno de prueba}"
BASE="https://ggygiihhnkjrerpinhha.supabase.co/rest/v1"

echo "── 1. journal_entries: SELECT ──────────────────────"
curl -s "$BASE/journal_entries?select=id&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"

echo ""
echo "── 2. journal_entries: INSERT ──────────────────────"
JRES=$(curl -s -X POST "$BASE/journal_entries" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"user_id\":\"$TEST_USER_ID\",\"content\":\"Test entrada\",\"mood\":\"bien\"}")
echo "$JRES"
JID=$(echo "$JRES" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);console.log(Array.isArray(r)?r[0].id:r.id||'')}catch{}})")

echo ""
echo "── 3. gratitude_entries: SELECT ────────────────────"
curl -s "$BASE/gratitude_entries?select=id&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"

echo ""
echo "── 4. gratitude_entries: INSERT ────────────────────"
GRES=$(curl -s -X POST "$BASE/gratitude_entries" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"user_id\":\"$TEST_USER_ID\",\"content\":\"Test gratitud\"}")
echo "$GRES"
GID=$(echo "$GRES" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);console.log(Array.isArray(r)?r[0].id:r.id||'')}catch{}})")

echo ""
echo "── 5. Limpieza ─────────────────────────────────────"
if [ -n "$JID" ]; then
  curl -s -X DELETE "$BASE/journal_entries?id=eq.$JID" \
    -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"
  echo "journal deleted: $JID"
fi
if [ -n "$GID" ]; then
  curl -s -X DELETE "$BASE/gratitude_entries?id=eq.$GID" \
    -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"
  echo "gratitude deleted: $GID"
fi
