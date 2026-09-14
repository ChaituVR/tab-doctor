# Synthesizes the tiny UI sound effects used by the promo video (pure numpy).
# Usage: python3 scripts/sfx.py
import numpy as np, wave, os
SR = 44100
rng = np.random.default_rng(3)
os.makedirs('public/sfx', exist_ok=True)

def env(n, a=0.002, d=0.08):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def hp(x, k=8):
    return x - np.convolve(x, np.ones(k) / k, mode='same')

def lp(x, k=24):
    return np.convolve(x, np.ones(k) / k, mode='same')

def write(name, x, peak=0.7):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(f'public/sfx/{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

# tab closes: short downward blip
n = int(0.12 * SR); t = np.arange(n) / SR
f = 720 * np.exp(-t * 18) + 240
write('pop', np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.035) + hp(rng.normal(0, 1, n)) * env(n, 0.001, 0.01) * 0.3)

# collapse / fly away: band-limited noise swell
n = int(0.42 * SR); t = np.arange(n) / SR
noise = lp(hp(rng.normal(0, 1, n), 4), 6)
write('whoosh', noise * np.sin(np.pi * t / t[-1]) ** 2 * (0.4 + 0.6 * (1 - t / t[-1])), 0.45)

# mouse click: two tiny ticks (down, up)
n = int(0.07 * SR)
tick = lambda: hp(rng.normal(0, 1, int(0.012 * SR)), 3) * env(int(0.012 * SR), 0.0005, 0.003)
x = np.zeros(n); d = tick(); u = tick() * 0.6
x[: len(d)] += d; x[int(0.045 * SR): int(0.045 * SR) + len(u)] += u
write('click', x, 0.5)

# toggle switch: tick + soft thump
n = int(0.12 * SR); t = np.arange(n) / SR
write('switch', hp(rng.normal(0, 1, n), 3) * env(n, 0.0005, 0.006) + np.sin(2 * np.pi * 180 * t) * env(n, 0.003, 0.03) * 0.8, 0.55)

# tab comes back: two-note bell
n = int(0.9 * SR); t = np.arange(n) / SR
bell = lambda f0, at: np.where(t >= at, (np.sin(2 * np.pi * f0 * (t - at)) + 0.3 * np.sin(2 * np.pi * f0 * 2.01 * (t - at)) + 0.12 * np.sin(2 * np.pi * f0 * 3 * (t - at))) * np.exp(-(t - at) * 5), 0)
write('chime', bell(659.25, 0) + bell(880, 0.11), 0.5)

# keyboard typing loop for the code line (≈1.9 s)
n = int(1.9 * SR); x = np.zeros(n); pos = 0.0
while pos < 1.85:
    k = hp(rng.normal(0, 1, int(0.02 * SR)), 3) * env(int(0.02 * SR), 0.0005, 0.005) * rng.uniform(0.4, 1)
    i = int(pos * SR); x[i:i + len(k)] += k[: n - i]
    pos += rng.uniform(0.045, 0.11)
write('typing', x, 0.35)
print(sorted(os.listdir('public/sfx')))
