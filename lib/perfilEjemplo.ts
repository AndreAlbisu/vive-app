// Un perfil de profesional DE EJEMPLO, para mostrar la app (pitch, amigos,
// profesionales, inversores) sin inventar nada en la base.
//
// 🔴 Por qué acá y no en Supabase (Andre, 01/10/2026): un perfil ficticio en
// producción aparece en el catálogo, en su link /c/ y en las recomendaciones;
// y una reseña exige una sesión completada con asistencia, o sea inventar una
// reserva pagada en las tablas de pagos. Acá la pantalla del perfil carga estos
// datos fijos en vez de consultar, se presenta como "Perfil de ejemplo" y no
// deja reservar, guardar ni reportar.
//
// Se abre con `/profesional?profileId=ejemplo` (también por el link
// `viveapp://profesional?profileId=ejemplo`).
//
// La persona no existe: el nombre es inventado y la matrícula es "MN 00000"
// a propósito, para que no coincida con la de nadie. Mismo criterio que la
// landing, que muestra un "Profesional de ejemplo" y aclara que los datos son
// de ejemplo.

import type { PublicCredential } from './credentialRules';

export const PERFIL_EJEMPLO_ID = 'ejemplo';

export function esPerfilEjemplo(profileId: string | null | undefined): boolean {
  return profileId === PERFIL_EJEMPLO_ID;
}

export const PERFIL_EJEMPLO = {
  name: 'Lucía Benítez',
  genero: 'Femenino',
  profesion: 'psicologia',
  nationality: 'Argentina',
  // Una foto de alguien que dio permiso, o de banco con licencia libre. Vacía
  // hasta tenerla: el perfil muestra el ícono de persona.
  avatar_url: null as string | null,
  video_url: null as string | null,
  bio:
    'Soy psicóloga y acompaño a personas que atraviesan ansiedad, momentos de cambio o cansancio emocional. ' +
    'Me gusta que la sesión sea un lugar tranquilo, donde puedas hablar a tu ritmo y salir con algo concreto para la semana. ' +
    'Trabajo con adultos hace ocho años, en consultorio y online.',
  topics: ['Ansiedad', 'Momentos de cambio', 'Autoestima', 'Vínculos', 'Tristeza', 'Burnout (estrés laboral)'],
  estilo: 'ambos',
  guia: 'ambos',
  focos: ['presente', 'historia'],
  enfoques: ['cognitivo_conductual', 'integrativo'],
  priceFrom: 18000,
  priceUsd: 25,
  acceptsInternational: true,
  acceptsMp: true,
  acceptsPaypal: true,
  acceptsUsdt: false,
};

export const CREDENCIALES_EJEMPLO: PublicCredential[] = [
  {
    id: 'ejemplo-titulo',
    kind: 'titulo',
    title: 'Licenciatura en Psicología',
    institution: 'Universidad pública',
    year: 2016,
    registrationNumber: null,
  },
  {
    id: 'ejemplo-matricula',
    kind: 'matricula',
    title: 'Matrícula Nacional',
    institution: 'Ministerio de Salud',
    year: 2017,
    registrationNumber: 'MN 00000',
    profesion: 'psicologia',
  },
];

// Ya firmadas como las firma `firmaDeResena`: nombre e inicial.
export const RESENAS_EJEMPLO = [
  {
    rating: 5,
    comment: 'Me sentí escuchada desde la primera sesión. Salí con dos o tres cosas concretas para probar en la semana.',
    reviewerName: 'Martina G.',
  },
  {
    rating: 5,
    comment: 'Tenía miedo de arrancar terapia online y fue mucho más cercano de lo que pensaba.',
    reviewerName: 'Juan P.',
  },
  {
    rating: 4,
    comment: 'Muy clara para explicar lo que me pasaba. Me ayudó a ordenar un momento de mucho cambio.',
    reviewerName: 'Alguien de Vita',
  },
];

export const AVISO_EJEMPLO = {
  titulo: 'Perfil de ejemplo',
  texto: 'Así se ve un perfil en Vita. Los datos son ilustrativos: esta persona no existe, así que no se puede reservar, guardar ni reportar.',
};
