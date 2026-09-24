// Nacionalidades, para el selector del perfil y de la postulación (24/09/2026).
//
// 🔴 Se separan de `NATIONALITIES` (constants/searchData.ts) a propósito. Aquella
// lista tiene CINCO países y es el filtro del buscador: son las nacionalidades
// que hoy existen entre los perfiles, y ofrecer más ahí sería ofrecer filtros
// que no devuelven a nadie. Esta es la lista de lo que una persona PUEDE SER, y
// no tiene por qué parecerse.
//
// 📌 Por qué hay dos grupos y no una sola lista alfabética: con la lista completa,
// Argentina queda en la segunda pantalla de scroll, y hoy casi todos los
// profesionales son de acá. Los frecuentes son los de habla hispana de la región
// más España, que es de donde puede venir alguien con matrícula que atienda en
// castellano. El resto está igual de disponible, una búsqueda de por medio.

export const PAISES_FRECUENTES = [
  'Argentina',
  'Uruguay',
  'Chile',
  'Paraguay',
  'Bolivia',
  'Perú',
  'Colombia',
  'México',
  'España',
  'Brasil',
];

export const PAISES_RESTO = [
  'Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda',
  'Arabia Saudita', 'Argelia', 'Armenia', 'Australia', 'Austria', 'Azerbaiyán',
  'Bahamas', 'Bangladés', 'Barbados', 'Baréin', 'Bélgica', 'Belice', 'Benín',
  'Bielorrusia', 'Birmania', 'Bosnia y Herzegovina', 'Botsuana', 'Brunéi',
  'Bulgaria', 'Burkina Faso', 'Burundi', 'Bután', 'Cabo Verde', 'Camboya',
  'Camerún', 'Canadá', 'Catar', 'Chad', 'China', 'Chipre', 'Ciudad del Vaticano',
  'Comoras', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil', 'Costa Rica',
  'Croacia', 'Cuba', 'Dinamarca', 'Dominica', 'Ecuador', 'Egipto', 'El Salvador',
  'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'Estados Unidos',
  'Estonia', 'Esuatini', 'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia',
  'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Granada', 'Grecia', 'Guatemala',
  'Guinea', 'Guinea-Bisáu', 'Guinea Ecuatorial', 'Guyana', 'Haití', 'Honduras',
  'Hungría', 'India', 'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia',
  'Islas Marshall', 'Islas Salomón', 'Israel', 'Italia', 'Jamaica', 'Japón',
  'Jordania', 'Kazajistán', 'Kenia', 'Kirguistán', 'Kiribati', 'Kuwait', 'Laos',
  'Lesoto', 'Letonia', 'Líbano', 'Liberia', 'Libia', 'Liechtenstein', 'Lituania',
  'Luxemburgo', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Malí', 'Malta',
  'Marruecos', 'Mauricio', 'Mauritania', 'Micronesia', 'Moldavia', 'Mónaco',
  'Mongolia', 'Montenegro', 'Mozambique', 'Namibia', 'Nauru', 'Nepal',
  'Nicaragua', 'Níger', 'Nigeria', 'Noruega', 'Nueva Zelanda', 'Omán',
  'Países Bajos', 'Pakistán', 'Palaos', 'Palestina', 'Panamá',
  'Papúa Nueva Guinea', 'Polonia', 'Portugal', 'Reino Unido',
  'República Centroafricana', 'República Checa', 'República del Congo',
  'República Democrática del Congo', 'República Dominicana', 'Ruanda', 'Rumania',
  'Rusia', 'Samoa', 'San Cristóbal y Nieves', 'San Marino',
  'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria',
  'Somalia', 'Sri Lanka', 'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia',
  'Suiza', 'Surinam', 'Tailandia', 'Tanzania', 'Tayikistán', 'Timor Oriental',
  'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía',
  'Tuvalu', 'Ucrania', 'Uganda', 'Uzbekistán', 'Vanuatu', 'Venezuela', 'Vietnam',
  'Yemen', 'Yibuti', 'Zambia', 'Zimbabue',
];

export const PAISES = [...PAISES_FRECUENTES, ...PAISES_RESTO];

/** Sin tildes ni mayúsculas, para que "peru" encuentre "Perú". */
export function normalizarPais(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function buscarPaises(query: string): { frecuentes: string[]; resto: string[] } {
  const q = normalizarPais(query);
  if (!q) return { frecuentes: PAISES_FRECUENTES, resto: PAISES_RESTO };
  const filtra = (xs: string[]) => xs.filter(p => normalizarPais(p).includes(q));
  return { frecuentes: filtra(PAISES_FRECUENTES), resto: filtra(PAISES_RESTO) };
}
