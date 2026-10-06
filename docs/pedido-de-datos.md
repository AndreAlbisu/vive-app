# Cómo responder un pedido de datos

Alguien nos escribe pidiendo "todos los datos que tienen sobre mí". Es su derecho
(Ley 25.326, art. 14; Política §9) y hay que contestarlo. Este es el procedimiento.
Escrito el 04/10/2026, sin revisión legal todavía.

## Plazos y reglas

- **Plazo:** diez días corridos desde que llega el pedido.
- **Gratis**, una vez cada seis meses (o antes si acredita un interés legítimo).
- Se contesta **al mismo correo con el que la persona tiene la cuenta**. Si escribe
  desde otro, se le pide que escriba desde el de la cuenta: es la única forma que
  tenemos de saber que es ella. No se manda nada a un correo distinto.
- Si pide además **corregir** o **borrar**, se le indica cómo: el nombre y la foto
  desde el perfil, y la baja desde Perfil → Eliminar mi cuenta (o lo hacemos
  nosotros si no tiene la app, ver `docs/eliminar-cuenta.md`).

## Pasos

1. **Copiar el script y poner el mail.** En una copia fuera del repo, reemplazar
   `MAIL_DE_LA_PERSONA` en `scripts/exportar-datos-de-usuario.sql`.
2. **Correrlo y volverlo legible** (los mensajes están ofuscados; el diario y la
   gratitud, cifrados):

   ```
   supabase db query --linked -f /ruta/a/la/copia.sql | node scripts/decodificar-export.mjs > datos.json
   ```

   Para abrir el diario y la gratitud el script necesita el secreto maestro:
   lo toma solo de `~/.config/vita/` (la copia que dejó
   `scripts/crear-secreto-bienestar.sh`) o de la variable `WELLBEING_MASTER_KEY`.
   Si no lo encuentra, corta sin entregar nada.

   El script es de solo lectura. Si `perfil` no aparece, ese mail no tiene cuenta:
   se le contesta eso.
3. **Leer el archivo antes de mandarlo.** Tiene que tener solo cosas de esa persona.
4. **Mandarlo adjunto**, con dos líneas que expliquen qué es cada parte.
5. **Borrar la copia del script y `datos.json`** de la computadora.
6. **Anotar** en una planilla propia: fecha del pedido, fecha de la respuesta, mail.

## Qué incluye

Perfil, consentimientos, diario, gratitud, estado de ánimo, hábitos, cuestionario,
favoritos, recursos usados y guardados, reservas, mensajes que envió, reseñas que
escribió, reportes y problemas que informó, garantías, notas que un profesional
compartió con ella, notificaciones, bloqueos que hizo y eventos de uso.

Si es profesional, además: su ficha, temas, credenciales, datos de cobro,
verificación de identidad, medidas aplicadas y las notas que escribió.

## Qué no incluye, y por qué

- **Datos de otras personas:** los mensajes que recibió, o el nombre de sus clientes.
- **Notas privadas que un profesional escribió sobre ella.** Son del profesional.
  Si la persona las pide expresamente, consultar con el abogado antes de contestar.
- **Registros internos de Vita:** auditoría del panel, evidencia de sanciones.
- **Fotos y videos:** el archivo trae la dirección; si los pide, se adjuntan aparte.
- **Lo que guardan otros:** el detalle del pago lo tiene Mercado Pago o PayPal, y
  las videollamadas no se graban.
