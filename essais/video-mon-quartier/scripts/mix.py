# The sound: the voice clips placed on the timeline (cut at their natural pauses), the music under them (ducked),
# and the three mixes: full, music only, voice only. python3 mix.py <duration s>
import subprocess, sys, json
V = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/'
DUR = float(sys.argv[1])
# (file, from, to (None: the end), at)
CLIPS = json.load(open(V + 'voice-plan.json'))
def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)

# 1. The voice track (48 kHz stereo wav), each clip trimmed, faded a hair at its cuts, delayed to its place.
ins, parts = [], []
for i, (f, a, b, at) in enumerate(CLIPS):
    ins += ['-i', V + 'voix/' + f + '.mp3']
    trim = f'atrim=start={a}' + (f':end={b}' if b else '')
    parts.append(f'[{i}:a]{trim},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse,adelay={int(at * 1000)}|{int(at * 1000)}[v{i}]')
mixin = ''.join(f'[v{i}]' for i in range(len(CLIPS)))
fc = ';'.join(parts) + f';{mixin}amix=inputs={len(CLIPS)}:normalize=0,apad=whole_dur={DUR},atrim=end={DUR},aformat=channel_layouts=stereo[out]'
run(ins + ['-filter_complex', fc, '-map', '[out]', '-ar', '48000', V + 'voice-raw.wav'])
# Loudness: the voice at -15 LUFS (two-pass loudnorm, linear).
def norm(src, dst, target):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', f'loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(r[r.rindex('{'):])
    run(['-i', src, '-af', f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000", '-ar', '48000', dst])
norm(V + 'voice-raw.wav', V + 'voice.wav', -15)
# 2. The music, cut to the length, faded out at the end.
run(['-i', V + 'musique-el.mp3', '-af', f'atrim=end={DUR},afade=t=in:d=0.3,afade=t=out:st={DUR - 2.2}:d=2.2,aresample=48000,aformat=channel_layouts=stereo', '-ar', '48000', V + 'music-raw.wav'])
norm(V + 'music-raw.wav', V + 'music-solo.wav', -15)
# 3. Under the voice: the music 13 dB lower, ducked a little more while she speaks.
run(['-i', V + 'music-solo.wav', '-i', V + 'voice.wav', '-filter_complex',
     '[0:a]volume=-13dB[m];[1:a]asplit=2[sc][vv];[m][sc]sidechaincompress=threshold=0.03:ratio=4:attack=60:release=450:makeup=1[md];[md][vv]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]',
     '-map', '[out]', '-ar', '48000', V + 'mix-full.wav'])
print('ok')
