# Runbook — Garantía de primera sesión (T&C §9.3)

> Tabla y función **en producción desde el 13/08/2026**, verificadas.
> `<PROJECT>` en las URLs de abajo es `ggygiihhnkjrerpinhha`.

Qué hacer cuando llega un mail a `vitaappar@gmail.com` pidiendo el reintegro de
la garantía. El intake es por correo porque así lo dice §9.3; lo que sigue
reemplaza al editar filas a mano.

> **Desde el 15/08/2026 esto se puede hacer desde la app, sin `curl`.**
> Perfil → Administración → pestaña **Garantías**: pegás el ID de la reserva,
> "Verificar" corre el mismo `dry_run` y muestra qué condición falla, y los
> botones aprueban o rechazan. Es la **misma** edge function con el mismo
> payload — no hay dos implementaciones de §9.3.
>
> Este runbook sigue siendo válido y es la vía cuando no tenés la app a mano o
> necesitás el detalle crudo de la respuesta. La única diferencia: desde el
> panel, **`resolved_by` sale del JWT** y se ignora lo que mande el body.
>
> El paso 1 (encontrar la reserva) sigue siendo SQL en los dos caminos: el panel
> arranca del ID, no busca por mail.

## 1. Encontrar la reserva

Del mail salen el nombre y el correo. En el SQL editor de Supabase:

```sql
select b.id, b.scheduled_date, b.scheduled_time, b.amount,
       b.status, b.payment_status, b.payment_id,
       p.name as cliente, b.coach_name
from bookings b
join profiles p on p.id = b.user_id
where lower(p.email) = lower('EL_MAIL_DE_LA_PERSONA')
order by b.scheduled_date desc
limit 10;
```

La reserva buscada es la más reciente `completada` con ese profesional. Copiar
el `id`.

## 2. Ver si califica, sin comprometerse

`dry_run` valida las cinco condiciones y **no escribe nada**. Sirve para poder
contestar el mail sabiendo la respuesta.

```bash
curl -sS -X POST 'https://<PROJECT>.supabase.co/functions/v1/guarantee-claim' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"booking_id":"...","dry_run":true}' | jq
```

- `{"eligible":true,...}` → califica.
- `422` con `reasons` → no califica, y cada motivo viene redactado para poder
  copiarse a la respuesta del mail.
- `409` → esa reserva ya tiene una solicitud; el cuerpo dice de qué fecha y en
  qué estado.

## 3. Aprobar

```bash
curl -sS -X POST 'https://<PROJECT>.supabase.co/functions/v1/guarantee-claim' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"booking_id":"...","resolved_by":"andre"}' | jq
```

Deja el `guarantee_claims` en `aprobada` y marca la reserva en
`reembolso_pendiente`. **El reembolso real lo hace `mp-process-refunds` en la
corrida siguiente (cada 5 minutos).** El `status` de la reserva NO se toca:
sigue siendo `completada`, porque la sesión efectivamente ocurrió.

## 4. Rechazar

§9.3 permite denegar ante uso abusivo o fraudulento.

```bash
curl -sS -X POST 'https://<PROJECT>.supabase.co/functions/v1/guarantee-claim' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"booking_id":"...","resolved_by":"andre","reject":"motivo concreto"}' | jq
```

El rechazo **se registra igual aunque la solicitud tampoco calificara por otro
motivo**: si no quedara rastro, la próxima vez que la misma persona lo intente
no habría forma de saber que ya hubo un caso.

## 5. Confirmar que el reembolso salió

A los ~5 minutos:

```sql
select payment_status, refunded_at, refund_attempts
from bookings where id = 'EL_BOOKING_ID';
```

Esperado: `reembolsado` con `refunded_at` cargado.

Si sigue en `reembolso_pendiente` con `refund_attempts` subiendo, el refund
contra MP está fallando. Ver el log de `mp-process-refunds` en el dashboard
—ampliando la ventana, que por defecto son 15 minutos— y tener en cuenta los dos
modos de falla ya conocidos:

- **`refund 404: Payment not found`** — el coach reconectó su cuenta de MP y el
  pago pertenece a la cuenta anterior. Desde la sesión 88 hay un guardarraíl que
  lo impide si quedan pagos sin resolver, pero los casos viejos siguen rotos.
- **Fondos ya liberados.** Si el coach retiró la plata, MP puede rechazar el
  refund. No lo resuelve ninguna función: es política de *money release* y hoy
  no está resuelta. Es el riesgo real de esta garantía a volumen.

Reencolar un reembolso muerto = `update bookings set refund_attempts = 0`.

## Lo que la función NO valida

- **Que la persona no haya quedado conforme.** §9.3 dice explícitamente que no
  hace falta expresar motivo, así que no hay nada que verificar.
- **Que el reclamo sea de buena fe.** Para eso está el rechazo del paso 4, que
  es un juicio humano.
