# El inicio del coach — análisis e ideas

> 26/08/2026. Escrito a pedido de Andre: qué podría servirle a un profesional en
> su pantalla de inicio, incluyendo ideas nuevas. No es un plan cerrado — es
> material para decidir. Nada de acá está implementado.

## 1. El diagnóstico, en una frase

**La Home de hoy contesta "¿qué tengo hoy?", y ese es el marcador, no la palanca.**

Sus cuatro bloques —saludo, tira de la semana, próxima sesión, tarjeta de
visibilidad— dependen todos de que ya haya sesiones. Pero los problemas reales
del coach, según la definición del producto (*"tengo conocimiento pero no sé
llegar a la gente, no tengo agenda ni sistema de reservas"*), son tres y ninguno
es la agenda:

1. **Llegar a gente nueva** (adquisición)
2. **Que esa gente vuelva** (retención)
3. **No dejar caer el hilo entre sesión y sesión** (continuidad)

La agenda es el *resultado* de los tres. La Home muestra el resultado y ninguna
de las tres palancas. Por eso se siente vacía incluso cuando hay una sesión
agendada: no es que falte contenido, es que lo que hay no le da nada que hacer.

## 2. La reinterpretación que ordena todo lo demás

De la estrategia anti-fuga viene el insight que debería gobernar esta pantalla:

> Para el coach, lo que Vita le da **no es el cliente que ya tiene, es el cliente
> nuevo**. La comisión es su costo de adquisición.

Si eso es cierto, entonces:

**La Home no es un dashboard. Es el recibo permanente de lo que Vita le está
dando.**

Hoy el coach siente la comisión todos los meses y no ve nunca lo que compró con
ella. Esa asimetría es exactamente el combustible de la fuga: lo que se cobra es
visible y recurrente, lo que se entrega es invisible. Cualquier bloque que
agreguemos debería poder contestar *"¿esto me lo trajo Vita?"*.

⚠️ **Y hay una tensión que no se puede ignorar.** El producto se define como *"si
abruma, sobra"*, *"menos pero más intencional"*, explícitamente **no**
productividad tóxica. Llenar el vacío con una pared de métricas sería resolver un
problema visual traicionando el principio. **El vacío no se llena: se reemplaza
por lo poco que se gane el lugar.**

## 3. Ideas, ordenadas por lo que aportan

### A. Un solo "siguiente paso" (la más alineada con la marca)

En vez de N bloques, la Home calcula **la única cosa que importa ahora** y la
muestra grande:

- ¿Hay una reserva sin confirmar? → *"Ana espera tu confirmación para el jueves"*
- ¿La próxima sesión es en menos de 24hs? → *"Preparás la de mañana"*
- ¿Hay alguien que no vuelve hace 3 semanas? → *"Hace 21 días que no ves a Marcos"*
- ¿Falta algo para aparecer en Conexiones? → el bloqueante
- ¿Nada de lo anterior? → *"Estás al día"* y punto

Es lo contrario de un dashboard y es exactamente *"menos pero más intencional"*.
Y resuelve un agujero concreto que hoy existe: **en la captura del 26/08 la
pestaña de Reservas tiene el punto rojo y la Home no lo menciona.** Hay algo
esperando acción y te enterás por un punto de seis píxeles en otra pestaña.

### B. Continuidad: quién se está por caer 🔴

**Es la idea con más retorno de todas, y no existe en ninguna forma.**

Datos que ya están: sesiones `completada`, sin reserva futura, N días desde la
última. Con eso se arma *"Hace 3 semanas que no ves a Ana"* con un botón de
**proponerle un horario**.

Por qué importa tanto:

- Es el problema de negocio más caro del coach (la fuga de clientes propios).
- Es plata para el coach y para Vita al mismo tiempo.
- **Es la medida anti-fuga #1 vista desde el otro lado.** "Re-reserva de un
  toque" hoy existe solo del lado del usuario (`rebookData` en
  `app/(tabs)/conexiones.tsx`). El coach no tiene ninguna forma de iniciar una
  re-reserva — y es el que se acuerda de la persona.
- Si Vita le recupera un cliente que se estaba cayendo, la comisión deja de
  discutirse sola.

### C. "Tus personas" — el modelo mental que la app no tiene 🔴

**Verificado: no existe ninguna lista de clientes en la app.** Hay reservas
(`CoachReservasScreen`) y hay chats (`CoachChatsScreen`), que son dos vistas de
eventos. Pero **el coach no piensa en reservas, piensa en personas**: "cómo viene
Ana", "a Marcos le mandé el ejercicio y no sé si lo hizo".

Un roster —cada persona con su última sesión, si abrió lo que le mandaste, si
tiene próxima— es el bloque que más se parece a cómo trabaja de verdad. Y es
**sesión pegajosa** en estado puro (anti-fuga #4): ese historial no se lo puede
llevar a ningún lado.

### D. El arco del cliente entre sesiones ⚠️ (la más diferenciadora, y la más delicada)

`mood_entries` existe: el usuario hace check-in diario de ánimo. **El coach nunca
lo ve.** Verificado — cero referencias en todo `screens/Coach*.tsx`.

Un coach que antes de la sesión ve *"viene de cuatro días seguidos en bajón"*
llega con una información que **ninguna plataforma de la competencia le da**, y
que hace la sesión medible mejor. Es el diferencial más grande que encontré.

🔴 **Pero es dato sensible en los términos de la Ley 25.326**, y SCHEMA.md ya lo
dice así: el ánimo y el diario *"pueden constituir datos sensibles"* y se tratan
*"con el consentimiento libre, expreso e informado del Usuario"* y **con el único
fin de prestar el servicio**. Compartirlo con el coach **no está cubierto por ese
consentimiento**: es una finalidad nueva.

Así que esto **no se puede hacer en silencio**. Requiere:
- Opt-in explícito del usuario, por coach, revocable.
- Probablemente solo la tendencia agregada (una flecha, no las entradas).
- **Nunca el diario ni la gratitud.** Eso es contenido, no metadato.
- Revisión del abogado antes de escribir una línea.

Bien hecho, es una razón para elegir Vita. Mal hecho, es un problema legal y una
traición a la confianza del usuario, que es el activo entero del producto.

### E. Cerrar la sesión que ya pasó

`session_notes` existe (privada + compartida) y vive detrás de una pill en el
header del chat. **Nadie le pide nunca al coach que la escriba.**

Un bloque *"Ayer tuviste sesión con Ana — ¿le dejás algo para la semana?"* es a
la vez buena práctica profesional y la función más pegajosa que tiene el
producto. Costo bajo: la infraestructura está entera.

### F. La reputación como ancla, visible

`coach_rebooking_stats` calcula `rebooking_rate` (qué fracción de tus clientes
vuelve) y hoy **solo se usa para rankear el deck del usuario**. El coach nunca lo
ve.

*"El 60% de las personas que atendés vuelve"* es el número más halagador y más
difícil de conseguir que tiene un profesional independiente — y **no se lo puede
llevar a ningún lado**. Es anti-fuga #4 en una línea.

### G. La comisión decreciente, dicha

Anti-fuga #3 está pendiente desde el 06/08 y la memoria la describe como *"casi
gratis (copy)"*. El encuadre que funciona ya está escrito:

> **"Te cobramos por presentarte al cliente, no por tu relación con él."**

La Home es donde eso se dice. Hoy el coach ve la comisión en el perfil, en frío,
sin ese marco.

## 4. Lo que NO haría

**Un bloque de "cuánto ganaste".** Es lo primero que pide un dashboard y acá está
mal por dos motivos:

1. **En pesos, Vita no tiene el dato.** El split de Mercado Pago deposita en la
   cuenta propia del coach. Mostrar "ganaste X" duplica —y puede contradecir— lo
   que él ya ve en su app de MP.
2. **Es el encuadre equivocado.** Un contador de plata en la pantalla de inicio
   empuja al coach a pensar en volumen, que es exactamente la productividad
   tóxica que el producto dice no ser.

Lo que sí tiene sentido mostrar es **lo que Vita le debe** (riel internacional,
donde no tiene otra fuente): *"USD 120 a transferirte el lunes"*. Preciso,
accionable, y solo donde somos la única fuente.

## 5. Si hubiera que elegir un orden

1. **Un solo siguiente paso** (A) — chico, muy alineado, y destapa lo accionable
   que hoy está escondido en un puntito.
2. **Quién se está por caer** (B) — el mayor retorno para coach y para Vita.
3. **Tus personas** (C) — el modelo mental que falta.
4. **Cerrar la sesión** (E) y **reputación** (F) — baratos, pegajosos.
5. **El arco del cliente** (D) — el diferencial, detrás de consentimiento y del
   abogado.

## 6. La pregunta que queda abierta

Todo lo de arriba asume que la Home debe **darle trabajo** al coach. Hay una
lectura opuesta, igual de coherente con la marca: que la Home sea **un lugar
tranquilo** —tu día, tu gente, nada más— y que las palancas vivan en otras
pestañas.

Bajo esa lectura, el vacío de la captura **no es un problema a resolver sino una
decisión a defender**, y lo único que falta es que lo accionable no esté
escondido en un punto rojo.

No creo que sea la lectura correcta —el coach que arranca necesita que le digan
qué hacer— pero conviene descartarla a propósito y no por omisión.
