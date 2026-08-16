import { ViveColors } from './theme';

export type Professional = {
  id: string;
  name: string;
  specialty: string;
  type: 'Coach' | 'Psicólogo' | 'Nutricionista';
  topics: string[];
  priceFrom: number;
  rating: number;
  reviews: number;
  sex: 'F' | 'M';
  nationality: string;
};

export type TopicGroup = { group: string; items: string[] };

export type Axis = {
  id: string;
  emoji: string;
  label: string;
  color: string;
  bg: string;
  groups: TopicGroup[];
};

export const AXES: Axis[] = [
  {
    id: 'fisico',
    emoji: '🌿',
    label: 'Bienestar físico',
    color: ViveColors.accent,
    bg: '#E8F5EE',
    groups: [
      { group: '', items: ['Sueño', 'Energía', 'Nutrición', 'Actividad física', 'Hábitos', 'Estrés físico', 'Sexualidad'] },
    ],
  },
  {
    id: 'emocional',
    emoji: '💭',
    label: 'Bienestar emocional y mental',
    color: ViveColors.calm,
    bg: '#E8EFF6',
    groups: [
      { group: 'Emociones y ánimo', items: ['Tristeza', 'Ansiedad', 'Ansiedad social', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría', 'Autoestima', 'Duelo'] },
      { group: 'Relaciones', items: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales', 'Ruptura y separación', 'Comunicación', 'Asertividad'] },
      { group: 'Foco, hábitos y trabajo', items: ['Concentración', 'Procrastinación', 'Productividad', 'Hábitos mentales', 'Burnout (estrés laboral)', 'Equilibrio vida-trabajo', 'Liderazgo'] },
    ],
  },
  {
    id: 'crecimiento',
    emoji: '✨',
    label: 'Crecimiento y propósito',
    color: ViveColors.primary,
    bg: '#FDF0E8',
    groups: [
      { group: '', items: ['Propósito', 'Identidad', 'Momentos de cambio', 'Orientación vocacional', 'Motivación', 'Crecimiento', 'Espiritualidad', 'Soledad'] },
    ],
  },
];

export const PROFESSIONALS: Professional[] = [
  { id: '1', name: 'Laura Méndez',   specialty: 'Coach de vida',       type: 'Coach',         topics: ['Motivación', 'Propósito', 'Identidad', 'Crecimiento'],          priceFrom: 4500, rating: 4.9, reviews: 127, sex: 'F', nationality: 'Argentina' },
  { id: '2', name: 'Martín Fuentes', specialty: 'Psicólogo',           type: 'Psicólogo',     topics: ['Ansiedad', 'Tristeza', 'Pareja', 'Familia'],                    priceFrom: 6000, rating: 4.8, reviews:  89, sex: 'M', nationality: 'Argentina' },
  { id: '3', name: 'Valentina Ríos', specialty: 'Coach ejecutiva',     type: 'Coach',         topics: ['Concentración', 'Procrastinación', 'Motivación', 'Productividad'], priceFrom: 5200, rating: 4.9, reviews: 204, sex: 'F', nationality: 'Uruguay' },
  { id: '4', name: 'Diego Sánchez',  specialty: 'Nutricionista',       type: 'Nutricionista', topics: ['Nutrición', 'Hábitos', 'Energía'],                              priceFrom: 3800, rating: 4.7, reviews:  63, sex: 'M', nationality: 'Argentina' },
  { id: '5', name: 'Ana Gómez',      specialty: 'Psicóloga',           type: 'Psicólogo',     topics: ['Ansiedad', 'Enojo', 'Culpa', 'Familia', 'Amistades'],           priceFrom: 5500, rating: 4.8, reviews: 142, sex: 'F', nationality: 'Colombia' },
  { id: '6', name: 'Carlos Vega',    specialty: 'Coach de bienestar',  type: 'Coach',         topics: ['Sueño', 'Energía', 'Actividad física', 'Estrés físico'],        priceFrom: 4200, rating: 4.6, reviews:  78, sex: 'M', nationality: 'Argentina' },
  { id: '7', name: 'Sofía Herrera',  specialty: 'Nutricionista',       type: 'Nutricionista', topics: ['Nutrición', 'Sueño', 'Estrés físico', 'Hábitos'],               priceFrom: 4000, rating: 4.9, reviews:  95, sex: 'F', nationality: 'México' },
  { id: '8', name: 'Lucas Torres',   specialty: 'Coach de propósito',  type: 'Coach',         topics: ['Propósito', 'Identidad', 'Crecimiento', 'Soledad', 'Momentos de cambio'], priceFrom: 5800, rating: 4.7, reviews: 51, sex: 'M', nationality: 'Argentina' },
  { id: '9', name: 'Isabel Mora',    specialty: 'Psicóloga',           type: 'Psicólogo',     topics: ['Tristeza', 'Culpa', 'Vergüenza', 'Familia', 'Pareja'],          priceFrom: 5000, rating: 4.8, reviews: 113, sex: 'F', nationality: 'España' },
  { id: '10', name: 'Tomás Ruiz',   specialty: 'Coach de hábitos',    type: 'Coach',         topics: ['Hábitos', 'Hábitos mentales', 'Productividad', 'Energía', 'Sueño'], priceFrom: 3500, rating: 4.6, reviews: 44, sex: 'M', nationality: 'Argentina' },
];

export const NATIONALITIES = ['Argentina', 'Colombia', 'México', 'Uruguay', 'España'];
export const MAX_PRICE = 8000;


// ─── Quiz de orientación ─────────────────────────────────────────────────────
// Vive acá y no en `QuizScreen` porque es taxonomía, no interfaz: es el tercer
// mapa que hay que tocar al agregar un subtema (junto con AXES y TOPIC_TO_AREA),
// y tenerlos en el mismo archivo es lo que permite testear que no se
// desincronicen. `icon` es `string` —igual que en `conexionesDoors`— para no
// arrastrar @expo/vector-icons a un archivo de constantes.
export type QuizArea = { id: string; label: string; icon: string; subtemas: string[] };

// ⚠️ El quiz es un mapa GRUESO: cinco opciones que cubren un subconjunto de los
// subtemas canónicos, no la lista entera. Agregar un subtema a `AXES` no obliga
// a agregarlo acá — pero si se omite, ningún camino del quiz lleva a un coach
// que solo trabaje ese tema. `Autoestima` estaba en esa situación desde antes y
// se sumó ahora que además tiene puerta propia.
export const QUIZ_AREAS: QuizArea[] = [
  { id: 'emocion',    label: 'Emociones y ánimo',      icon: 'smile',      subtemas: ['Tristeza','Ansiedad','Enojo','Culpa','Vergüenza','Alegría','Autoestima'] },
  { id: 'relaciones', label: 'Relaciones',              icon: 'heart',      subtemas: ['Pareja','Familia','Amistades','Vínculos laborales','Ruptura y separación','Comunicación','Asertividad'] },
  { id: 'trabajo',    label: 'Trabajo y carrera',       icon: 'briefcase',  subtemas: ['Productividad','Concentración','Procrastinación','Vínculos laborales','Equilibrio vida-trabajo','Liderazgo','Orientación vocacional'] },
  { id: 'salud',      label: 'Salud y bienestar',       icon: 'activity',   subtemas: ['Sueño','Energía','Nutrición','Actividad física','Estrés físico'] },
  { id: 'proposito',  label: 'Propósito y crecimiento', icon: 'compass',    subtemas: ['Propósito','Identidad','Motivación','Crecimiento','Momentos de cambio','Orientación vocacional'] },
];


// ─── Subtema → área de Progreso ──────────────────────────────────────────────
// Tercer mapa de la taxonomía. Vivía en `useProgressStats`; se mudó acá para
// que los tres estén juntos y un test pueda verificar que no se desincronicen —
// que es exactamente el fallo que documenta la regla crítica 19 de SCHEMA.md
// (cuatro subtemas quedaron sin mapear al agregarlos).
export const TOPIC_TO_AREA: Record<string, string> = {
  'Tristeza': 'emocion', 'Ansiedad': 'emocion', 'Enojo': 'emocion',
  'Culpa': 'emocion', 'Vergüenza': 'emocion', 'Alegría': 'emocion', 'Autoestima': 'emocion',
  'Soledad': 'emocion', 'Ansiedad social': 'emocion', 'Duelo': 'emocion',
  'Pareja': 'relaciones', 'Familia': 'relaciones', 'Amistades': 'relaciones', 'Vínculos laborales': 'relaciones',
  'Ruptura y separación': 'relaciones', 'Comunicación': 'relaciones', 'Asertividad': 'relaciones',
  'Productividad': 'trabajo', 'Concentración': 'trabajo', 'Procrastinación': 'trabajo',
  'Hábitos mentales': 'trabajo', 'Burnout (estrés laboral)': 'trabajo',
  'Equilibrio vida-trabajo': 'trabajo', 'Liderazgo': 'trabajo',
  'Sueño': 'salud', 'Energía': 'salud', 'Actividad física': 'salud',
  'Estrés físico': 'salud', 'Hábitos': 'salud', 'Nutrición': 'salud', 'Sexualidad': 'salud',
  'Propósito': 'proposito', 'Identidad': 'proposito', 'Motivación': 'proposito',
  'Crecimiento': 'proposito', 'Momentos de cambio': 'proposito', 'Espiritualidad': 'proposito',
  'Orientación vocacional': 'proposito',
};

