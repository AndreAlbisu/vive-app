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
      { group: 'Emociones y ánimo', items: ['Tristeza', 'Ansiedad', 'Enojo', 'Culpa', 'Vergüenza', 'Alegría'] },
      { group: 'Relaciones', items: ['Pareja', 'Familia', 'Amistades', 'Vínculos laborales'] },
      { group: 'Foco, hábitos y trabajo', items: ['Concentración', 'Procrastinación', 'Productividad', 'Hábitos mentales'] },
    ],
  },
  {
    id: 'crecimiento',
    emoji: '✨',
    label: 'Crecimiento y propósito',
    color: ViveColors.primary,
    bg: '#FDF0E8',
    groups: [
      { group: '', items: ['Propósito', 'Identidad', 'Momentos de cambio', 'Motivación', 'Crecimiento', 'Espiritualidad', 'Soledad'] },
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
