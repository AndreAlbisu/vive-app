@AGENTS.md

# Contexto de proyecto

Antes de tocar cualquier código relacionado a base de datos, booking, salas o autenticación, leé SCHEMA.md.
Antes de empezar a trabajar, leé la última entrada de CHANGELOG_SESIONES.md que no sea tuya.
Al terminar la sesión, actualizá ambos archivos con lo que cambiaste y commitealos.

## Protocolo de cierre de sesión

Actualizá CHANGELOG_SESIONES.md SIN que el usuario lo pida explícitamente cuando:
- Se resuelve un bug importante o un merge con conflictos
- Se cambia algo en la base de datos (tablas, columnas, triggers)
- El usuario indica que va a cerrar la sesión ("listo por hoy", "corto aquí", etc.)
- Se hace un commit que cierra un bloque de trabajo

Formato de entrada (agregar ARRIBA de todo):

```
## YYYY-MM-DD — [Andre|Joaquín]

*Tocado:* lista de archivos modificados

*Resumen:*
- Qué se hizo, en 2-4 bullets, enfocado en decisiones y bugs, no en detalle de código
- Si se tocó la base de datos, mencionar qué cambió (y si SCHEMA.md ya quedó actualizado)

*Pendiente para la próxima sesión:*
- Qué queda abierto, qué hay que confirmar con el otro antes de seguir
```

Si SCHEMA.md también cambió en la sesión, actualizarlo en el mismo momento.
No pedir confirmación al usuario — es parte del flujo normal de cierre.
