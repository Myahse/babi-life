# prosody.py: rough "life" measures of each take (no ears here): duration, F0 range and variance in semitones (autocorrelation
# pitch tracker), F0 movement between syllables, loudness variance. python3 prosody.py file.mp3 ...
import subprocess, sys, numpy as np
SR = 16000
def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def f0track(x, hop=160, win=640, lo=110, hi=500):
    out, rms = [], []
    for i in range(0, len(x) - win, hop):
        w = x[i:i + win] * np.hanning(win)
        e = np.sqrt(np.mean(w ** 2)); rms.append(e)
        if e < 0.01: out.append(np.nan); continue
        ac = np.fft.irfft(np.abs(np.fft.rfft(w, 2 * win)) ** 2)[:win]
        a, b = SR // hi, SR // lo
        k = a + np.argmax(ac[a:b])
        out.append(SR / k if ac[k] / ac[0] > 0.45 else np.nan)
    return np.array(out), np.array(rms)
for f in sys.argv[1:]:
    x = load(f); f0, rms = f0track(x)
    v = f0[~np.isnan(f0)]
    st = 12 * np.log2(v / np.median(v)) if len(v) else np.array([0])
    # median filtered contour to drop octave errors, then slope per 100 ms
    d = np.abs(np.diff(st)); d = d[d < 4]
    db = 20 * np.log10(rms[rms > 0.01] + 1e-9)
    print(f'{f.split("/")[-1]:24s} dur {len(x)/SR:5.2f}s  f0 med {np.median(v) if len(v) else 0:5.0f}Hz  sd {np.std(st):4.2f}st  range(5-95) {np.percentile(st,95)-np.percentile(st,5):5.2f}st  move {np.mean(d) if len(d) else 0:4.2f}  loud sd {np.std(db):4.2f}dB  voiced {len(v)/len(f0):.2f}')
