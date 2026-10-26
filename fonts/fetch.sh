#!/usr/bin/env bash
# Download the open-licence (SIL OFL) fonts used by the engine from Google Fonts' static CDN.
# list.tsv: family, style, weight, url, file — local.css maps the families to these files.
set -euo pipefail
cd "$(dirname "$0")"
while IFS=$'\t' read -r fam st wt url fn; do
  [[ -f "$fn" ]] || curl -sSfL -o "$fn" "$url"
done < <(cat list.tsv; echo)
echo "fonts ready: $(ls *.ttf | wc -l) files"
