# Generates the royalty-free music bed for the promo video (pure numpy, no samples).
# Usage: python3 scripts/music.py [seconds] [out.wav]   then: ffmpeg -i out.wav -c:a aac -b:a 160k public/music/bed.m4a
import numpy as np, wave, sys
SR = 44100; BPM = 84; BEAT = 60 / BPM; BAR = 4 * BEAT
TOTAL = float(sys.argv[1]) if len(sys.argv) > 1 else 60.0
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/music/bed.wav'
N = int(TOTAL * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR
midi = lambda m: 440 * 2 ** ((m - 69) / 12)

# I – V – vi – IV in C, warm mid-register voicings
CHORDS = [
    ([60, 64, 67, 71], 36),   # Cmaj7
    ([59, 62, 67, 71], 43),   # G/B
    ([57, 60, 64, 67], 45),   # Am7
    ([57, 60, 65, 69], 41),   # Fmaj7
]
L = np.zeros(N); R = np.zeros(N)

def add(buf_l, buf_r, start, sig, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]
    gl = np.sqrt(0.5 * (1 - pan)); gr = np.sqrt(0.5 * (1 + pan))
    buf_l[i:i + len(sig)] += sig * gl; buf_r[i:i + len(sig)] += sig * gr

def pad_note(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = np.zeros(n)
    for det in (-0.003, 0.0, 0.003):
        f = freq * (1 + det)
        for h, a in ((1, 1.0), (2, 0.28), (3, 0.10), (4, 0.05)):
            sig += a * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6.28))
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 1.1)
    lfo = 1 + 0.08 * np.sin(2 * np.pi * 0.17 * t + rng.uniform(0, 6.28))
    return sig * env * lfo / 12

def pluck(freq, dur=0.9, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * freq * t) * np.exp(-t * 5.5)
           + 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 9)
           + 0.12 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 14))
    click = rng.normal(0, 1, n) * np.exp(-t * 400) * 0.15
    return (sig + click) * vel * 0.22

def bass(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.15 * np.sin(2 * np.pi * freq * 2 * t)
    env = np.minimum(1, t / 0.02) * np.exp(-t * 1.2) * np.minimum(1, (dur - t) / 0.08)
    return np.tanh(sig * 1.5) * env * 0.28

def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 40 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * 0.55

def hat(vel=1.0):
    n = int(0.08 * SR); t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    noise = noise - np.convolve(noise, np.ones(6) / 6, mode='same')   # crude high-pass
    return noise * np.exp(-t * 60) * 0.06 * vel

def shaker(vel=1.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    noise = noise - np.convolve(noise, np.ones(4) / 4, mode='same')
    return noise * np.minimum(1, t / 0.02) * np.exp(-t * 35) * 0.05 * vel

bars = int(np.ceil(TOTAL / BAR)) + 1
for b in range(bars):
    notes, root = CHORDS[b % 4]
    t0 = b * BAR
    for m in notes:
        add(L, R, t0, pad_note(midi(m), BAR + 0.6), pan=rng.uniform(-0.35, 0.35))
    add(L, R, t0, bass(midi(root), 2 * BEAT))
    add(L, R, t0 + 2 * BEAT, bass(midi(root), 2 * BEAT) * 0.8)
    arp = [notes[0], notes[1], notes[2], notes[3], notes[2] + 12, notes[3], notes[2], notes[1]]
    for k in range(8):
        tt = t0 + k * BEAT / 2 + (0.02 if k % 2 else 0)   # light swing
        vel = 0.9 if k % 4 == 0 else 0.6
        add(L, R, tt, pluck(midi(arp[k] + 12), vel=vel), pan=(-0.5 if k % 2 else 0.5))
    if b >= 1:
        add(L, R, t0, kick()); add(L, R, t0 + 2 * BEAT, kick() * 0.85)
        for k in range(8):
            add(L, R, t0 + k * BEAT / 2, shaker(1.0 if k % 2 else 0.55), pan=0.3)
        add(L, R, t0 + BEAT, hat() * 0.8, pan=-0.3); add(L, R, t0 + 3 * BEAT, hat(), pan=-0.3)

# diffuse reverb via FFT convolution with a decaying-noise impulse response
def reverb(x, seed, wet=0.28, length=2.2):
    n = int(length * SR); t = np.arange(n) / SR
    ir = np.random.default_rng(seed).normal(0, 1, n) * np.exp(-t * 2.6)
    ir = np.convolve(ir, np.ones(10) / 10, mode='same')      # darken
    ir /= np.sqrt(np.sum(ir ** 2)) * 6
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x + wet * y

L = reverb(L, 11); R = reverb(R, 12)
mix = np.stack([L, R])
mix = np.tanh(mix * 1.1) / 1.1
mix *= 0.85 / np.max(np.abs(mix))
fade = np.minimum(1, t_all / 0.6)
mix *= fade
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T.reshape(-1)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(OUT, TOTAL, 's')
