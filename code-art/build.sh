#!/usr/bin/env bash
# 程序的艺术: one command from the piece sources to the finished vertical videos.
#   bash code-art/build.sh          every film in films.txt
#   bash code-art/build.sh 下       one film (上 / 下, or 1 / 2)
# Needs: g++, clang++, python3 (numpy, scipy, Pillow), ffmpeg, JetBrains Mono (apt: fonts-jetbrains-mono).
set -euo pipefail
cd "$(dirname "$0")"
WORK=${WORK:-/tmp/codeart_work}
OUT=${OUT:-../out}
mkdir -p "$WORK" "$OUT"

FILMS=("$@")
if [ ${#FILMS[@]} -eq 0 ]; then
  mapfile -t FILMS < <(python3 -c "
from piece import load_films
for f in load_films('$WORK'): print(f.title)")
fi

for F in "${FILMS[@]}"; do
  TITLE=$(python3 -c "from piece import load_film; print(load_film('$WORK', '$F').title)")
  NAME=${TITLE// /_}
  echo "== $TITLE -> $OUT/$NAME.mp4"

  # 1. the pictures: compile and run every piece of the film (prints the order and the character counts)
  python3 piece.py "$WORK" "$F"

  # 2. sound: effects only, mastered to -18 LUFS
  python3 sfx.py "$WORK" "$F" "$WORK/$NAME.wav"

  # 3. picture: 1080x1920, 60 fps, H.264; the cover is the film's cover piece, finished
  python3 render.py "$WORK" "$F" --out "$WORK/$NAME.video.mp4" --cover "$OUT/${NAME}_封面.png"

  # 4. master
  ffmpeg -v error -y -i "$WORK/$NAME.video.mp4" -i "$WORK/$NAME.wav" -map 0:v -map 1:a \
    -c:v copy -c:a aac -b:a 256k -ar 48000 -metadata title="$TITLE" -movflags +faststart "$OUT/$NAME.mp4"
  cp "$WORK/$NAME.wav" "$OUT/${NAME}_音轨.wav"
  ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT/$NAME.mp4"
  echo "done: $OUT/$NAME.mp4"
done
