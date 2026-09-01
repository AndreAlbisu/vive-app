// Configuración que los tests necesitan antes de importar nada.
//
// 🔴 `EXPO_PUBLIC_ENCRYPTION_KEY`: `lib/encryption.ts` dejó de tener un fallback
// hardcodeado (era `'vive_mvp_key_2026'`, versionada en este mismo repo, así
// que un build sin la variable "cifraba" con una clave pública sin avisar).
// Jest no carga `.env`, así que sin esto los tests de ida y vuelta del cifrado
// no tendrían clave con la que trabajar.
//
// 📝 El valor es de juguete y no tiene que coincidir con el de producción: los
// tests solo verifican que cifrar y descifrar sean inversos entre sí.
process.env.EXPO_PUBLIC_ENCRYPTION_KEY =
  process.env.EXPO_PUBLIC_ENCRYPTION_KEY ?? 'clave_de_test_no_es_la_de_produccion';
