"""
Prepara un sonido ambiente para la app: lo recorta, lo hace loopear sin costura,
lo normaliza y lo encodea.

    python3 scripts/procesar-sonidos.py fuente.wav lluvia [segundos]

El largo por defecto son 85 segundos. Se puede pedir otro si la grabación
original es más corta, pero cuanto más largo el loop, menos se nota que es
un loop: por debajo de un minuto el oído lo engancha enseguida.

🔴 **Por qué existe.** Los cuatro sonidos de `RuidoScreen` están en **mono, 22 kHz
y 63 kbps**, y encima re-encodeados sobre un corte que ya venía a 31 kbps. Para
lluvia, olas y bosque eso es lo peor posible: casi todo lo que hace que suenen
como un lugar vive ARRIBA de los 11 kHz, y a 22 kHz de muestreo eso no existe.
Por eso suenan sordos y "de parlante". Dos sesiones anteriores llegaron a la
misma conclusión y la anotaron: hay que volver a la fuente y re-exportar. Esto es
esa herramienta, para que el único paso humano sea bajar los archivos.

⚠️ **Lo que este script NO puede hacer**: recuperar lo que el corte comprimido ya
tiró. Hay que partir del original de freesound (WAV o FLAC), no de los .m4a que
están hoy en `assets/sounds/`. Upsamplear un 22 kHz a 48 no inventa nada.

Usa solo la stdlib de Python y `afconvert`, que viene con macOS. Sin ffmpeg.
"""
import math, os, struct, subprocess, sys, tempfile, wave

# ── Lo que queremos del otro lado ────────────────────────────────────────────
# 📌 44.1 kHz estéreo a 128 kbps: para ambiente es transparente y pesa ~1,3 MB
# por sonido. Los cuatro pasan de 2,6 MB a ~5 MB en el bundle, que es el precio
# de que dejen de sonar a grabación de contestador.
SALIDA_HZ   = 44100
SALIDA_KBPS = 128
LARGO_SEG   = 85     # el cuerpo del loop
CROSS_SEG   = 2.0    # la costura


def a_wav(fuente: str) -> str:
    """Cualquier cosa que afconvert entienda (wav, flac, aiff, mp3) → WAV 16 bit."""
    destino = os.path.join(tempfile.mkdtemp(), 'fuente.wav')
    subprocess.run(
        ['afconvert', '-f', 'WAVE', '-d', f'LEI16@{SALIDA_HZ}', fuente, destino],
        check=True, capture_output=True)
    return destino


def leer(path: str):
    """
    Lee el RIFF a mano en vez de usar `wave`.

    🔴 No es por gusto: `afconvert` escribe WAVE_FORMAT_EXTENSIBLE (tag 65534)
    y el módulo `wave` de la stdlib lo rechaza con `unknown format: 65534`,
    aunque adentro sean PCM 16 bits comunes y corrientes. Parsear los dos chunks
    que importan son veinte líneas y evita depender de cómo se sienta afconvert.
    """
    with open(path, 'rb') as f:
        datos = f.read()
    if datos[:4] != b'RIFF' or datos[8:12] != b'WAVE':
        raise SystemExit('eso no es un WAV')

    canales = rate = bits = None
    crudo = None
    i = 12
    while i + 8 <= len(datos):
        chunk = datos[i:i + 4]
        largo = struct.unpack('<I', datos[i + 4:i + 8])[0]
        cuerpo = datos[i + 8:i + 8 + largo]
        if chunk == b'fmt ':
            canales, rate = struct.unpack('<HI', cuerpo[2:8])
            bits = struct.unpack('<H', cuerpo[14:16])[0]
        elif chunk == b'data':
            crudo = cuerpo
        i += 8 + largo + (largo % 2)   # los chunks se alinean a 2 bytes

    if crudo is None or bits is None:
        raise SystemExit('al WAV le falta fmt o data')
    if bits != 16:
        raise SystemExit(f'esperaba 16 bits, vino {bits}')
    muestras = struct.unpack(f'<{len(crudo) // 2}h', crudo)
    return list(muestras), canales, rate


def escribir(path: str, muestras, canales: int, rate: int):
    with wave.open(path, 'wb') as w:
        w.setnchannels(canales); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(struct.pack(f'<{len(muestras)}h',
                                  *(max(-32768, min(32767, int(s))) for s in muestras)))


def loop_sin_costura(muestras, canales, rate):
    """
    Dobla la cola sobre la cabeza con un crossfade de potencia constante.

    🔴 **Potencia constante (`sqrt`) y no lineal.** Dos ruidos distintos no están
    correlacionados: sumándolos con rampas lineales, la energía en el cruce cae
    ~3 dB y se oye un bajón cada vez que el loop vuelve a empezar. Con `sqrt` la
    energía se mantiene y la costura desaparece. Es el mismo arreglo que se hizo
    a mano el 15/09/2026, acá automatizado.
    """
    cuerpo = int(LARGO_SEG * rate) * canales
    cruce  = int(CROSS_SEG * rate) * canales
    if len(muestras) < cuerpo + cruce:
        raise SystemExit(f'la fuente dura menos de {LARGO_SEG + CROSS_SEG:.0f}s')

    salida = muestras[:cuerpo]
    cola   = muestras[cuerpo:cuerpo + cruce]

    for i in range(cruce):
        t = (i // canales) / (cruce // canales)   # 0 → 1 a lo largo del cruce
        salida[i] = salida[i] * math.sqrt(t) + cola[i] * math.sqrt(1 - t)
    return salida


def normalizar(muestras, pico_dbfs=-1.0):
    """Al mismo nivel los cuatro: si uno entra más fuerte, se lee como 'mejor'."""
    pico = max(abs(s) for s in muestras) or 1
    objetivo = 32767 * (10 ** (pico_dbfs / 20))
    factor = objetivo / pico
    return [s * factor for s in muestras]


def main():
    if len(sys.argv) not in (3, 4):
        raise SystemExit(__doc__)
    fuente, nombre = sys.argv[1], sys.argv[2]
    global LARGO_SEG
    if len(sys.argv) == 4:
        LARGO_SEG = float(sys.argv[3])

    wav = a_wav(fuente)
    muestras, canales, rate = leer(wav)
    print(f'  fuente: {canales} canal(es), {rate} Hz, {len(muestras)//canales/rate:.1f}s')
    if canales == 1:
        print('  ⚠️  la fuente es MONO. Se puede usar, pero la mitad del problema '
              'que venimos a arreglar es justamente que no hay estéreo.')

    muestras = normalizar(loop_sin_costura(muestras, canales, rate))

    tmp_wav = os.path.join(tempfile.mkdtemp(), f'{nombre}.wav')
    escribir(tmp_wav, muestras, canales, rate)

    destino = os.path.join('assets', 'sounds', f'{nombre}.m4a')
    subprocess.run(
        ['afconvert', '-f', 'm4af', '-d', 'aac', '-b', str(SALIDA_KBPS * 1000),
         '-q', '127', '-s', '3', tmp_wav, destino],
        check=True, capture_output=True)
    kb = os.path.getsize(destino) // 1024
    print(f'  → {destino}  {LARGO_SEG:.0f}s  {kb} KB  ({canales} ch, {rate} Hz, {SALIDA_KBPS} kbps)')


if __name__ == '__main__':
    main()
