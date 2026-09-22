"""Mide un audio para elegir el mejor tramo de loop sin escucharlo.

Un ambiente bueno para loopear es ESTACIONARIO: energía pareja, sin eventos.
Un ladrido, una voz o un portazo aparecen como un pico de RMS muy por encima
de la mediana. Eso es lo que se busca acá."""
import struct, subprocess, sys, os, tempfile, math

def leer(path):
    wav = os.path.join(tempfile.mkdtemp(), 'x.wav')
    subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100',path,wav],check=True,capture_output=True)
    d = open(wav,'rb').read()
    i, canales, rate, crudo = 12, 2, 44100, b''
    while i + 8 <= len(d):
        c = d[i:i+4]; n = struct.unpack('<I', d[i+4:i+8])[0]; cuerpo = d[i+8:i+8+n]
        if c == b'fmt ': canales, rate = struct.unpack('<HI', cuerpo[2:8])
        elif c == b'data': crudo = cuerpo
        i += 8 + n + (n % 2)
    return struct.unpack(f'<{len(crudo)//2}h', crudo), canales, rate

def rms_por_bloque(m, canales, rate, bloque=0.5):
    paso = int(bloque * rate) * canales
    out = []
    for i in range(0, len(m) - paso, paso):
        s = sum(x*x for x in m[i:i+paso:canales])
        out.append(math.sqrt(s / (paso // canales)))
    return out

def analizar(path, largo=90):
    m, canales, rate = leer(path)
    dur = len(m) / canales / rate
    r = rms_por_bloque(m, canales, rate)
    orden = sorted(r)
    mediana = orden[len(orden)//2] or 1
    picos = sum(1 for x in r if x > mediana * 3)
    silencios = sum(1 for x in r if x < mediana * 0.25)
    print(f'{os.path.basename(path)[:38]:<38} {canales}ch {rate}Hz {dur:>6.0f}s  '
          f'picos={picos:<3} silencios={silencios:<3}', end='')

    # El tramo mas parejo de `largo` segundos
    n = int(largo / 0.5)
    if len(r) <= n:
        print('  (mas corto que el loop pedido)'); return
    mejor, mejor_i = None, 0
    for i in range(0, len(r) - n):
        v = r[i:i+n]
        prom = sum(v)/n
        var = sum((x-prom)**2 for x in v)/n
        punt = (var ** 0.5) / (prom or 1)          # coeficiente de variacion
        if mejor is None or punt < mejor: mejor, mejor_i = punt, i
    print(f'  → mejor tramo desde {mejor_i*0.5:.0f}s (variacion {mejor:.2f})')

for f in sys.argv[1:]:
    analizar(f)
