#!/usr/bin/env bash
# Inside the emulator (native-review.yml): the review build installed, a phone-sized screen, the
# phone's whole log kept while drive.py plays the game, then what the app logged sorted out.
set -u
OUT=${OUT:-/tmp/review}
mkdir -p "$OUT"
cd "$(dirname "$0")"
adb wait-for-device
# A common phone's screen (about 411 x 868 dp), not the emulator's tiny default.
adb shell wm size 720x1520
adb shell wm density 280
adb shell settings put system accelerometer_rotation 0
adb install -r ../android/app/build/outputs/apk/release/app-release.apk
adb logcat -c
adb logcat -v threadtime > "$OUT/logcat.txt" 2>&1 &
LOGCAT=$!
python3 -u drive.py "$OUT" 2>&1 | tee "$OUT/drive.log"
sleep 2
kill $LOGCAT 2>/dev/null
adb shell dumpsys meminfo com.lifeinbabi.babi_life > "$OUT/meminfo.txt" 2>&1 || true
# Where each of the app's threads is at the end (a frozen app: the JavaScript, the UI and the GL
# threads, native and Java): the emulator's own image lets adb be root for debuggerd.
PID=$(adb shell pidof com.lifeinbabi.babi_life | tr -d '\r')
if [ -n "$PID" ]; then
  adb root > /dev/null 2>&1; sleep 3; adb wait-for-device
  adb shell debuggerd -b "$PID" > "$OUT/stacks.txt" 2>&1 || true
  adb shell debuggerd -j "$PID" > "$OUT/stacks-java.txt" 2>&1 || true
fi
exit 0
