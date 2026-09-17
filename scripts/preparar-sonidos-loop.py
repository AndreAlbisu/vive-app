"""
Prepara los ambientales de assets/sounds/ para que loopeen sin que se note la vuelta.

El problema que arregla (medido el 15/09/2026): los cortes originales de freesound
empezaban con un fade largo y terminaban a volumen pleno, así que cada vuelta del loop
—cada 90s, hasta 20 veces en una sesión de 30 min— el ambiente se caía a silencio y
volvía de a poco. lluvia tardaba 3.981 ms en recuperar el 50% del nivel; blanco, 3.073;
olas, 738. El salto de muestra a muestra en la costura, en cambio, nunca fue el problema:
queda por debajo del ruido propio del material (0,05–0,63× el delta p99), o sea que no
hay "click" que arreglar.

Qué hace, por archivo:
  1. recorta la entrada hasta donde una ventana de 100 ms llega al 70% del nivel global;
  2. cierra la costura con un crossfade equal-power de 2 s (la cola sale mientras la
     cabeza entra, con sin/cos para que el RMS no se hunda en el cruce — con ruido de
     banda ancha un crossfade lineal sí deja un pozo audible);
  3. re-encodea a AAC 64 kbps (los originales venían a 31: subir el bitrate acá es para
     no acumular pérdida en la segunda generación, no para ganar calidad que no está).

No toca sample rate ni canales: los archivos son mono 22 kHz y upsamplear no inventa
lo que el corte original ya tiró. Eso se arregla re-exportando desde la fuente, no acá.

Uso, desde la raíz del proyecto:  python3 scripts/preparar-sonidos-loop.py
Necesita afconvert (macOS). Reescribe los .m4a in situ — revisá el diff antes de commitear.
No es idempotente: correrlo dos veces recorta otros 2 s de crossfade sobre archivos que
ya loopean bien. Si hay que rehacerlo, partí de los archivos originales (git checkout).
"""
import math
import os
import struct
import subprocess
import sys
import tempfile

SONIDOS  = ["lluvia", "bosque", "olas", "blanco"]
DIR      = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")
XFADE_S  = 2.0    # largo del crossfade en la costura
UMBRAL   = 0.70   # del nivel global: dónde se considera que el archivo "ya arrancó"
BITRATE  = 64000


def leer_wav(path):
    """Parser propio: wave.open() rechaza el WAVE_FORMAT_EXTENSIBLE que escribe afconvert."""
    b = open(path, "rb").read()
    i, fmt, data = 12, None, None
    while i < len(b) - 8:
        cid = b[i:i + 4]
        sz  = struct.unpack("<I", b[i + 4:i + 8])[0]
        if   cid == b"fmt ":  fmt  = b[i + 8:i + 8 + sz]
        elif cid == b"data":  data = b[i + 8:i + 8 + sz]
        i += 8 + sz + (sz & 1)
    canales = struct.unpack("<H", fmt[2:4])[0]
    rate    = struct.unpack("<I", fmt[4:8])[0]
    n = len(data) // 2
    s = list(struct.unpack("<%dh" % n, data[:n * 2]))
    if canales == 2:
        s = [(s[j] + s[j + 1]) // 2 for j in range(0, len(s) - 1, 2)]
    return rate, s


def escribir_wav(path, rate, s):
    d = struct.pack("<%dh" % len(s),
                    *[max(-32768, min(32767, int(round(x)))) for x in s])
    hdr = (b"RIFF" + struct.pack("<I", 36 + len(d)) + b"WAVEfmt "
           + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
           + b"data" + struct.pack("<I", len(d)))
    open(path, "wb").write(hdr + d)


def rms(a):
    return math.sqrt(sum(x * x for x in a) / len(a)) if a else 0.0


def preparar(nombre, tmp):
    fuente = os.path.join(DIR, nombre + ".m4a")
    crudo  = os.path.join(tmp, nombre + ".wav")
    listo  = os.path.join(tmp, nombre + "_fix.wav")

    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16", fuente, crudo], check=True)
    rate, s = leer_wav(crudo)
    nivel = rms(s[::11])

    ventana = int(rate * 0.100)
    recorte = 0
    for j in range(0, len(s) - ventana, ventana):
        if rms(s[j:j + ventana]) >= UMBRAL * nivel:
            recorte = j
            break

    a = s[recorte:]
    x = int(rate * XFADE_S)
    m = len(a) - x
    b = a[:m]
    for j in range(x):
        t = j / (x - 1)
        b[j] = a[j] * math.sin(t * math.pi / 2) + a[m + j] * math.cos(t * math.pi / 2)

    escribir_wav(listo, rate, b)
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE),
                    listo, fuente], check=True)
    print(f"{nombre}: recorte de entrada {recorte / rate:.2f}s · "
          f"{len(s) / rate:.2f}s → {len(b) / rate:.2f}s · "
          f"{os.path.getsize(fuente) // 1024} KB")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for nombre in (sys.argv[1:] or SONIDOS):
            preparar(nombre, tmp)
