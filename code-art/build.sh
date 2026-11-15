#!/usr/bin/env bash
# 程序与艺术 —— one command from the piece sources to the finished vertical video.
#   bash code-art/build.sh
# Needs: g++, python3 (numpy, scipy, Pillow), ffmpeg, JetBrains Mono (apt: fonts-jetbrains-mono).
set -euo pipefail
cd "$(dirname "$0")"
WORK=${WORK:-/tmp/codeart_work}
OUT=${OUT:-../out}
NAME=程序与艺术_Tweetable_Mathematical_Art
mkdir -p "$WORK" "$OUT"

# 1. the pictures: compile and run every piece (prints the running order and the character counts)
python3 piece.py "$WORK"

# 2. sound: effects only, mastered to -18 LUFS
python3 sfx.py "$WORK" "$WORK/$NAME.wav"

# 3. picture: 1080x1920, 60 fps, H.264; the cover is the closing frame
python3 render.py "$WORK" --out "$WORK/$NAME.video.mp4" --cover "$OUT/${NAME}_封面.png"

# 4. master
ffmpeg -v error -y -i "$WORK/$NAME.video.mp4" -i "$WORK/$NAME.wav" -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 256k -ar 48000 -metadata title="程序与艺术 · Tweetable Mathematical Art" -movflags +faststart "$OUT/$NAME.mp4"
cp "$WORK/$NAME.wav" "$OUT/${NAME}_音轨.wav"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT/$NAME.mp4"
echo "done: $OUT/$NAME.mp4"
