"""
Genera lluvia.wav y bosque.wav como loops de 45 seg para la app.
Usa solo stdlib de Python (sin numpy).
Ejecutar desde la raiz del proyecto: python3 scripts/gen_sounds.py
"""
import wave, struct, random, math, os, sys

RATE   = 22050
SECS   = 45
N      = RATE * SECS

def clamp(v):      return max(-1.0, min(1.0, v))
def db(d):         return 10 ** (d / 20)   # dBFS → linear amplitude

def write_wav(path, samples):
    data = struct.pack(f'<{len(samples)}h', *(int(clamp(s) * 32767) for s in samples))
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(RATE)
        wf.writeframes(data)
    kb = os.path.getsize(path) // 1024
    print(f"  → {os.path.basename(path)}  {len(samples)//RATE}s  {kb} KB")

# ─── Filtros de un polo ─────────────────────────────────────────
def make_lp(fc):
    a = fc / (fc + RATE / (2 * math.pi))
    s = [0.0]
    def filt(x):
        s[0] = s[0] + a * (x - s[0])
        return s[0]
    return filt

def make_hp(fc):
    a = 1 - fc / (fc + RATE / (2 * math.pi))
    s = [0.0]; xp = [0.0]
    def filt(x):
        s[0] = a * (s[0] + x - xp[0])
        xp[0] = x
        return s[0]
    return filt

# ─── Ruido rosa simple (3 integradores en paralelo) ─────────────
def make_pink():
    b = [0.0, 0.0, 0.0]
    def sample():
        w = random.gauss(0, 1)
        b[0] = 0.99886*b[0] + w*0.0555179
        b[1] = 0.99332*b[1] + w*0.0750759
        b[2] = 0.96900*b[2] + w*0.1538520
        return (b[0] + b[1] + b[2] + w*0.5362) * 0.11
    return sample

# ════════════════════════════════════════════════════════════════
# LLUVIA SUAVE
# Ruido rosa filtrado, rango 400-2200 Hz, muy quieto.
# Sin graves pesados; suena a lluvia fina, no a tormenta.
# ════════════════════════════════════════════════════════════════
def gen_lluvia():
    print("Generando lluvia suave...")
    pink  = make_pink()
    lp    = make_lp(2200)
    hp    = make_hp(400)

    out = []
    for i in range(N):
        s = hp(lp(pink()))
        out.append(s)
        if i % 400_000 == 0:
            sys.stdout.write(f"\r  {i*100//N}%  "); sys.stdout.flush()

    # Normalizar a RMS = -22 dBFS — suave pero audible
    rms    = math.sqrt(sum(x*x for x in out) / len(out))
    target = db(-22)
    gain   = target / rms if rms > 0 else 1.0
    print(f"\r  lluvia RMS={rms:.4f}  gain={gain:.2f}  ")
    return [clamp(x * gain) for x in out]


# ════════════════════════════════════════════════════════════════
# BOSQUE
# Diferencia clave respecto a lluvia: el viento NO es constante.
# Va en ráfagas de 1-4 s con silencios de 3-8 s entre ellas.
# Hojas: pequeños pulsos de ruido de alta frecuencia.
# Pájaros: trinos FM claramente audibles.
# ════════════════════════════════════════════════════════════════
def gen_bosque():
    print("Generando bosque...")
    rng = random.Random(7)
    out = [0.0] * N

    # ── 1. Ráfagas de viento ──────────────────────────────────
    lp_wind  = make_lp(600)
    hp_wind  = make_hp(80)
    wind_raw = [rng.gauss(0, 1) for _ in range(N)]
    wind_filt = []
    lps, xp = 0.0, 0.0
    # lowpass
    a_lp = 600 / (600 + RATE / (2 * math.pi))
    for x in wind_raw:
        lps = lps + a_lp * (x - lps)
        wind_filt.append(lps)
    # highpass
    a_hp = 1 - 80 / (80 + RATE / (2 * math.pi))
    hps, xprev = 0.0, 0.0
    wind_bp = []
    for x in wind_filt:
        hps = a_hp * (hps + x - xprev); xprev = x
        wind_bp.append(hps)

    # Envolvente de ráfagas: silencio largo + ráfaga corta
    gust_env = [0.0] * N
    t = 0
    while t < N:
        quiet = rng.randint(int(RATE * 3), int(RATE * 8))   # 3-8 s silencio
        gust  = rng.randint(int(RATE * 1), int(RATE * 4))   # 1-4 s ráfaga
        t += quiet
        if t >= N: break
        amp = rng.uniform(0.5, 1.0)
        for j in range(min(gust, N - t)):
            fade = math.sin(math.pi * j / gust)   # suave entrada y salida
            gust_env[t + j] = fade * amp
        t += gust

    WIND_AMP = db(-18)   # viento más bajo que la lluvia para que no suene igual
    for i in range(N):
        out[i] += wind_bp[i] * gust_env[i] * WIND_AMP

    # ── 2. Hojas (pulsos breves de ruido agudo) ───────────────
    lp_leaf = make_lp(3500)
    hp_leaf = make_hp(1500)
    t = rng.randint(int(RATE * 0.5), int(RATE * 2))
    while t < N:
        dur_s = rng.uniform(0.05, 0.25)
        ln    = min(int(dur_s * RATE), N - t)
        amp   = rng.uniform(0.03, 0.08) * db(-6)
        lps2, xp2 = 0.0, 0.0
        hps2, xprev2 = 0.0, 0.0
        for j in range(ln):
            x = rng.gauss(0, 1)
            lps2 = lps2 + (3500/(3500+RATE/(2*math.pi))) * (x - lps2)
            hps2 = (1-1500/(1500+RATE/(2*math.pi))) * (hps2 + lps2 - xprev2)
            xprev2 = lps2
            env = math.exp(-j / (ln * 0.4)) * min(1.0, j / (RATE * 0.01))
            out[t + j] = clamp(out[t + j] + hps2 * env * amp)
        t += rng.randint(int(RATE * 1), int(RATE * 4))

    # ── 3. Trinos (FM sintético) ──────────────────────────────
    t = rng.randint(int(RATE * 1), int(RATE * 4))
    while t < N:
        dur_s   = rng.uniform(0.06, 0.22)
        cn      = min(int(dur_s * RATE), N - t)
        freq    = rng.uniform(2500, 4500)
        fm_rate = rng.uniform(6, 14)
        fm_dep  = rng.uniform(80, 350)
        amp     = rng.uniform(0.10, 0.20)
        for j in range(cn):
            tl  = j / RATE
            env = math.exp(-tl * 10) * min(1.0, tl * 200)
            f   = freq + fm_dep * math.sin(2 * math.pi * fm_rate * tl)
            out[t + j] = clamp(out[t + j] + env * amp * math.sin(2 * math.pi * f * tl))
        # Pausa variable entre trinos
        t += rng.randint(int(RATE * 3), int(RATE * 10))

    # ── 4. Llamada de pájaro grave ocasional ─────────────────
    t = rng.randint(int(RATE * 8), int(RATE * 18))
    while t < N:
        dur_s = rng.uniform(0.4, 1.2)
        cn    = min(int(dur_s * RATE), N - t)
        freq  = rng.uniform(600, 1200)
        amp   = 0.10
        for j in range(cn):
            tl  = j / RATE
            env = math.exp(-tl * 3) * min(1.0, tl * 30)
            out[t + j] = clamp(out[t + j] + env * amp * math.sin(2 * math.pi * freq * tl))
        t += rng.randint(int(RATE * 12), int(RATE * 25))

    # ── Normalizar a RMS -20 dBFS ─────────────────────────────
    rms    = math.sqrt(sum(x*x for x in out) / len(out))
    target = db(-20)
    gain   = target / rms if rms > 0 else 1.0
    print(f"  bosque RMS={rms:.4f}  gain={gain:.2f}")
    return [clamp(x * gain) for x in out]


if __name__ == '__main__':
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds')
    write_wav(os.path.join(base, 'lluvia.wav'), gen_lluvia())
    write_wav(os.path.join(base, 'bosque.wav'), gen_bosque())
    print("\nListo — ahora correr afconvert.")
