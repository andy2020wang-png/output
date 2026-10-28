#!/usr/bin/env bash
# One-command build of 科技树 02 · 造船.
#   bash build_ships.sh            full render (resumes: finished segments are kept)
#   bash build_ships.sh audio      audio only
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(pwd)
OUT="$ROOT/out/ships"; mkdir -p "$OUT/audio"
export NODE_PATH=$(npm root -g) EP=ships
WORKERS=${WORKERS:-4}

python3 script/ships/subtitles.py > /dev/null                 # text, beat events -> engine/ep/ships/data/script.js
node render/render.js info > "$OUT/timeline.json"             # scene order and starts
TOTAL=$(python3 -c "import json;print(json.load(open('$OUT/timeline.json'))['total'])")
FRAMES=$(python3 -c "import math;print(math.ceil($TOTAL*30))")
echo "timeline: ${TOTAL}s, ${FRAMES} frames"

# --- sound: score + effects, loudness set inside score.py (-14 LUFS integrated, true peak <= -1.3 dBTP)
(cd audio/ships && python3 score.py "$OUT/audio")
python3 - "$OUT/audio/cues.json" "$OUT/timeline.json" <<'PY'
import json, sys
a = json.load(open(sys.argv[1])); v = json.load(open(sys.argv[2]))
ta = a['total'] + a['tail']; tv = v['total']
assert abs(ta - tv) < 1e-6, f'audio {ta}s vs picture {tv}s'
starts = {s['id']: s['start'] for s in a['sections']}
for s in v['scenes']:
    if s['id'] in starts: assert abs(starts[s['id']] - s['start']) < 1e-6, (s['id'], starts[s['id']], s['start'])
print('audio and picture grids match:', tv, 's')
PY
[[ "${1:-}" == "audio" ]] && { echo "audio done"; exit 0; }

# --- picture: parallel deterministic render, resumable per segment
bash render/parallel.sh "$OUT/video_noaudio.mp4" 0 "$FRAMES" "$WORKERS"

# --- master
ffmpeg -v error -y -i "$OUT/video_noaudio.mp4" -i "$OUT/audio/mix.wav" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT/人类如何造船_成片.mp4"
echo "done: $OUT/人类如何造船_成片.mp4"
