"""
Genera lluvia.wav y bosque.wav como loops de 45 seg para la app.
Usa solo stdlib de Python (sin numpy).
Ejecutar: python3 scripts/gen_sounds.py
"""
import wave, struct, random, math, os, sys

RATE   = 22050
SECS   = 45
N      = RATE * SECS
MAX16  = 32767

def clamp(v): return max(-1.0, min(1.0, v))

def write_wav(path, samples):
    data = struct.pack(f'<{len(samples)}h', *(int(clamp(s) * MAX16) for s in samples))
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(data)
    print(f"  OK {path} ({len(samples)/RATE:.0f}s, {os.path.getsize(path)//1024} KB)")

def lp(prev, x, alpha):
    """One-pole lowpass — llamar en loop."""
    return prev + alpha * (x - prev)

def hp(prev_out, prev_in, x, alpha):
    """One-pole highpass."""
    return alpha * (prev_out + x - prev_in)


# ─────────────────────────────────────────────
# LLUVIA SUAVE
# Brown noise (integral of white) + bandpass 200-2500 Hz
# Sin componentes graves pesados ni transitorios bruscos.
# ─────────────────────────────────────────────
def gen_lluvia():
    print("Generando lluvia suave...")
    alpha_lp = 2500 / (2500 + RATE / (2 * math.pi))
    alpha_hp = 200  / (200  + RATE / (2 * math.pi))

    out    = []
    brown  = 0.0
    lp_s   = 0.0
    hp_s   = 0.0
    prev_x = 0.0

    for i in range(N):
        w = random.gauss(0, 1)
        brown = clamp(brown * 0.998 + w * 0.025)
        lp_s  = lp(lp_s, brown, alpha_lp)
        hp_s  = hp(hp_s, prev_x, lp_s, 1 - alpha_hp)
        prev_x = lp_s

        # Slow rain-texture AM (0.08 Hz) — very subtle
        am = 0.88 + 0.12 * math.sin(2 * math.pi * 0.08 * i / RATE)
        out.append(hp_s * am)

        if i % 500_000 == 0:
            sys.stdout.write(f"\r  {i*100//N}%  ")
            sys.stdout.flush()

    # Normalise to -12 dBFS (≈ 0.25 peak)
    peak = max(abs(s) for s in out) or 1
    return [s / peak * 0.25 for s in out]


# ─────────────────────────────────────────────
# BOSQUE
# Viento (ruido rosa filtrado + AM lenta) + trinos (FM sintético)
# ─────────────────────────────────────────────
def gen_bosque():
    print("\nGenerando bosque...")

    # — Viento —
    alpha_wind_lp = 600 / (600 + RATE / (2 * math.pi))
    alpha_wind_hp = 80  / (80  + RATE / (2 * math.pi))

    wind  = []
    lp_w  = 0.0
    hp_w  = 0.0
    prx_w = 0.0
    for i in range(N):
        w    = random.gauss(0, 1)
        lp_w = lp(lp_w, w * 0.06, alpha_wind_lp)
        hp_w = hp(hp_w, prx_w, lp_w, 1 - alpha_wind_hp)
        prx_w = lp_w
        am = 0.5 + 0.5 * math.sin(2 * math.pi * 0.15 * i / RATE)
        wind.append(hp_w * am * 0.55)

        if i % 500_000 == 0:
            sys.stdout.write(f"\r  viento {i*100//N}%  ")
            sys.stdout.flush()

    # — Trinos —
    chirps = [0.0] * N
    rng    = random.Random(42)

    t = rng.randint(RATE * 2, RATE * 6)
    while t < N - RATE:
        dur   = rng.uniform(0.08, 0.30)
        cn    = min(int(dur * RATE), N - t)
        freq  = rng.uniform(2200, 4800)
        fm    = rng.uniform(100, 500)
        amp   = rng.uniform(0.06, 0.14)
        for j in range(cn):
            tl  = j / RATE
            env = math.exp(-tl * 9) * min(1.0, tl * 120)
            f   = freq + fm * math.sin(2 * math.pi * 7 * tl)
            chirps[t + j] += env * amp * math.sin(2 * math.pi * f * tl)
        t += rng.randint(RATE * 4, RATE * 12)

    out = [wind[i] + chirps[i] for i in range(N)]
    peak = max(abs(s) for s in out) or 1
    return [s / peak * 0.30 for s in out]


if __name__ == '__main__':
    base = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
    os.makedirs(base, exist_ok=True)

    write_wav(os.path.join(base, 'lluvia.wav'), gen_lluvia())
    write_wav(os.path.join(base, 'bosque.wav'), gen_bosque())
    print("\nListo. Ahora convertir a M4A con afconvert.")
