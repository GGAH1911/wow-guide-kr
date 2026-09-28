#!/usr/bin/env bash
# 배포할 사이트를 만든다: main 의 코드 + data 브랜치의 최신 수치(stats.json, rank/) → roster 병합 → 페이지 셸 빌드 → $1(기본 _site)
# data 브랜치를 못 받으면 main 에 들어 있는 수치로 그대로 만든다.
set -euo pipefail
cd "$(dirname "$0")/../.."
SITE="${1:-_site}"
if git fetch -q --depth 1 origin data 2>/dev/null; then
  rm -rf /tmp/databr && mkdir -p /tmp/databr && git archive FETCH_HEAD | tar -x -C /tmp/databr
  node tools/ci/stats.mjs merge /tmp/databr/stats.json
  rm -rf data/rank && cp -R /tmp/databr/rank data/rank
  if [ -f /tmp/databr/raid/comp.json ]; then mkdir -p data/raid && cp /tmp/databr/raid/comp.json data/raid/comp.json; fi
  # PvP: 매일 수집하는 것(meta.json, spec/, rank/)만 덮어쓴다. 지도 공략(maps.json)·전문화 전략(strat/)은 main 의 것을 그대로 쓴다
  if [ -f /tmp/databr/pvp/meta.json ]; then mkdir -p data/pvp && cp /tmp/databr/pvp/meta.json data/pvp/meta.json && for d in spec rank; do if [ -d /tmp/databr/pvp/$d ]; then rm -rf data/pvp/$d && cp -R /tmp/databr/pvp/$d data/pvp/$d; fi; done; fi
else
  echo "data 브랜치 없음: main 의 수치로 만든다"
fi
node tools/build.mjs
rm -rf "$SITE" && mkdir -p "$SITE"
tar --exclude=./.git --exclude=./.github --exclude=./tools --exclude=./design --exclude=./audits --exclude=./docs --exclude="./$SITE" -cf - . | tar -xf - -C "$SITE"
echo "site: $(find "$SITE" -type f | wc -l) files, $(du -sh "$SITE" | cut -f1)"
