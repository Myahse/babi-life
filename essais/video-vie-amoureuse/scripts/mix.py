# mix.py: the sound of « Vie amoureuse »: Lea's takes placed by mkedl.py's plan, the sound bed under her (the maquis at night,
# the lagoon at sunset, the terrace, the house; taps, hearts, the bise, the shutter, the chime), the music ducked under the voice.
# python3 mix.py <plan.json> <out prefix>   (v3's mix3.py, the same levels: voice -15 LUFS, mix -14, music 13 dB under the voice)
import json, subprocess, sys, os
W = '/tmp/claude-0/land/video-vie-amoureuse/'
plan = json.load(open(sys.argv[1]))
P = W + 'mix/' + sys.argv[2]
os.makedirs(W + 'mix', exist_ok=True)
DUR = plan['total']
VOICE = [tuple(v[:4]) for v in plan['voice']]
BED = [tuple(b[:4]) + (b[4] + 3,) + tuple(b[5:]) for b in plan['bed']]
VOX = W + 'voix/'
SFX = W + 'sfx/'
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
os.makedirs(W + 'sfxn', exist_ok=True)
def sfx_src(f):
    dst = W + 'sfxn/' + f + '.wav'
    if not os.path.exists(dst):
        src = SFX + f + '.mp3'
        if not f.startswith('amb-'):
            run(['-i', src, '-af', 'aresample=48000', '-ar', '48000', W + 'sfxn/tmp.wav'])
            m = subprocess.run(['ffmpeg', '-hide_banner', '-i', W + 'sfxn/tmp.wav', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
            peak = float(m.split('max_volume:')[1].split('dB')[0])
            run(['-i', W + 'sfxn/tmp.wav', '-af', f'volume={-12 - peak}dB', dst])
        else:
            norm(src, dst, -23)
    return dst
place(VOICE, P + 'voice-raw.wav', lambda f: VOX + f + '.mp3')
norm(P + 'voice-raw.wav', P + 'voice.wav', -15)
place(BED, P + 'bed.wav', sfx_src)
MUS = W + 'musique.mp3'
run(['-i', MUS, '-af', f'atrim=end={DUR},afade=t=in:d=0.3,afade=t=out:st={DUR - 2.2}:d=2.2,aresample=48000,aformat=channel_layouts=stereo', '-ar', '48000', P + 'music-raw.wav'])
norm(P + 'music-raw.wav', P + 'music-solo.wav', -15)
DUCK = 'sidechaincompress=threshold=0.03:ratio=4:attack=60:release=450:makeup=1'
run(['-i', P + 'music-solo.wav', '-i', P + 'voice.wav', '-i', P + 'bed.wav', '-filter_complex',
     f'[1:a]asplit=3[sc1][sc2][vv];[0:a]volume=-13dB[m];[m][sc1]{DUCK}[md];[2:a][sc2]sidechaincompress=threshold=0.05:ratio=2.5:attack=40:release=400:makeup=1[bd];'
     '[md][bd][vv]amix=inputs=3:normalize=0[out]', '-map', '[out]', '-ar', '48000', P + 'mix-raw.wav'])
norm(P + 'mix-raw.wav', P + 'mix-full.wav', -14)
run(['-i', P + 'music-solo.wav', '-i', P + 'bed.wav', '-filter_complex', '[0:a]volume=-4dB[m];[m][1:a]amix=inputs=2:normalize=0[out]', '-map', '[out]', P + 'nv-raw.wav'])
norm_lim(P + 'nv-raw.wav', P + 'no-voice.wav', -14)
for f in ('voice-raw', 'music-raw', 'mix-raw', 'nv-raw'):
    os.remove(P + f + '.wav')
for f in ('voice', 'mix-full', 'no-voice'):
    print(f, round(float(lufs(P + f + '.wav')['input_i']), 1), 'LUFS')
