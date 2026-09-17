// VersionGate — la pantalla que aparece cuando la versión instalada ya no alcanza.
//
// Se monta una sola vez en `app/_layout.tsx`, por encima de todo el Stack. No
// frena el arranque: la app abre normal y el chequeo corre en paralelo; solo si
// vuelve diciendo que hay que actualizar, tapa la pantalla. Se vuelve a chequear
// cada vez que la app vuelve al frente, para alcanzar también a quien la deja
// abierta días.
//
// 🔴 No tiene botón para cerrarla. Es a propósito: se usa solo cuando la versión
// vieja está rota (cobra mal, expone datos). Si se pudiera saltear, no serviría
// para lo único para lo que existe. Ver `scripts/add-app-version-gate.sql`.

import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { chequearVersion, type BloqueoDeVersion } from '@/lib/appVersion';

export function VersionGate() {
  const [bloqueo, setBloqueo] = useState<BloqueoDeVersion | null>(null);

  useEffect(() => {
    let vivo = true;
    const chequear = () => { chequearVersion().then(r => { if (vivo) setBloqueo(r); }); };
    chequear();
    const sub = AppState.addEventListener('change', estado => { if (estado === 'active') chequear(); });
    return () => { vivo = false; sub.remove(); };
  }, []);

  if (!bloqueo) return null;

  const tienda = Platform.OS === 'ios' ? 'la App Store' : 'Google Play';

  return (
    <View style={s.fondo} accessibilityViewIsModal>
      <View style={s.caja}>
        <Text style={s.titulo}>Hay una versión nueva de VIVE</Text>
        <Text style={s.cuerpo}>
          Para seguir usando la app necesitás actualizarla. Es un minuto, y no perdés nada de lo tuyo.
        </Text>
        {/* El porqué, si lo cargaron. Bloquear a alguien sin decirle nada se
            lee como que la app se rompió. */}
        {!!bloqueo.mensaje && <Text style={s.mensaje}>{bloqueo.mensaje}</Text>}

        {bloqueo.storeUrl ? (
          <TouchableOpacity
            style={s.boton}
            activeOpacity={0.85}
            onPress={() => { Linking.openURL(bloqueo.storeUrl!).catch(() => {}); }}
            accessibilityRole="button">
            <Text style={s.botonTexto}>Actualizar en {tienda}</Text>
          </TouchableOpacity>
        ) : (
          // Sin link todavía (la App Store no lo tiene hasta publicar): se le
          // dice dónde buscarla en vez de mostrar un botón que no hace nada.
          <Text style={s.mensaje}>Buscá VIVE en {tienda} y actualizala desde ahí.</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: ViveColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  caja: { maxWidth: 420, width: '100%', gap: 14 },
  titulo: { fontFamily: ViveFonts.title, fontSize: 26, lineHeight: 32, color: ViveColors.accent },
  cuerpo: { fontFamily: ViveFonts.regular, fontSize: 15.5, lineHeight: 23, color: ViveColors.text },
  mensaje: { fontFamily: ViveFonts.medium, fontSize: 14, lineHeight: 21, color: ViveColors.calm },
  boton: {
    marginTop: 10,
    backgroundColor: ViveColors.primaryInk,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  botonTexto: { fontFamily: ViveFonts.semibold, fontSize: 15.5, color: ViveColors.onPrimaryInk },
});
