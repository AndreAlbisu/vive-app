// Desde qué sitio web un navegador puede llamar a las funciones (24/09/2026).
//
// Hasta hoy era `*`: cualquier sitio. No era un agujero —las funciones piden el
// token de la sesión en un encabezado, y otro sitio no lo tiene—, pero no había
// motivo para aceptarlo. La app no usa CORS (no es un navegador), así que esto
// solo afecta a la web, que corre siempre en `www` (el dominio pelado redirige).
//
// ⚠️ Probar las páginas web desde `localhost` o una preview de Vercel va a dar
// error de CORS contra producción. Es esperado.
export const WEB_ORIGIN = 'https://www.vitaapp.com.ar'
