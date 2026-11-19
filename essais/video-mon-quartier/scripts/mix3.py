# mix3.py: the v3 sound. Lea's v3 takes placed on the re-cut picture (remap3.py's *-cut.json), the sound bed under her
# (street ambiences per shot, UI taps and pops, the gbaka and its apprenti), the music ducked under the voice.
# python3 mix3.py long|short <cut.json> <out prefix>
# Writes <prefix>voice.wav (-15 LUFS), <prefix>bed.wav, <prefix>mix-full.wav (-14 LUFS), <prefix>no-voice.wav (music + bed,
# -14 LUFS), <prefix>no-music.wav (voice + bed, -14 LUFS), <prefix>voice-plan.json (the voice clips at their times).
import json, subprocess, sys, os
W = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq3/'
HERE = os.path.dirname(os.path.abspath(__file__)) + '/../'
which, CUT, P = sys.argv[1], sys.argv[2], W + sys.argv[3]
cut = json.load(open(CUT))
DUR = cut['total']
SH = {s['shot']: s for s in cut['shots']}
def at(shot, sec=0.0, v2frames=None):
    """Time on the new timeline: `sec` seconds into the new shot, or `v2frames` frames into the v2 shot (stretched)."""
    s = SH[shot]
    if v2frames is not None:
        sec = (v2frames - s['from']) / 30 * s['nout'] / s['n']
    return s['start'] + sec
VOX = HERE + 'voix-v3/'
# --- the voice: (take, from, to, time)
if which == 'long':
    VOICE = [('n1', 0, None, at('A', 0.35)), ('n2', 0, None, at('B', 0.3)), ('n3', 0, None, at('C', 0.15)),
             ('n4', 0, None, at('E', 0.25)), ('n5', 0, 2.81, at('F', 0.2)), ('n5', 2.81, None, at('G', 0.25)),
             ('n6', 0, None, at('I', 0.12)),
             ('n7', 0, 1.22, at('JM', 0.15)), ('n7', 1.22, 2.36, at('JM', v2frames=61) + 0.15), ('n7', 2.36, None, at('JM', v2frames=155) + 0.1),
             ('n8', 0, None, at('O', 0.4)), ('n9', 0, None, at('O', 4.5))]
else:
    VOICE = [('n1', 0, None, at('A', 0.35)), ('n3', 0, None, at('C', 0.15)),
             ('n5', 0, 2.81, at('F', 0.2)), ('n5', 2.81, None, at('G', 0.25)), ('n6', 0, None, at('I', 0.12)),
             ('n8', 0, None, at('O', 0.4)), ('n9', 0, None, at('O', 4.5))]
# --- the bed: (sound, from, to (None: its end), time, gain dB, fade in, fade out, pan -1..1)
SFX = W + 'sfx/'
def end(shot): return SH[shot]['start'] + SH[shot]['dur']
BED = []
LIFT = 3  # the whole bed, dB (it sits about 16 dB under the voice)
def bed(*a): BED.append(a[:4] + (a[4] + LIFT,) + a[5:])
bed('amb-golden', 0, at('A', 5.0) + 0.4, at('A'), -9, 0.4, 0.8, 0)          # birds and the city at golden hour
bed('whoosh', 0, None, at('A', 0.05), -14, 0.02, 0.3, 0)
if 'B' in SH:
    bed('amb-golden', 5.5, 5.5 + SH['B']['dur'] + SH['C']['dur'], at('B'), -17, 0.4, 0.4, 0)
    bed('tap', 0, None, at('B', v2frames=10), -9, 0, 0.05, 0.1); bed('pop', 0, None, at('B', v2frames=12), -12, 0, 0.05, 0.1)
    bed('tap', 0, None, at('B', v2frames=46), -9, 0, 0.05, 0.1); bed('pop', 0, None, at('B', v2frames=48), -12, 0, 0.05, 0.1)
else:
    bed('amb-golden', 5.5, 5.5 + SH['C']['dur'], at('C'), -17, 0.4, 0.4, 0)
# « Construire ici », « Maquis », « Placer » : taps, the sheet pops up, the maquis placed
bed('tap', 0, None, at('C', v2frames=8), -9, 0, 0.05, 0); bed('pop', 0, None, at('C', v2frames=12), -11, 0, 0.05, 0)
bed('tap', 0, None, at('C', v2frames=20), -9, 0, 0.05, 0); bed('tap', 0, None, at('C', v2frames=52), -9, 0, 0.05, 0)
bed('place', 0, None, at('C', v2frames=55), -7, 0, 0.1, 0)
# the maquis rises in the street, then the street, a taxi passing at the end
bed('street', 0, SH['D']['dur'] + 0.3, at('D'), -11, 0.2, 0.4, 0)
bed('rise', 0, None, at('D', 0.05), -9, 0.02, 0.4, 0)
bed('carpass', 0, None, at('D', v2frames=80), -12, 0.1, 0.3, -0.3)
if 'E' in SH:  # « Gérer » then « Encaisser »
    bed('street', 3.0, 3.0 + SH['E']['dur'], at('E'), -21, 0.3, 0.4, 0)
    bed('tap', 0, None, at('E', v2frames=4), -9, 0, 0.05, 0.15); bed('pop', 0, None, at('E', v2frames=8), -11, 0, 0.05, 0.15)
    bed('tap', 0, None, at('E', v2frames=41), -9, 0, 0.05, 0.15); bed('coins', 0, None, at('E', v2frames=43), -8, 0, 0.2, 0.15)
bed('market', 0, SH['F']['dur'] + 0.3, at('F') - 0.15, -10, 0.25, 0.35, 0)        # the market at 5 pm
bed('maquis', 0, SH['G']['dur'] + (1.6 if 'H' in SH else 0.3), at('G') - 0.1, -12, 0.2, 0.6, 0)  # the maquis at night
if 'H' in SH:  # the gbaka stop: the minibus, its horn, the apprenti calling
    bed('gbaka', 0, None, at('H') - 0.15, -9, 0.1, 0.5, 0.2)
    bed('apprenti', 0, 1.9, at('H', 0.05), -11, 0.02, 0.3, 0.35)
# « Aménager »: taps on the tools, the trees growing
bed('amb-golden', 3.0, 3.0 + SH['I']['dur'], at('I'), -18, 0.4, 0.4, 0)
for f in (12, 42, 76, 104):
    bed('tap', 0, None, at('I', v2frames=f), -10, 0, 0.05, -0.1)
bed('grow', 0, None, at('I', v2frames=108), -9, 0.02, 0.4, 0)
if 'JM' in SH:
    J = 'JM'
    bed('tap', 0, None, at(J, v2frames=6), -9, 0, 0.05, 0); bed('pop', 0, None, at(J, v2frames=9), -12, 0, 0.05, 0)
    bed('tap', 0, None, at(J, v2frames=61 + 5), -9, 0, 0.05, 0); bed('pop', 0, None, at(J, v2frames=61 + 8), -12, 0, 0.05, 0)
    bed('whoosh', 0, None, at(J, v2frames=93) - 0.1, -12, 0.02, 0.3, 0)                 # the city from above
    bed('amb-golden', 1.0, 1.0 + 2.1 + 1.8, at(J, v2frames=93), -14, 0.3, 0.5, 0)
    bed('tap', 0, None, at(J, v2frames=155 + 14), -9, 0, 0.05, 0)
    bed('lagoon', 0, 2.0, at('N'), -11, 0.2, 0.4, 0)                                      # the lagoon, then a taxi close
    bed('carpass', 0, None, at('N', 1.45), -10, 0.05, 0.3, 0.3)
# the end card: the steps pop in, the green button
bed('amb-golden', 6.0, 6.0 + min(6.0, SH['O']['dur']), at('O') - 0.2, -19, 0.6, 2.0, 0)
o = 0 if which == 'long' else -0.4  # the short cut's card starts 12 frames later
for s in (0.5, 1.3, 2.1, 2.9):
    bed('pop', 0, None, at('O', s + o), -14, 0, 0.05, 0)
bed('pop', 0, None, at('O', 4.6 + o), -11, 0, 0.05, 0)

def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)
def lufs(src):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return json.loads(r[r.rindex('{'):])
def norm(src, dst, target):
    j = lufs(src)
    run(['-i', src, '-af', f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000", '-ar', '48000', dst + '.tmp.wav'])
    # padded to the full length in a pass of its own (loudnorm drops the trailing silence)
    run(['-i', dst + '.tmp.wav', '-af', f'apad=whole_dur={DUR},atrim=end={DUR}', '-ar', '48000', dst]); os.remove(dst + '.tmp.wav')
def norm_lim(src, dst, target):
    """Gain to the target, then a peak limiter (for a dense track where linear loudnorm falls short)."""
    for _ in range(3):
        g = target - float(lufs(src)['input_i'])
        run(['-i', src, '-af', f'volume={g:.2f}dB,alimiter=limit=0.84:attack=5:release=80:level=false,aresample=48000', '-ar', '48000', dst + '.tmp.wav'])
        os.replace(dst + '.tmp.wav', dst); src = dst
def place(clips, out, src_of):
    ins, parts = [], []
    for i, c in enumerate(clips):
        f, a, b, t = c[:4]
        g, fi, fo, pan = (c[4:] + (0, 0.02, 0.04, 0))[:4] if len(c) > 4 else (0, 0.02, 0.04, 0)
        ins += ['-i', src_of(f)]
        trim = f'atrim=start={a}' + (f':end={b}' if b else '')
        l, r = min(1, 1 - pan), min(1, 1 + pan)
        parts.append(f'[{i}:a]{trim},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,pan=stereo|c0={l:.2f}*c0|c1={r:.2f}*c1,'
                     f'volume={g}dB,afade=t=in:d={fi},areverse,afade=t=in:d={fo},areverse,adelay={int(max(0, t) * 1000)}|{int(max(0, t) * 1000)}[v{i}]')
    mixin = ''.join(f'[v{i}]' for i in range(len(clips)))
    fc = ';'.join(parts) + f';{mixin}amix=inputs={len(clips)}:normalize=0,apad=whole_dur={DUR},atrim=end={DUR}[out]'
    run(ins + ['-filter_complex', fc, '-map', '[out]', '-ar', '48000', out])
# the sound effects each brought to -23 LUFS first (short ones by peak), so the gains above are relative
os.makedirs(W + 'sfxn', exist_ok=True)
def sfx_src(f):
    dst = W + 'sfxn/' + f + '.wav'
    if not os.path.exists(dst):
        src = VOX + 'apprenti.mp3' if f == 'apprenti' else SFX + f + '.mp3'
        if f in ('tap', 'pop', 'place', 'coins', 'whoosh', 'grow'):
            run(['-i', src, '-af', 'volume=0dB,aresample=48000', '-ar', '48000', W + 'sfxn/tmp.wav'])
            m = subprocess.run(['ffmpeg', '-hide_banner', '-i', W + 'sfxn/tmp.wav', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
            peak = float(m.split('max_volume:')[1].split('dB')[0])
            run(['-i', W + 'sfxn/tmp.wav', '-af', f'volume={-12 - peak}dB', dst])
        elif f == 'apprenti':  # a man calling across the street: a bit far, a bit of room
            run(['-i', src, '-af', 'highpass=f=250,lowpass=f=5000,aecho=0.8:0.5:60:0.25,aresample=48000', '-ar', '48000', W + 'sfxn/tmp.wav'])
            norm(W + 'sfxn/tmp.wav', dst, -23)
        else:
            norm(src, dst, -23)
    return dst
place(VOICE, P + 'voice-raw.wav', lambda f: VOX + f + '.mp3')
norm(P + 'voice-raw.wav', P + 'voice.wav', -15)
place(BED, P + 'bed.wav', sfx_src)
# the music: cut, faded, -15 LUFS, then 13 dB under the voice and ducked while she speaks
MUS = HERE + 'voix-v2/musique.mp3'
run(['-i', MUS, '-af', f'atrim=end={DUR},afade=t=in:d=0.3,afade=t=out:st={DUR - 2.2}:d=2.2,aresample=48000,aformat=channel_layouts=stereo', '-ar', '48000', P + 'music-raw.wav'])
norm(P + 'music-raw.wav', P + 'music-solo.wav', -15)
DUCK = 'sidechaincompress=threshold=0.03:ratio=4:attack=60:release=450:makeup=1'
run(['-i', P + 'music-solo.wav', '-i', P + 'voice.wav', '-i', P + 'bed.wav', '-filter_complex',
     f'[1:a]asplit=3[sc1][sc2][vv];[0:a]volume=-13dB[m];[m][sc1]{DUCK}[md];[2:a][sc2]sidechaincompress=threshold=0.05:ratio=2.5:attack=40:release=400:makeup=1[bd];'
     '[md][bd][vv]amix=inputs=3:normalize=0[out]', '-map', '[out]', '-ar', '48000', P + 'mix-raw.wav'])
norm(P + 'mix-raw.wav', P + 'mix-full.wav', -14)
# without the voice: the music up (as in v2, no ducking) with the bed; without the music: the voice and the bed
run(['-i', P + 'music-solo.wav', '-i', P + 'bed.wav', '-filter_complex', '[0:a]volume=-4dB[m];[m][1:a]amix=inputs=2:normalize=0[out]', '-map', '[out]', P + 'nv-raw.wav'])
run(['-i', P + 'nv-raw.wav', P + 'nv-raw2.wav']); norm_lim(P + 'nv-raw2.wav', P + 'no-voice.wav', -14)
run(['-i', P + 'voice.wav', '-i', P + 'bed.wav', '-filter_complex', f'[0:a]asplit=2[sc][vv];[1:a][sc]sidechaincompress=threshold=0.05:ratio=2.5:attack=40:release=400:makeup=1[bd];[bd][vv]amix=inputs=2:normalize=0[out]', '-map', '[out]', P + 'nm-raw.wav'])
norm(P + 'nm-raw.wav', P + 'no-music.wav', -14)
json.dump([[f, a, b, round(t, 3)] for f, a, b, t in VOICE], open(P + 'voice-plan.json', 'w'))
for f in ('voice-raw', 'music-raw', 'mix-raw', 'nv-raw', 'nm-raw', 'nv-raw2'):
    os.remove(P + f + '.wav')
for f in ('voice', 'mix-full', 'no-voice', 'no-music'):
    print(f, round(float(lufs(P + f + '.wav')['input_i']), 1), 'LUFS')
