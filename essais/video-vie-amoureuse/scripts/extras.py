# extras.py: per take, sound outside the transcribed words (laughs, breaths, sighs: what makes it alive) and the
# variability of the word rhythm (robotic cadence = very even words). python3 extras.py takes_dir prefix
import json, sys, numpy as np, subprocess
D, pre = sys.argv[1], sys.argv[2]
S = json.load(open(D + '/stt.json'))
SR = 16000
for k in sorted(S):
    if not k.startswith(pre): continue
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{D}/{k}.mp3', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hop = 160; rms = np.array([np.sqrt(np.mean(x[i:i + 400] ** 2)) for i in range(0, len(x) - 400, hop)])
    t = np.arange(len(rms)) * hop / SR
    ws = [w for w in S[k]['words'] if w[3] == 'word']
    inword = np.zeros(len(t), bool)
    for _, a, b, _ in ws: inword |= (t > a - 0.06) & (t < b + 0.06)
    loud = rms > 0.02
    extra = loud & ~inword & (t > ws[0][1]) & (t < ws[-1][2] + 0.8)
    # spans of extra sound
    spans, s0 = [], None
    for i, e in enumerate(extra):
        if e and s0 is None: s0 = t[i]
        if not e and s0 is not None:
            if t[i] - s0 > 0.12: spans.append(f'{s0:.2f}-{t[i]:.2f}')
            s0 = None
    dur = np.array([(b - a) / max(1, len(w)) for w, a, b, _ in ws])
    gaps = [round(ws[i + 1][1] - ws[i][2], 2) for i in range(len(ws) - 1) if ws[i + 1][1] - ws[i][2] > 0.25]
    print(f'{k:12s} end {ws[-1][2]:.2f}  extra {extra.sum()*hop/SR:.2f}s {spans}  rhythm cv {np.std(dur)/np.mean(dur):.2f}  pauses {gaps}')
