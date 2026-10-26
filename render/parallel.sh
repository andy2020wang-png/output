#!/usr/bin/env bash
# Render frames [F0, F1) with N parallel Chromium workers, then join the segments losslessly.
# usage: render/parallel.sh OUT.mp4 F0 F1 [N] [sceneIds]
set -euo pipefail
OUT=$1; F0=$2; F1=$3; N=${4:-4}; IDS=${5:-}
DIR=$(cd "$(dirname "$0")" && pwd)
TMP=$(realpath -m "${OUT%.mp4}_parts"); mkdir -p "$TMP"
export NODE_PATH=$(npm root -g)
STEP=$(( (F1 - F0 + N - 1) / N ))
pids=()
for ((i = 0; i < N; i++)); do
  a=$(( F0 + i * STEP )); b=$(( a + STEP )); (( b > F1 )) && b=$F1
  (( a >= b )) && continue
  part="$TMP/part_$(printf %03d $i).mp4"
  if [[ -f "$part" ]]; then echo "skip $part"; continue; fi
  node "$DIR/render.js" range "$part" $a $b $IDS > "$TMP/log_$i.txt" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait $p; done
ls "$TMP"/part_*.mp4 | sed "s/^/file '/; s/$/'/" > "$TMP/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$OUT"
echo "joined -> $OUT"
