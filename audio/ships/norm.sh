#!/usr/bin/env bash
# two-pass EBU R128 normalisation: norm.sh in.wav out.wav [-14]
set -euo pipefail
T=${3:--14}
j=$(ffmpeg -hide_banner -i "$1" -af loudnorm=I=$T:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i "$1" -af "loudnorm=I=$T:TP=-1.0:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,alimiter=limit=0.8:attack=2:release=60:level=false" -ar 48000 -c:a pcm_s24le "$2"
