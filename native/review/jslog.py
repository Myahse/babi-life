#!/usr/bin/env python3
# What the app's JavaScript said during the walk-through (native-review.yml): the ReactNativeJS lines
# of the phone's log, its errors and warnings first, every bundle position in them traced back to the
# game's file and line (the bundle's source map, through metro-symbolicate), and the crashes.
#
#   python3 jslog.py LOGCAT BUNDLE_MAP OUT_FILE      (run from native/: metro-symbolicate is there)

import re
import subprocess
import sys

logcat, bundle_map, out = sys.argv[1:4]
lines = open(logcat, encoding='utf-8', errors='replace').read().splitlines()

js = [l for l in lines if ' ReactNativeJS' in l]
crash = []
for i, l in enumerate(lines):
    if 'FATAL EXCEPTION' in l or ('AndroidRuntime' in l and ' E ' in l):
        crash.append(l)

# Every position in the bundle (Hermes: « fn@1:1234 », « (address at index.android.bundle:1:1234) »).
POS = re.compile(r'(?:@|index\.android\.bundle:)1:(\d+)')
positions = sorted({int(m) for l in js + crash for m in POS.findall(l)})
where = {}
if positions:
    stack = ''.join(f'    at f (address at index.android.bundle:1:{p})\n' for p in positions)
    try:
        r = subprocess.run(['npx', 'metro-symbolicate', bundle_map], input=stack.encode(), capture_output=True, timeout=600)
        res = r.stdout.decode('utf-8', 'replace').splitlines()
        res = [x for x in res if x.strip()]
        for p, s in zip(positions, res):
            where[p] = re.sub(r'^\s*at\s+', '', s).strip()
    except Exception as e:  # noqa
        print('symbolicate failed', e)


def traced(l):
    return POS.sub(lambda m: f'{m.group(0)} [{where.get(int(m.group(1)), "?")}]', l)


errors = [l for l in js if re.search(r' [EW] ReactNativeJS', l)]
with open(out, 'w') as f:
    f.write(f'# {len(js)} ReactNativeJS lines, {len(errors)} errors/warnings, {len(crash)} crash lines\n\n')
    f.write('## Crashes\n')
    f.write('\n'.join(traced(l) for l in crash[:400]) + '\n\n')
    f.write('## Errors and warnings\n')
    f.write('\n'.join(traced(l) for l in errors) + '\n\n')
    f.write('## Everything the JavaScript logged\n')
    f.write('\n'.join(traced(l) for l in js) + '\n')
print(open(out).read()[:20000])
