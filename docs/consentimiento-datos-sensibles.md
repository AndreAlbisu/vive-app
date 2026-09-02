# Consentimiento de datos sensibles, y el registro ante la AAIP

> **01/09/2026.** Investigación para responder **A.2** y **B.3** de
> `paquete-abogado.md` sin consulta paga. **No es asesoramiento legal.** Acá hay
> un punto donde la letra de la ley y la práctica no coinciden, y eso está dicho
> de frente en la sección 2 en vez de escondido.
>
> Compañero de [`transferencias-internacionales.md`](./transferencias-internacionales.md), que resuelve A.3.

---

## 1. El dato de Vita ES sensible

**Ley 25.326, art. 2** define datos sensibles como los que revelan origen racial
o étnico, opiniones políticas, convicciones religiosas, filosóficas o morales,
afiliación sindical, e **información referente a la salud o a la vida sexual**.

El check-in de ánimo, el diario, la gratitud y el contenido de los mensajes con
un profesional son información referente a la salud —salud mental es salud— así
que entran. La Política §3 ya lo dice y está bien dicho. **No hay margen para
discutir esto**, y conviene no intentarlo: la posición de "en realidad no es
sensible" es la que peor envejece.

## 2. 🔴 La letra de la ley es más dura de lo que todo el mundo aplica

Esto es lo que más me sorprendió y es la parte que no quiero suavizar.

**Art. 7, inciso 2:** *"Los datos sensibles sólo pueden ser recolectados y objeto
de tratamiento cuando medien razones de interés general autorizadas por ley.
También podrán ser tratados con finalidades estadísticas o científicas cuando no
puedan ser identificados sus titulares."*

**Art. 7, inciso 3:** *"Queda prohibida la formación de archivos, bancos o
registros que almacenen información que directa o indirectamente revele datos
sensibles. Sin perjuicio de ello, la Iglesia Católica, las asociaciones
religiosas y las organizaciones políticas y sindicales podrán llevar un registro
de sus miembros."*

Leído literalmente, **el art. 7 no menciona el consentimiento como base para
tratar datos sensibles**, y el inciso 3 prohíbe formar el archivo, con
excepciones que son la Iglesia, los partidos y los sindicatos. Vita no es
ninguna de esas.

**Qué se aplica en la práctica.** La lectura profesional corriente en Argentina
—y la que sostienen los estudios que trabajan el tema— es que el
**consentimiento expreso, escrito, libre e informado del titular** habilita el
tratamiento, integrando el art. 7 con el art. 5 y con el derecho a la
autodeterminación informativa: el inciso 1 dice que *nadie puede ser obligado* a
dar datos sensibles, lo que presupone que puede darlos si quiere. Si la lectura
literal fuera la buena, casi ninguna app de salud que opera en el país sería
legal.

**Qué significa esto para vos, en concreto:**

- No hay una respuesta cómoda. **Estás en la interpretación mayoritaria, no en
  terreno firme.** Eso es distinto de estar mal, y es distinto de estar cubierto.
- Lo que sí controlás es **hacer el consentimiento tan sólido como se pueda**, y
  eso mueve la aguja de verdad: la diferencia entre un opt-in expreso registrado y
  un checkbox genérico es la diferencia entre defenderse bien y no tener nada.
- 📌 **Es la pregunta número uno para la consulta gratuita a la AAIP.** Es la
  autoridad que aplicaría el art. 7, y su criterio vale más que cualquier opinión
  privada que pudieras pagar.

## 3. Qué exige el consentimiento, y qué tenés hoy

**Lo que pide la norma** (art. 5 y Decreto 1558/2001):

| Requisito | Qué significa |
|---|---|
| **Libre** | sin coerción, y **no puede ser condición para usar el resto de la app** (art. 7.1) |
| **Expreso** | inequívoco y explícito. No tácito, no por defecto, no "al seguir usando" |
| **Informado** | precedido de la explicación del art. 6: quién trata, con qué fin, quién puede recibirlos, si es obligatorio u opcional, y los derechos de acceso, rectificación y supresión |
| **Por escrito o medio equiparable** | el Decreto 1558/2001 admite otro medio, pero exige que **asegure la autoría e integridad de la declaración** |
| **Revocable** | en cualquier momento, y hay que poder ejercerlo |
| **Específico para la cesión** | los datos sensibles no se ceden a terceros sin consentimiento previo propio |

**Lo que Vita tiene hoy:** un checkbox de aceptación de los T&C al registrarse,
con `profiles.accepted_terms`, `accepted_terms_at` y `accepted_terms_version`.

**Por qué probablemente no alcanza:**

1. **Es genérico y va en paquete.** Aceptar los T&C cubre la relación entera; no
   aísla el propósito "tratar tu información de salud". Un consentimiento
   específico no puede ir escondido dentro de uno general.
2. **La Política §3 dice que el consentimiento se otorga "al utilizar las
   funcionalidades correspondientes".** Eso es consentimiento **por conducta**, y
   para dato sensible la ley pide **expreso**. Es el punto más débil del texto
   actual y hay que cambiarlo.
3. ⚠️ **La constancia es falsificable por su propio titular.** Ya está
   documentado en `SCHEMA.md`: las cuatro columnas de aceptación las escribe el
   cliente desde `AuthContext`, así que cualquiera con su token puede ponerlas en
   `true` o en `false`. Eso ataca justo la **integridad de la declaración** que
   exige el Decreto 1558/2001. Cerrarlo pide moverlas a una edge function.

## 4. Cómo construirlo — el diseño concreto

Nada de esto necesita abogado. Es una pantalla y una tabla.

**Cuándo pedirlo.** No en el registro. **La primera vez que la persona va a usar
una funcionalidad de bienestar** — el primer check-in de ánimo, la primera
entrada de diario. Ahí el pedido tiene contexto y se entiende qué se está
aceptando; en el alta es ruido que nadie lee.

**Qué mostrar**, en la pantalla y antes del botón:

- Qué se guarda: ánimo, diario, gratitud.
- Para qué: prestar el servicio y devolverle a la persona su propio registro.
- **Que no se comparte con nadie**, ni con los profesionales, salvo que ella lo
  mande explícitamente (eso es A.11).
- Que puede **no** aceptar y seguir usando el resto de la app.
- Que puede revocar y pedir la supresión cuando quiera, y cómo.

**Qué registrar** — tabla nueva, no columnas sueltas, porque hay que poder tener
varios consentimientos y su historia:

```
user_consents
  user_id, consent_type ('datos_sensibles_bienestar'),
  granted (bool), granted_at, revoked_at,
  policy_version   -- el LEGAL_VERSION que leyó, igual que accepted_terms_version
```

🔴 **Escribila desde una edge function, no desde el cliente.** Es el error que ya
está identificado en las columnas viejas, y no tiene sentido repetirlo en la
tabla que existe justamente para probar algo.

**Qué pasa si no acepta.** El resto de la app funciona: reservar, chatear,
recursos. Solo quedan fuera ánimo, diario y gratitud. Eso **no es una degradación
que haya que evitar** — es lo que el art. 7.1 exige.

**Y una consecuencia que conviene mirar de frente:** si hoy hay usuarios con
datos de ánimo cargados y sin este consentimiento, no se puede fabricar
retroactivamente. Hay que pedírselo la próxima vez que entren, con el mismo
criterio que ya usaron con `accepted_terms` — nunca backfillear una constancia
que no existió.

## 5. Texto propuesto para Política §3

Reemplaza el `[Validar con abogado…]` y saca el consentimiento por conducta.

> ### 3. Datos Sensibles y Consentimiento Explícito
>
> Ciertos datos que el Usuario ingresa —los registros de estado de ánimo, el
> diario, los ejercicios de gratitud, y el contenido de las conversaciones que
> pueda revelar información sobre su salud— constituyen **datos sensibles** en
> los términos de la Ley 25.326.
>
> Su tratamiento requiere el **consentimiento libre, expreso e informado** del
> Usuario, que se solicita **de forma específica y separada de la aceptación de
> los Términos y Condiciones**, la primera vez que el Usuario accede a estas
> funcionalidades. Vita deja constancia de la fecha y de la versión del texto
> informado.
>
> **Prestar este consentimiento es voluntario y no es condición para usar la
> Plataforma.** El Usuario que no lo preste puede reservar sesiones, comunicarse
> con Profesionales y acceder a los contenidos, sin las funcionalidades de
> registro de bienestar.
>
> El Usuario puede **revocar este consentimiento en cualquier momento** desde su
> perfil o escribiendo a vitaappar@gmail.com, y solicitar la supresión de los
> datos ya registrados conforme a la sección 9. La revocación no afecta la
> licitud del tratamiento anterior.
>
> **Estos datos no se comparten con los Profesionales ni con ningún tercero**,
> salvo que el propio Usuario decida enviarlos, en cada caso y de forma expresa.

⚠️ Ese texto **describe algo que todavía no existe**. No se publica hasta que la
pantalla y la tabla estén hechas — publicarlo antes sería la misma clase de error
que afirmar garantías de transferencia que no están firmadas.

## 6. B.3 — El registro ante la AAIP

**Es obligatorio, es gratis y lo hacés vos.**

**Base legal:** Ley 25.326 art. 21 — todo archivo, registro, base o banco de
datos debe inscribirse en el Registro Nacional de Bases de Datos Personales.
Están exceptuados los de uso exclusivamente personal o doméstico. Vita no lo es.

📝 El art. 21 dice literalmente *"destinados a proporcionar informes"*, y hay
discusión sobre si eso acota la obligación. **La AAIP interpreta que alcanza a
toda base que no sea de uso personal o doméstico**, y en la práctica se inscribe.
Con datos sensibles de por medio, no inscribirse **agrava** frente a una
denuncia, así que la discusión no conviene darla.

**Cómo:**

1. Clave fiscal de AFIP **nivel 2 o superior**.
2. Entrar a **TAD (Trámites a Distancia)** y adherir el servicio.
3. Inscribirse primero como **responsable**, y después declarar **cada base**
   con su finalidad y las medidas de seguridad aplicadas.
4. Renovar cuando corresponda y actualizar ante cambios.

**Las bases a declarar en el caso de Vita**, para no improvisar el formulario:
usuarios y perfiles; contenido de bienestar (ánimo, diario, gratitud) — **la
sensible**; mensajería; reservas y transacciones; profesionales y sus
credenciales.

⚠️ Al declarar las medidas de seguridad conviene que coincidan con lo que la
Política dice y con lo que el sistema hace de verdad. Hoy hay un punto donde
divergen: la Política §8.2 dice —bien— que los mensajes **no** tienen cifrado de
extremo a extremo. Que el formulario no diga otra cosa.

## 7. Qué queda abierto

1. **Si el consentimiento habilita el tratamiento de dato sensible** bajo el
   art. 7. Es la pregunta de fondo y la respuesta correcta es preguntarle a la
   AAIP, gratis.
2. **Si el consentimiento del art. 5 alcanza además para la transferencia
   internacional**, o hace falta uno propio para eso. Se cruza con A.3.
3. **Qué versión del texto informado guardar** si la Política cambia después:
   ¿hay que volver a pedir el consentimiento? Criterio propuesto: sí, si cambia
   la finalidad o los destinatarios; no, si es una corrección de redacción.

---

## Fuentes

- [Ley 25.326](https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/texto) — arts. 2, 5, 6, 7, 8, 21.
- [Decreto 1558/2001](https://www.argentina.gob.ar/normativa/nacional/decreto-1558-2001-70368/actualizacion) — reglamentación; consentimiento por medio distinto al escrito, autoría e integridad, revocación.
- [AAIP — Obligaciones de los responsables](https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones).
- [AAIP — Trámites ante el Registro Nacional de Bases de Datos](https://www.argentina.gob.ar/aaip/datospersonales/tramites).
