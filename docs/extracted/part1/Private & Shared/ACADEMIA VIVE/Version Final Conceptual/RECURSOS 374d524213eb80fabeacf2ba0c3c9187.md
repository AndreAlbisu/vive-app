# RECURSOS

⚠️ **Esta página está en construcción.** La conceptualización de Recursos es un trabajo en progreso — hay decisiones que todavía no están cerradas y que se definirán en base a lo que se aprenda durante el MVP. Lo que está documentado acá representa la mejor hipótesis actual, no una definición final.

---

Recursos funciona como una "caja de herramientas" de desarrollo personal. Una colección curada de herramientas prácticas para ayudarte a vivir mejor, comprenderte más y crecer a tu ritmo.

---

## Principio de diseño

**Recursos = herramientas prácticas que el usuario activa y usa en el momento.**

Cada recurso es una invitación a una experiencia: una meditación que seguís, un journaling que escribís, una respiración que practicás. Si un contenido no tiene una acción asociada, no es un recurso de VIVE.

La información puede existir como contexto breve dentro de una herramienta — por ejemplo, tres líneas antes de una meditación — pero nunca como destino en sí mismo. VIVE no compite con Google ni con ChatGPT en información. Compite en relevancia, curaduría y acción.

**Tipos de recursos válidos:**

- Meditación guiada — audio que el usuario sigue
- Journaling — espacio para escribir con un prompt que lo guía
- Ejercicio de respiración — técnica guiada paso a paso
- Ejercicio práctico — una acción concreta con instrucciones simples
- Audio contemplativo — experiencia guiada para escuchar
- Visualización guiada — audio o texto que lleva al usuario a un estado
- Herramienta interactiva — tracker, check-in, calculadora, temporizador

**Formato de cada tarjeta:** acción + duración. No tema + categoría.

Ejemplo: *"Respirá y soltá — 5 min"* en lugar de *"Respiración consciente — Técnica"*.

---

## Hipótesis de navegación *(pendiente de validar)*

### Navegación en tres niveles

La hipótesis más sólida actual es una navegación en tres niveles:

**Cuerpo / Mente / Alma**

↓

**Tema o necesidad**

↓

**Herramienta o recurso**

Ejemplo:

> Mente → Ansiedad → Calmate ahora — técnica de respiración · 4 min → Uso del recurso
> 

La lógica detrás es que las personas rara vez buscan una herramienta específica. La mayoría no entra pensando "quiero hacer un journaling" o "quiero escuchar una meditación". Generalmente llegan con una necesidad concreta:

- Estoy ansioso.
- No puedo dormir.
- Me siento perdido.
- Necesito enfocarme.
- Quiero mejorar mis relaciones.

Por eso los recursos deberían descubrirse a través de temas o necesidades, y no directamente a través de su formato.

*Pendiente de definir: cuántos temas habría dentro de cada eje. Si hay demasiados, el segundo nivel puede volverse tan abrumador como una grilla de recursos. Probablemente no más de 5 o 6 por eje.*

### Rol de Cuerpo / Mente / Alma

Los tres ejes siguen siendo la puerta de entrada principal. Cumplen varias funciones:

- Son parte de la identidad visual de VIVE
- Utilizan el mismo diagrama de Venn que representa la marca
- Simplifican la primera decisión del usuario
- Evitan una pantalla inicial llena de categorías y problemas

Sin embargo, no se espera que funcionen como una clasificación perfecta. Muchos recursos son transversales por naturaleza y pueden aparecer en más de un eje. La función de los ejes es orientar, no categorizar de forma rígida.

### Rol de Sofía

Sofía no debe ser necesaria para navegar Recursos. La arquitectura de Recursos debe funcionar correctamente sin depender de la IA.

Sofía actúa como una guía opcional para usuarios que no saben por dónde empezar, no tienen claro qué están buscando, o prefieren recibir orientación personalizada.

> *"Si Recursos necesita de Sofía para funcionar, Recursos está mal diseñado. Si Recursos funciona por sí solo y Sofía mejora la experiencia, entonces Sofía está cumpliendo correctamente su rol."*
> 

Por esta razón, Sofía aparece como una ayuda opcional y no como la única puerta de entrada al contenido.

---

## Diseño de la pantalla de entrada

**MVP → Opción B**

Pantalla con el diagrama de Venn triple (Cuerpo / Mente / Alma) como navegación principal — el mismo logo de VIVE. El usuario toca un círculo y entra a ese eje. Las intersecciones son visuales, no interactivas. Abajo: card de Sofía con "¿No sabés por dónde empezar? Hablá con Sofía". La grilla de recursos vive un nivel adentro.

No hay grilla infinita en la pantalla principal. El primer mensaje que recibe el usuario es curaduría, no abundancia.

**V2 → Opción C**

Se agrega un recurso destacado de Sofía en la pantalla principal — personalizado según el perfil y momento del usuario. Una vez que haya personalización real para ofrecer.

### Diseño dentro de cada eje *(pendiente de definir)*

Una vez que el usuario elige un eje, ve los temas o necesidades disponibles (ej: Ansiedad, Sueño, Enfoque). Al elegir un tema, ve los recursos correspondientes en formato tarjeta — ícono + nombre en formato acción + duración + autor si corresponde.

---

## Modelo de contenido — biblioteca curada por VIVE + contribuciones de coaches

VIVE tiene su propia biblioteca de recursos — producidos o curados por el equipo. Esa es la base.

Adicionalmente, los coaches pueden proponer recursos para la biblioteca — herramientas que ya usan con sus clientes y que quieren poner a disposición de toda la comunidad. VIVE los revisa, los aprueba, y los publica. Es un valor agregado, no el modelo base.

**Dos tipos de recursos:**

- **Recursos de VIVE** — producidos o curados por el equipo, la base de la biblioteca
- **Recursos propuestos por coaches** — contribuciones de la comunidad de profesionales, revisadas y aprobadas por VIVE

Cada recurso propuesto por un coach muestra su nombre y credencial. Eso le da legitimidad al contenido y visibilidad profesional al coach.

**El círculo virtuoso:**

Coach propone recurso → usuario lo usa → le gusta → ve el perfil del coach → agenda una sesión.

---

## Casos de uso — tres entradas al mismo contenido

**1. Uso diario → Pineados en Inicio**

El usuario pinea hasta 4 recursos en su pantalla de Inicio para acceso rápido. Ya diseñado en la sección de Inicio.

**2. Uso exploratorio → Recursos + Guardados**

El usuario entra a Recursos, curiosea, descubre herramientas y guarda las que le interesan para usar después.

**3. Uso guiado → Recursos asignados por el coach**

El coach recomienda un recurso desde la sala antes de una sesión.

**MVP:** el coach escribe el nombre del recurso en el chat. El usuario lo busca por su cuenta en Recursos.

**Versión final:** el coach envía el recurso como tarjeta con acceso directo desde el chat. Los recursos asignados aparecen marcados como *"recomendado por tu coach"* en los Guardados del usuario.

---

## Temas de desarrollo personal — clasificación definitiva

Los temas están organizados dentro de los tres ejes de VIVE. Cada recurso y cada profesional pertenece a uno de estos ejes.

**Estructura de profesionales por eje:**

- **🟢 Cuerpo** — Nutricionistas (matriculados, holísticos/alternativos) + Coaches (de hábitos, bienestar, movimiento)
- **🔵 Mente** — Psicólogos (matriculados) + Coaches (de vida, emocional, de carrera, etc.)
- **🟣 Alma** — Coaches (de vida, propósito, espiritual, etc.)

**IMPORTANTE — el usuario no elige el eje:** muchos temas cruzan varios ejes (la ansiedad puede ser Cuerpo o Mente, el estrés puede ser los tres). El usuario elige el tema o síntoma concreto, y VIVE lo ubica internamente en el eje correspondiente. Cuerpo/Mente/Alma es la organización interna, no la pregunta que se le hace al usuario.

**🟢 CUERPO**

- Sueño y descanso
- Energía y cansancio
- Actividad física y movimiento
- Nutrición y alimentación
    - Nutricionista matriculado — casos clínicos, trastornos alimentarios, condiciones médicas
    - Coach de nutrición / alimentación consciente — hábitos, relación con la comida, bienestar general
    - Nutricionista holístico / alternativo — enfoques integrales, medicina natural, alimentación consciente
- Hábitos saludables
- Estrés físico y tensión
- Sexualidad e intimidad

**🔵 MENTE**

- Ansiedad
- Estrés
- Depresión y tristeza
- Emociones (gestión emocional)
- Autoestima y autoconfianza
- Relaciones de pareja
- Relaciones familiares
- Vínculos y amistades
- Duelo y pérdida
- Comunicación
- Productividad y procrastinación
- Trabajo y carrera
- Toma de decisiones
- Hábitos y autosabotaje
- Psicología *(profesionales matriculados)*

**🟣 ALMA**

- Propósito y sentido de vida
- Espiritualidad
- Identidad y autoconocimiento
- Momentos de cambio y transición
- Motivación
- Crecimiento personal
- Soledad y desconexión

**Descartados:** Apariencia como tema literal, Finanzas personales.

*Nota: esta lista es la versión completa de referencia. Andre y su hermano pueden depurarla antes de implementar. Fuentes: motivos comunes de consulta psicológica + áreas de coaching de vida.*

**Nota sobre psicólogos:** en Argentina hay resistencia cultural al coaching online pero no a la psicología. Los psicólogos se incluyen como tipo de profesional dentro del eje Mente. En Conexiones aparecen con su etiqueta visible — "Psicólogo" — igual que un coach aparece como "Coach". En los filtros, dentro de Mente se puede filtrar por tipo: Coach · Psicólogo · Terapeuta. El perfil muestra claramente el tipo de profesional para que el usuario sepa con quién está hablando.

**Nota sobre Recursos:** el motor de uso de Recursos no es el usuario explorando por su cuenta — es el coach o psicólogo asignando. El recurso cobra sentido cuando alguien te dijo "hacé esto". Sin ese contexto, el hábito de uso espontáneo es difícil de generar. Recursos y Conexiones se necesitan mutuamente: el coach asigna → el recurso aparece en la sala → el usuario lo hace. La exploración libre existe pero no es el motor principal del hábito.

El objetivo del MVP es testear qué tipo de recurso valora más el usuario antes de invertir en una dirección. Se incluyen tres tipos en su versión más mínima:

- **Lecturas breves** — texto curado, corto (2-3 minutos), que da contexto o perspectiva. Sin acción obligatoria, pero sin ser un artículo largo. Es la hipótesis más incierta y la que más necesita validación.
- **Herramientas interactivas** — recursos que el usuario usa activamente
- **Guías guiadas** — audio o experiencia paso a paso que el usuario sigue

Los datos de uso deciden hacia dónde va la V2.

**Nota:** las lecturas breves son la excepción controlada al principio de "si no tiene acción asociada, no es un recurso". Se incluyen específicamente para validar si el formato lectura tiene valor para los usuarios de VIVE. Si los datos dicen que nadie lo usa, se sacan.

---

## Lista de recursos por área *(preliminar — sujeta a cambios)*

### 🟢 Cuerpo

- Respirá y soltá — ejercicio de respiración · 3 min
- Escaneá tu cuerpo — body scan guiado · 10 min
- Movete 5 minutos — rutina de movilidad · 5 min
- Soltá la tensión — ejercicio de postura y relajación muscular · 4 min
- Preparate para dormir — audio de relajación nocturna · 12 min
- Respiración para activarte — técnica energizante · 5 min
- Check-in corporal — ¿cómo está tu cuerpo hoy? · herramienta interactiva
- Diario de energía — registrá cómo te sentís físicamente · herramienta interactiva

### 🔵 Mente

- Escribí lo que sentís — journaling guiado · 5 min
- Ordená tus pensamientos — brain dump guiado · 7 min
- Calmate ahora — técnica de respiración para ansiedad · 4 min
- Enfocate — audio de concentración · 15 min
- Reencuadrá una situación — ejercicio práctico cognitivo · 6 min
- ¿Qué valoro hoy? — journaling de autoestima · 5 min

### 🟣 Alma

- Agradecé lo simple — journaling de gratitud · 5 min
- Encontrá tu centro — meditación guiada · 10 min
- ¿Para qué hago lo que hago? — ejercicio de propósito · 8 min
- Perdoná y soltá — meditación guiada · 12 min
- Visualizá tu mejor versión — visualización guiada · 10 min

### 🔀 Transversales *(aparecen en más de un eje)*

- Respiración — Cuerpo + Mente
- Journaling — Mente + Alma
- Meditaciones guiadas — Mente + Alma

---

## Temas que abarca VIVE *(mapa de alcance)*

### ✅ Claramente dentro

- Sueño, Emociones, Espiritualidad, Relaciones, Propósito / sentido de vida, Productividad / hábitos, Sexualidad / intimidad, Identidad / autoconocimiento

### 🤔 Quizás *(pendiente de definir)*

- Nutrición — posible desde el ángulo emocional/consciencia, no como plan dietario
- Apariencia — posible desde la relación con uno mismo, no como app de skincare
- Finanzas personales — posible desde la relación con el dinero, no como app de budgeting

---

## Qué queda fuera del MVP

- **Resúmenes de libros** → fuera por ahora
- **Workshops** → fuera por ahora
- **Academia** → fuera definitivamente (ver Decisiones estratégicas)
- **Herramientas interactivas complejas** → V2
- **Sistema de propuesta de recursos por coaches** → V2

[💡 Ideas — Recursos posibles](RECURSOS/%F0%9F%92%A1%20Ideas%20%E2%80%94%20Recursos%20posibles%20376d524213eb8169b65acf79985b14a4.md)

[❓ A definir — Recursos](RECURSOS/%E2%9D%93%20A%20definir%20%E2%80%94%20Recursos%20376d524213eb810f8cd1db7ca48e73cf.md)