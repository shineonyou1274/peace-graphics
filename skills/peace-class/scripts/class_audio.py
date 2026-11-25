"""peace-class 소리 — 수업 영상의 배경음 · 효과음 · 나레이션을 한 파일로 섞는다.

악기는 Shiny Peace Studio 의 videointro 음악 엔진(compose.py)의 Kit 를 그대로 쓴다.
효과음은 화면의 사건(build/info.json 의 HITS)에 맞춰 난다: 점이 나타나면 톡, 그래프가 그려지면 오르는 소리, 틀린 말엔 낮은 버저.

usage: python3 class_audio.py <작업 폴더>          → <작업 폴더>/build/music.wav
분위기(lesson.json "mood"): calm(기본 · 잔잔한 로파이) · bright(밝고 통통) · serious(무거운 주제: 단조 · 낮은 현 · 심장 박동)
나레이션: 장면에 "voice": "voice/01.wav" 를 적으면 그 장면 시작 0.35초 뒤에 깔고, 말하는 동안 배경음을 낮춘다.
"""
import json
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose as C  # noqa: E402

SR = C.SR
work = sys.argv[1]
info = json.load(open(os.path.join(work, 'build/info.json'), encoding='utf-8'))
lesson = json.load(open(os.path.join(work, 'lesson.json'), encoding='utf-8'))
MOOD = lesson.get('mood', 'calm')
seed = int(lesson.get('seed', 7))
rng = np.random.default_rng(seed)
K = C.Kit(rng)
DUR = info['DUR'] + 0.8
N = int(DUR * SR)
bed = np.zeros(N)      # 배경음
fx = np.zeros(N)       # 효과음
vo = np.zeros(N)       # 나레이션


def put(buf, sig, t, g=1.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    s = sig[max(0, -i):]
    i = max(0, i)
    n = min(len(s), len(buf) - i)
    buf[i:i + n] += s[:n] * g


P = {'calm': dict(bpm=84, key='bright'), 'bright': dict(bpm=100, key='bright'), 'serious': dict(bpm=70, key='dark')}[MOOD]
beat = 60 / P['bpm']
bar = beat * 4
end_t = next((h['t'] for h in info['HITS'] if h['kind'] == 'end'), info['DUR'] - 1.0)

# ---------------- 배경음 ----------------
nb = int(np.ceil(DUR / bar))
for b in range(nb):
    t0 = b * bar
    ch = C.chord_notes(b, P['key'])
    if t0 > end_t + bar:
        break
    if MOOD == 'serious':
        put(bed, K.strings([m + 12 for m in ch], bar * 1.05), t0, 0.55)
        put(bed, K.sub(ch[0] - 12, bar * 0.9), t0, 0.35)
        if b >= 1 and t0 < end_t:
            put(bed, K.heartbeat(), t0, 0.5)
            put(bed, K.heartbeat(), t0 + beat * 2, 0.35)
        continue
    put(bed, K.keys([m + 12 for m in ch], bar * 0.98), t0, 0.5)
    put(bed, K.sub(ch[0] - 12, bar * 0.9), t0, 0.28)
    if MOOD == 'bright':
        for k in range(8):  # 8분음표 뜯기
            put(bed, K.pluck(ch[k % 3] + 24, 0.22, 3200), t0 + k * beat / 2, 0.22)
    if b == 0 or t0 >= end_t:
        continue  # 첫 마디와 끝에는 북을 쉰다
    sw = beat / 2 * 0.12  # 살짝 흔들리는 박(스윙)
    for k in range(4):
        tb = t0 + k * beat
        if k in (0, 2):
            put(bed, K.kick(0.7), tb, 0.42 if MOOD == 'calm' else 0.55)
        else:
            put(bed, K.rim() if MOOD == 'calm' else K.clap(), tb, 0.28)
        put(bed, K.hat(), tb, 0.10)
        put(bed, K.hat(), tb + beat / 2 + sw, 0.07)
if MOOD == 'calm':
    put(bed, K.vinyl(DUR), 0, 0.8)
# 끝: 마지막 화음을 길게
put(bed, K.pad([m + 12 for m in C.chord_notes(0, P['key'])], 3.2), end_t, 0.5)

# ---------------- 효과음 ----------------
SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86] if P['key'] == 'bright' else [62, 65, 67, 69, 72, 74, 77, 79, 81]
hop = 0


def swish(length, lo, hi, a=0.02, d=0.12):
    n = int(length * SR)
    return C.filt(K.noise(n), 'bandpass', [lo, hi]) * C.env(n, a, d)


def buzz(m, length=0.16):
    n = int(length * SR)
    x = C.filt(C.saw(C.hz(m), n) + C.saw(C.hz(m), n, 0.01), 'lowpass', 900)
    return x * C.env(n, 0.004, length * 0.6) * 0.5


def scratch(length):
    n = int(length * SR)
    tt = np.arange(n) / SR
    x = C.filt(K.noise(n), 'highpass', 2800) * (0.55 + 0.45 * np.sin(2 * np.pi * 13 * tt) ** 2)
    e = np.minimum(1, tt / 0.05) * np.minimum(1, (length - tt) / 0.1)
    return x * e * 0.5


for h in info['HITS']:
    t, k = h['t'], h['kind']
    dark = MOOD == 'serious'
    if k == 'pop':
        put(fx, K.pluck(SCALE[5], 0.25, 4200), t, 0.55); put(fx, K.bell_tone(SCALE[7], 0.6), t, 0.4)
    elif k == 'sweep':
        put(fx, K.riser(0.9, 500, 9000, 0.16), t, 1.0)
    elif k == 'rise':
        put(fx, K.pluck(SCALE[3], 0.2, 3000), t, 0.32)
    elif k == 'words':
        put(fx, K.clock(False), t, 0.22)
    elif k == 'mark':
        put(fx, swish(0.45, 2200, 7000, 0.03, 0.14), t, 0.3); put(fx, K.bell_tone(SCALE[6], 0.5), t + 0.4, 0.25)
    elif k == 'draw':
        put(fx, K.riser(1.3, 300, 4500, 0.13), t, 1.0); put(fx, K.bell_tone(SCALE[4], 0.8, eerie=dark), t, 0.2)
    elif k == 'hop':
        put(fx, K.pluck(SCALE[min(len(SCALE) - 1, 3 + hop % 6)], 0.2, 3600), t, 0.45); hop += 1
    elif k == 'grow':
        put(fx, K.pluck(SCALE[min(len(SCALE) - 1, 2 + hop % 7)], 0.25, 3800), t, 0.4); put(fx, K.tom(50 + hop % 5 * 2, 0.4), t, 0.5); hop += 1
    elif k == 'tick':
        put(fx, K.rim(), t, 0.4); put(fx, K.bell_tone(SCALE[5 + hop % 3], 0.7, eerie=dark), t, 0.3); hop += 1
    elif k == 'strike':
        put(fx, swish(0.4, 1500, 5000, 0.01, 0.2), t, 0.35)
    elif k == 'wrong':
        put(fx, buzz(45), t, 0.55); put(fx, buzz(44), t + 0.17, 0.55)
    elif k == 'rewind':
        put(fx, K.reverse_swell(0.6, [SCALE[0], SCALE[4]]), t - 0.1, 0.6)
    elif k == 'right':
        for j, m in enumerate((SCALE[5], SCALE[6] if P['key'] == 'bright' else SCALE[5] + 4, SCALE[8])):
            put(fx, K.bell_tone(m, 1.4), t + j * 0.05, 0.45)
    elif k == 'write':
        put(fx, scratch(1.1), t, 0.16)
    elif k == 'end':
        put(fx, K.bell_tone(SCALE[5], 2.4), t, 0.5); put(fx, K.bell_tone(SCALE[8], 2.4), t + 0.08, 0.3)

# ---------------- 나레이션 ----------------
starts = {s['n']: s['t0'] for s in info['SCENES']}
for i, sc in enumerate(lesson['scenes']):
    v = sc.get('voice')
    if not v:
        continue
    sr, x = wavfile.read(os.path.join(work, v))
    x = x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x /= (np.abs(x).max() or 1)
    if sr != SR:
        x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    put(vo, x, starts[i + 1] + 0.35, 0.9)

# 말하는 동안 배경음을 낮춘다(덕킹)
if np.any(vo):
    env_v = np.convolve(np.abs(vo) > 0.02, np.ones(int(0.25 * SR)) / int(0.25 * SR), 'same')
    bed *= 1 - 0.65 * np.clip(env_v * 3, 0, 1)

# 잔향 · 섞기 · 크기
ir_n = int(1.6 * SR)
ir = K.noise(ir_n) * np.exp(-np.arange(ir_n) / SR / 0.45)
ir = C.filt(ir, 'lowpass', 5000) / np.sqrt(np.sum(ir ** 2))
wet = fftconvolve(bed * 0.6 + fx, ir)[:N] * 0.18
mix = bed * 0.8 + fx + wet + vo
fade = np.ones(N)
fo = int(0.8 * SR)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade
rms = np.sqrt(np.mean(mix ** 2)) or 1
mix *= 10 ** (-17 / 20) / rms
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
st = np.stack([mix, mix], axis=1)
os.makedirs(os.path.join(work, 'build'), exist_ok=True)
wavfile.write(os.path.join(work, 'build/music.wav'), SR, (st * 32000).astype(np.int16))
print(f"소리: {MOOD} · {P['bpm']}bpm · 효과음 {len(info['HITS'])}개 · 나레이션 {sum(1 for s in lesson['scenes'] if s.get('voice'))}개 → build/music.wav")
