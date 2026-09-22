# Correcciones de seguridad — 22/09/2026

Estado al 22/09/2026: migración `20260922000000_security_audit.sql` aplicada a VIVE y funciones afectadas redesplegadas. Permisos de pago/perfil y configuración JWT verificados. **La app y la web corregidas aún no están publicadas**; falta probar los flujos completos en dispositivo y navegador. USDT sigue desactivado.

## Cambios y relación con la auditoría

| Hallazgo | Corrección local | Verificación |
|---|---|---|
| H01 Reservas/pagos falsificados | INSERT limitado por columna; estado inicial/precio/nombre derivados; validación de sala; bandera de pago derivada y confirmación condicionada al pago. | PostgreSQL: ataque directo rechazado, precio manipulado reemplazado, solicitud legítima aceptada. |
| H02 Autor de cancelación | Trigger anterior al de reembolsos deriva el actor de `auth.uid()`; no deja alterar actor/tardanza después. | Cancelación tardía falsificando `coach` conserva actor `usuario` y no habilita reembolso. |
| H03 XSS | DOM con `textContent`; enlace de sesión creado como nodo independiente. | jsdom: nombre con manejador no genera HTML ni lee sesión; enlace legítimo funciona. |
| H04 Correo falsificado | Notificaciones de cliente se validan contra el estado real y se normalizan; deduplicación; UPDATE limitado a `read`; asunto fijo y cuerpo escapado en mail. | Falso evento bloqueado, evento válido normalizado, duplicado bloqueado, plantilla sin HTML inyectado. |
| H05 Publicación sin revisión | INSERT de cliente siempre pendiente; editar contenido vuelve a moderación; archivar permitido. | INSERT/UPDATE maliciosos no publican. |
| H06 Atribución USDT | Contención: cobro/verificación automática deshabilitados salvo configuración explícita del registro de asignaciones. Montos permanentemente reservados, sin reutilización tras cancelar/borrar; hashes ya usados y fecha de asignación comprobados; solo transacciones confirmadas de TronGrid. | Transferencia anterior rechazada y reutilización de monto bloqueada. **No es una solución escalable de depósitos únicos: ver sección USDT.** |
| H07 Intentos de pago | Bloqueo de reservas pagadas/finalizadas y de cambios de proveedor; lease de checkout y escritura condicional; MP ligado a la preferencia de la orden consultada al proveedor; monto/moneda estrictos. PayPal recupera su orden existente. | Handlers reales con mocks: rechazos, creación válida ARS, webhook correcto y webhook de otro intento. |
| M01 Videollamadas | Solo se emiten tokens para reservas confirmadas y sin reversión de pago. | Canceladas/pendientes/completadas rechazadas; confirmada permitida. |
| M02 Push y bloqueo | Participantes directos únicamente, bloqueo bidireccional y cuota atómica de 5/minuto/par; contenido genérico del servidor. | Bloqueo/cuota y payload sin texto privado. |
| M03 Push tras logout | Retirar destino antes del logout; si falla, informar y conservar sesión para reintentar. Registro RPC reasigna dispositivo a una sola cuenta. | Registro por dos cuentas deja un dueño; flujo de logout pendiente de prueba física. |
| M04 Datos privados del perfil | SELECT público acotado; RPC sin ID para perfil propio; edad de consultantes accesible únicamente al profesional con reserva relacionada. | Lectura ajena denegada, propia permitida, profesional solo ve edad de sus participantes. |
| M05 Dependencias | Parsers Markdown/linkify, Metro 0.83.8, PostCSS y UUID corregidos; límite de lectura 20.000 caracteres en servidor y render. | Audit sin avisos conocidos; tests y exportación nativa. |
| M06 Carrera de horarios | Índice único transaccional para coach/fecha/hora normalizada confirmada o completada; quien pierde la confirmación instantánea pasa a cancelación/reembolso. Cancelación de competidores condicionada a que sigan pendientes. | Duplicado 9:00/09:00 rechazado. No se simuló concurrencia contra proveedores reales. |
| L01 Credencial/logs | Script usa variables del entorno de prueba, sin JWT versionado; quitados logs de URL OAuth y token push. | Barrido de archivos modificados. El JWT antiguo estaba vencido; no se reescribió historia Git. |

## Pruebas reproducibles

- `npm ci --ignore-scripts`
- `npm run test:security`: PostgreSQL aislado con esquema mínimo, handlers reales con servicios simulados y jsdom.
- `npm test -- --runInBand` o `node node_modules/jest/bin/jest.js --runInBand --watch=false`.
- `npx tsc --noEmit`
- `npm audit --package-lock-only`
- Exportar bundles nativos de iOS y Android con las variables públicas del entorno de prueba. Una exportación no reemplaza una prueba en teléfono ni una build firmada.

El fixture de PostgreSQL no incluye todos los triggers del despliegue. No hubo cobros, mensajes, escrituras ni invocaciones a APIs de producción durante las pruebas. El test de webhook simula la comprobación de firma para concentrarse en estados/atribución; no certifica credenciales reales de MP.

El export web de Expo encontró una dependencia preexistente del reproductor (`react-native-web-webview`, requerida por `react-native-youtube-iframe`) que no está instalada. La web publicada de este repositorio usa los HTML de `web/`; su corrección XSS sí tiene prueba aislada. No se agregó un paquete ajeno a la corrección para resolver ese empaquetado opcional.

## Despliegue coordinado

1. Revisar el esquema real y su código desplegado. El preflight encontró dos horarios duplicados, ambos con reservas completadas y anteriores al 22/09/2026; se conservaron intactos. El índice protege confirmaciones y sesiones completadas desde esa fecha. Se guardó una copia local de permisos, policies y triggers previos. Revisar la cola de correos previa al corte: sus filas antiguas no tienen procedencia fiable.
2. La migración completa ya se aplicó en VIVE, que el usuario confirmó que todavía no está publicada. Se registró en el historial remoto. No es un bootstrap de una base vacía.
3. Ya se publicaron conjuntamente las funciones modificadas: `mp-create-payment`, `mp-webhook`, `paypal-create-payment`, `usdt-create-payment`, `usdt-check-payments`, `create-meeting-room`, `send-push`, `mail-notificaciones`. También se redesplegó `paypal-webhook` porque importa `_shared/booking-effects.ts`. Conservar su configuración actual de JWT: no activar el gateway JWT sobre webhooks de proveedores.
4. Pendiente: publicar la web estática y distribuir una build interna de la app corregida. **La restricción de columnas privadas requiere la app nueva**: una build vieja que lea `birth_date`/`is_admin` directamente dejará de hacerlo. Coordinar actualización requerida o ventana de mantenimiento; no aplicar el SQL solo y asumir que todas las builds antiguas siguen funcionando. Las cancelaciones de builds anteriores siguen enviando campos que el servidor corrige de forma compatible.
5. La verificación de permisos posteriores pasó. Pendiente: probar perfiles propios/públicos, reservar/pagar/reintentar/cancelar con cuentas de prueba en VIVE y confirmar el comportamiento ante duplicados. Probar también entrar a videollamada cancelada, bloquear chat y cambiar de cuenta en un teléfono real.
6. No publicar para usuarios finales hasta verificar los flujos de punta a punta y distribuir la app compatible. No marcar los riesgos de la app/web como cerrados solo porque el backend esté desplegado.

No revertir únicamente las funciones dejando una mezcla incompatible con los permisos nuevos. Preparar el rollback desde el esquema real respaldado; no reotorgar INSERT de pagos ni SELECT privado para ocultar una incompatibilidad de cliente.

## USDT: límite y condición para reactivar

La ruta queda cerrada por defecto: `USDT_LEDGER_WALLET` debe coincidir con `USDT_WALLET_TRC20`. **No configurar esa coincidencia a ciegas como paso rutinario de despliegue.**

El registro permanente impide reutilizar un monto dentro del historial conservado. Los montos de reservas anteriores al corte se reservan sin dueño automático y requieren conciliación; la API rechaza devolver una nueva instrucción de pago para ellas. Si hubo reservas borradas, no es posible reconstruir su asignación a partir del estado actual. Para una transición controlada se requiere una wallet de cobro nueva, verificada por sus responsables, conservar y conciliar la anterior y controlar el stock de montos. Esta tarea no creó wallets, movió fondos ni cambió direcciones de cobro.

Hay **solo 100 montos por precio para toda la vida del registro**, no 100 simultáneos. Ese límite es una contención, no un diseño adecuado para operar a escala; incluso puede agotarse por solicitudes abandonadas. La solución definitiva es una dirección de depósito por intento con un proveedor/infraestructura que soporte conciliación y movimientos de fondos. Hasta contar con ese diseño, mantener USDT suspendido y ofrecer los otros medios. Los pagos antiguos deben seguir conciliándose manualmente, no descartarse.

## Dependencias y mantenimiento

Se mantiene Expo SDK 54. Se fijaron parches transitivos de Metro 0.83.x y versiones corregidas de parsers. `decode-uri-component` 0.5.0 se incluye en `vendor/` con licencia MIT y **solo el export adaptado a CommonJS**: Expo Router usa query-string 7, que requiere esa interfaz. Eliminar ese override cuando Router admita la dependencia ESM corregida. No editar el archivo vendorizado sin revisar el upstream.

La validación de Mercado Pago consulta [la orden comercial y su preference_id](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro-preferences/merchant-orders/get-merchant-order/get). Un pago no asociado o con diferencias se devuelve como error y queda registrado para conciliación; no se acredita silenciosamente ni se declara inexistente. Los operadores deben vigilar esos errores y conciliar el dinero recibido.

Persisten fuera del alcance probado: tokens Daily emitidos antes de una cancelación, configuración remota de Auth/Storage/IAM/CI, retención/borrado integral, dispositivos reales y credenciales/proveedores live. El código local no equivale a una certificación de producción.
