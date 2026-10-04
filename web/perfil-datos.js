// GENERADO por scripts/sync-web-perfil.cjs. No editar a mano: la fuente es
// lib/enfoque.ts, lib/perfilProfesional.ts y lib/tipoProfesional.ts.
(function (g) {
  var D = {
  "escuelas": {
    "cognitivo_conductual": {
      "label": "Cognitivo conductual",
      "desc": "Trabaja sobre pensamientos y conductas del presente, con ejercicios"
    },
    "tercera_ola": {
      "label": "Tercera ola (ACT, DBT, mindfulness)",
      "desc": "Aceptar lo que sentís y actuar según lo que te importa, con práctica de atención al presente"
    },
    "psicoanalitico": {
      "label": "Psicoanalítico",
      "desc": "Busca el origen de lo que pasa hoy en la historia de cada uno"
    },
    "sistemico": {
      "label": "Sistémico",
      "desc": "Mira los vínculos y el entorno, no solo a la persona sola"
    },
    "interpersonal": {
      "label": "Interpersonal",
      "desc": "Trabaja cómo tus vínculos de hoy influyen en cómo te sentís, en un tiempo acotado"
    },
    "gestaltico": {
      "label": "Gestáltico",
      "desc": "Se centra en lo que pasa acá y ahora, y en darse cuenta"
    },
    "humanistico": {
      "label": "Humanístico",
      "desc": "Parte de los recursos propios de cada persona para crecer"
    },
    "emdr": {
      "label": "EMDR",
      "desc": "Procesa recuerdos difíciles o traumáticos para que dejen de pesar como antes"
    },
    "integrativo": {
      "label": "Integrativo",
      "desc": "Combina herramientas de varias escuelas según el caso"
    },
    "coach_ontologico": {
      "label": "Ontológico",
      "desc": "Trabaja sobre cómo hablás, sentís y actuás, para cambiar cómo ves lo que te pasa"
    },
    "coach_sistemico": {
      "label": "Sistémico",
      "desc": "Te mira como parte de tus vínculos y tu entorno, no aislado"
    },
    "coach_cognitivo_conductual": {
      "label": "Cognitivo conductual",
      "desc": "Objetivos concretos y ejercicios entre sesiones"
    },
    "coach_salud_habitos": {
      "label": "De salud y hábitos",
      "desc": "Cambios de hábitos paso a paso, a partir de tus propios motivos"
    },
    "coach_mindfulness": {
      "label": "Con base en mindfulness",
      "desc": "Atención al presente y manejo del estrés"
    },
    "coach_integrativo": {
      "label": "Integrativo",
      "desc": "Combina herramientas según la persona"
    },
    "nutri_sin_dietas": {
      "label": "Sin dietas (alimentación intuitiva)",
      "desc": "Sin restricciones ni culpa: trabaja tu relación con la comida y las señales de hambre y saciedad"
    },
    "nutri_plan": {
      "label": "Con plan alimentario",
      "desc": "Arma un plan con comidas y cantidades, y lo ajusta en cada control"
    },
    "nutri_deportiva": {
      "label": "Deportiva",
      "desc": "Alimentación para entrenar, rendir y recuperarte"
    },
    "nutri_plantas": {
      "label": "Basada en plantas",
      "desc": "Vegetariana o vegana, con todos los nutrientes cubiertos"
    },
    "nutri_condiciones": {
      "label": "Condiciones de salud",
      "desc": "Diabetes, colesterol, hipertensión: acompaña el tratamiento de tu médico, no lo reemplaza"
    }
  },
  "fraseEstilo": {
    "escucha": "Escucha y acompaña, al ritmo de la persona",
    "herramientas": "Da herramientas: ejercicios y tareas concretas entre sesiones",
    "ambos": "Escucha y da herramientas, según lo que necesite cada persona"
  },
  "fraseGuia": {
    "guia": "Propone el camino: marca por dónde empezar y cómo avanzar",
    "acompana": "Sigue el camino de la persona: orienta, y la ruta la decide ella",
    "ambos": "Guía más o menos, según lo que necesite cada persona"
  },
  "focos": {
    "historia": "la historia de la persona",
    "presente": "lo que pasa ahora",
    "rumbo": "el rumbo"
  },
  "gentilicios": {
    "Argentina": [
      "Argentino",
      "Argentina"
    ],
    "Uruguay": [
      "Uruguayo",
      "Uruguaya"
    ],
    "Chile": [
      "Chileno",
      "Chilena"
    ],
    "Paraguay": [
      "Paraguayo",
      "Paraguaya"
    ],
    "Bolivia": [
      "Boliviano",
      "Boliviana"
    ],
    "Perú": [
      "Peruano",
      "Peruana"
    ],
    "Colombia": [
      "Colombiano",
      "Colombiana"
    ],
    "México": [
      "Mexicano",
      "Mexicana"
    ],
    "España": [
      "Español",
      "Española"
    ],
    "Brasil": [
      "Brasileño",
      "Brasileña"
    ],
    "Venezuela": [
      "Venezolano",
      "Venezolana"
    ],
    "Ecuador": [
      "Ecuatoriano",
      "Ecuatoriana"
    ],
    "Cuba": [
      "Cubano",
      "Cubana"
    ],
    "Guatemala": [
      "Guatemalteco",
      "Guatemalteca"
    ],
    "Honduras": [
      "Hondureño",
      "Hondureña"
    ],
    "El Salvador": [
      "Salvadoreño",
      "Salvadoreña"
    ],
    "Panamá": [
      "Panameño",
      "Panameña"
    ],
    "República Dominicana": [
      "Dominicano",
      "Dominicana"
    ],
    "Italia": [
      "Italiano",
      "Italiana"
    ],
    "Francia": [
      "Francés",
      "Francesa"
    ],
    "Alemania": [
      "Alemán",
      "Alemana"
    ],
    "Portugal": [
      "Portugués",
      "Portuguesa"
    ],
    "Costa Rica": [
      "Costarricense",
      "Costarricense"
    ],
    "Nicaragua": [
      "Nicaragüense",
      "Nicaragüense"
    ],
    "Estados Unidos": [
      "Estadounidense",
      "Estadounidense"
    ],
    "Canadá": [
      "Canadiense",
      "Canadiense"
    ]
  }
};

  // Misma salida que lib/tipoProfesional.ts → etiquetaProfesionalPublica.
  function profesion(prof, genero) {
    if (prof === 'psicologia') {
      if (genero === 'Femenino') return 'Psicóloga';
      if (genero === 'Masculino') return 'Psicólogo';
      return 'Psicólogo/a';
    }
    if (prof === 'nutricion') return 'Nutricionista';
    return 'Coach';
  }

  // Misma salida que lib/perfilProfesional.ts → lineaNacionalidad.
  function nacionalidad(pais, genero) {
    var p = String(pais || '').trim();
    if (!p) return null;
    var gt = D.gentilicios[p];
    if (gt && genero === 'Masculino') return gt[0];
    if (gt && genero === 'Femenino') return gt[1];
    if (!gt) {
      for (var k in D.gentilicios) {
        if (D.gentilicios[k][0] === p || D.gentilicios[k][1] === p) return p;
      }
    }
    return 'De ' + p;
  }

  // Misma salida que lib/perfilProfesional.ts → frasesDeTrabajo.
  function frases(estilo, guia, focos) {
    var out = [];
    if (D.fraseEstilo[estilo]) out.push(D.fraseEstilo[estilo]);
    if (D.fraseGuia[guia]) out.push(D.fraseGuia[guia]);
    var sobre = (focos || []).filter(function (f) { return D.focos[f]; }).map(function (f) { return D.focos[f]; });
    if (sobre.length) {
      var lista = sobre.length === 1 ? sobre[0] : sobre.slice(0, -1).join(', ') + ' y ' + sobre[sobre.length - 1];
      out.push('Trabaja sobre ' + lista);
    }
    return out;
  }

  // Misma salida que lib/enfoque.ts → opcionesGuardadas.
  function escuelas(ids) {
    return (ids || []).map(function (id) { return D.escuelas[id] && { id: id, label: D.escuelas[id].label, desc: D.escuelas[id].desc }; }).filter(Boolean);
  }

  g.VitaPerfil = { profesion: profesion, nacionalidad: nacionalidad, frases: frases, escuelas: escuelas };
})(typeof window !== 'undefined' ? window : globalThis);
