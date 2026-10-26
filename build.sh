#!/usr/bin/env bash
# One-command build of the finished film.
#   bash build.sh            full render (resumes: finished segments are kept)
#   bash build.sh audio      audio only (also refreshes engine/data/spectro.js)
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(pwd)
OUT="$ROOT/out"; mkdir -p "$OUT"
export NODE_PATH=$(npm root -g)
WORKERS=${WORKERS:-4}

python3 script/subtitles.py > /dev/null                      # text + timing -> engine/data/script.js
node render/render.js info > "$OUT/timeline.json"            # scene order, starts, transitions, cues
TOTAL=$(python3 -c "import json;print(json.load(open('$OUT/timeline.json'))['total'])")
FRAMES=$(python3 -c "import math;print(math.ceil($TOTAL*30))")
echo "timeline: ${TOTAL}s, ${FRAMES} frames"

# --- sound: synthesise, then two-pass EBU R128 normalisation to -14 LUFS / -1 dBTP
(cd audio && python3 score.py "$OUT/timeline.json" "$OUT/audio")
norm() {  # in out target
  local j; j=$(ffmpeg -hide_banner -i "$1" -af lowpass=f=16000:poles=2,loudnorm=I=$3:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  local mi mtp mlra mth off
  mi=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_i'])")
  mtp=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_tp'])")
  mlra=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_lra'])")
  mth=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_thresh'])")
  off=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['target_offset'])")
  ffmpeg -v error -y -i "$1" -af "lowpass=f=16000:poles=2,loudnorm=I=$3:TP=-1.0:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,alimiter=limit=0.75:attack=1:level=false" -ar 48000 "$2"
}
norm "$OUT/audio/mix_raw.wav" "$OUT/audio/mix.wav" -14
norm "$OUT/audio/sfx_raw.wav" "$OUT/audio/sfx_only.wav" -20
[[ "${1:-}" == "audio" ]] && { echo "audio done"; exit 0; }

# --- picture: parallel deterministic render, resumable per segment
bash render/parallel.sh "$OUT/video_noaudio.mp4" 0 "$FRAMES" "$WORKERS"

# --- master
ffmpeg -v error -y -i "$OUT/video_noaudio.mp4" -i "$OUT/audio/mix.wav" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT/人类如何记录信息_成片.mp4"
ffmpeg -v error -y -i "$OUT/人类如何记录信息_成片.mp4" -i "$OUT/audio/sfx_only.wav" -map 0:v -map 1:a -c:v copy \
  -af volume=-3dB -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT/人类如何记录信息_仅音效版.mp4"
ART="$OUT/cover_art"; NOTEXT=1 node render/render.js stills "$ART" 21.3,42.75,47.25,68.3,83.05,94.2,111.7,132.0,164.55,189.6,218.2,238.2,246.4,253.35 > /dev/null 2>&1 && python3 script/covers.py "$ART" "$OUT"
echo "done: $OUT/人类如何记录信息_成片.mp4"
