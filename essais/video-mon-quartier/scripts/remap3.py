# remap3.py: v3 picture, re-cut from the v2 picture (the delivered -sans-voix.mp4: frames and captions are burned in, the
# shots' frames are gone). Each shot of the v2 timeline is taken again, slowed or held where the livelier v3 lines need more
# time. python3 remap3.py long|short src.mp4 out.mp4
# The shot list and the timing of the new picture are written next to it as <out>-cut.json (read by mix3.py).
import json, subprocess, sys
which, SRC, OUT = sys.argv[1:4]
# v2 shots (long cut), in source frames: id: (first frame, frames)
V2 = {'A': (0, 126), 'B': (126, 96), 'C': (222, 78), 'D': (300, 100), 'E': (400, 84), 'F': (484, 96), 'G': (580, 90),
      'H': (670, 48), 'I': (718, 126), 'JM': (844, 209), 'N': (1053, 81), 'O': (1134, 360)}
# (shot, from (frames into the v2 shot), frames taken, frames out (slowed when more), hold frames, interpolation)
CUTS = {
 'long': [('A', 0, 126, 150, 0, 'mci'), ('B', 0, 96, 96, 0, ''), ('C', 0, 78, 78, 0, ''), ('D', 0, 100, 108, 0, 'mci'),
          ('E', 0, 84, 101, 24, 'blend'), ('F', 0, 96, 96, 0, ''), ('G', 0, 90, 90, 0, ''), ('H', 0, 48, 48, 0, ''),
          ('I', 0, 126, 156, 0, 'blend'), ('JM', 0, 209, 209, 0, ''), ('N', 0, 81, 81, 0, ''), ('O', 0, 360, 360, 0, '')],
 # the short cut: the same shots, the end card joined to « Aménager » by a 0.4 s dissolve (its own fade from the taxi skipped)
 'short': [('A', 0, 126, 150, 0, 'mci'), ('C', 0, 78, 78, 0, ''), ('D', 0, 84, 108, 0, 'mci'), ('F', 0, 96, 96, 0, ''),
           ('G', 0, 78, 78, 0, ''), ('I', 0, 126, 156, 0, 'blend'), ('O', 12, 270, 270, 0, '')],
}[which]
XF = 12 if which == 'short' else 0
ins, fc, t, plan = [], [], 0, []
for i, (k, a, n, nout, hold, interp) in enumerate(CUTS):
    f0 = V2[k][0] + a
    ins += ['-ss', f'{f0 / 30:.4f}', '-t', f'{n / 30 + 0.02:.4f}', '-i', SRC]
    chain = f'[{i}:v]trim=end_frame={n},setpts=PTS-STARTPTS'
    if nout != n:
        chain += f',setpts={nout / n:.5f}*PTS'
        chain += ',minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' if interp == 'mci' else ',framerate=fps=30:interp_start=32:interp_end=224'
    chain += f',fps=30,trim=end_frame={nout}'
    if hold:  # a still held a few frames before the shot's end (its last frames already fade its caption out)
        h = nout - 12
        chain += f',split[h{i}a][h{i}b];[h{i}a]trim=end_frame={h},tpad=stop_mode=clone:stop={hold}[h{i}c];[h{i}b]trim=start_frame={h},setpts=PTS-STARTPTS[h{i}d];[h{i}c][h{i}d]concat=n=2:v=1:a=0'
    fc.append(chain + f',setpts=PTS-STARTPTS,settb=1/30,format=yuv420p[s{i}]')
    dur = nout + hold
    start = t - (XF if (XF and i == len(CUTS) - 1) else 0)
    # map of time: v2 shot time u (s from the v2 shot start, inside the frames taken) -> new time start + (u - a/30) * nout/n
    plan.append({'shot': k, 'start': round(start / 30, 3), 'dur': round(dur / 30, 3), 'from': a, 'n': n, 'nout': nout, 'hold': hold})
    t = start + dur
m = len(CUTS) - (1 if XF else 0)
fc.append(''.join(f'[s{i}]' for i in range(m)) + f'concat=n={m}:v=1:a=0,settb=1/30[c]')
if XF:
    fc.append(f'[c][s{m}]xfade=transition=fade:duration={XF / 30}:offset={(plan[-1]["start"]):.3f}[out]')
else:
    fc[-1] = fc[-1].replace('[c]', '[out]')
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', ';'.join(fc), '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-r', '30', OUT], check=True)
json.dump({'total': round(t / 30, 3), 'shots': plan}, open(OUT.rsplit('.', 1)[0] + '-cut.json', 'w'), indent=1)
print(which, round(t / 30, 3), 's')
