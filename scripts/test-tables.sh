#!/bin/bash
TOKEN="eyJhbGciOiJFUzI1NiIsImtpZCI6ImU1ZDhkYTQ0LWU2NmEtNDFkOC05MThjLTM2NGY1N2Q5OGM0OCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2dneWdpaWhobmtqcmVycGluaGhhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkZmJmOGNhNi1hNjIyLTQxZWMtYTlhMi1iZTEwODk5MDhmYjEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgxODQ1NjU4LCJpYXQiOjE3ODE4NDIwNTgsImVtYWlsIjoidGVzdF92aXRhX2RpYWdAZXhhbXBsZS5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoidGVzdF92aXRhX2RpYWdAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiJkZmJmOGNhNi1hNjIyLTQxZWMtYTlhMi1iZTEwODk5MDhmYjEifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc4MTg0MjA1OH1dLCJzZXNzaW9uX2lkIjoiMTc4MjAzNDAtMWJhOC00NDdiLWI0YjktZWVkYzgxMzgzMzZmIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.n4UFYmz2ojPjoqNq5Ww2crPTknQKAmw7UZTlrgWt12niEPl608yVP_D7CqnabUaEmSSTR4DO_-6KqEFmXqh4NA"
UID="dfbf8ca6-a622-41ec-a9a2-be1089908fb1"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdneWdpaWhobmtqcmVycGluaGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjc5NjEsImV4cCI6MjA5NzEwMzk2MX0.lHPjyKjJIYD_lUTCF7uMBCKj9tCK_67OyrIFkCLQ-BI"
BASE="https://ggygiihhnkjrerpinhha.supabase.co/rest/v1"

echo "── 1. journal_entries: SELECT ──────────────────────"
curl -s "$BASE/journal_entries?select=id&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"

echo ""
echo "── 2. journal_entries: INSERT ──────────────────────"
JRES=$(curl -s -X POST "$BASE/journal_entries" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"user_id\":\"$UID\",\"content\":\"Test entrada\",\"mood\":\"bien\"}")
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
  -d "{\"user_id\":\"$UID\",\"content\":\"Test gratitud\"}")
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
