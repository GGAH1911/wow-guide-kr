#!/usr/bin/env bash
# 매일 수집(GitHub Actions). Raider.IO 쐐기 상위 500명: 세계 → 세계(중국 제외, 세계 수집본에 이어서) → 중국 → 한국.
# 레이드 순위(data/raid/comp.json)는 주 1회(목요일, tools/ci/raid-due.mjs). 수동 실행은 RAID=yes|no|auto.
# 이상 검사를 모두 통과해야 roster·data/rank 를 쓴다. 실패하면 종료 코드 2(워크플로가 배포를 건너뜀).
# 결과: data/roster.json 의 수치, data/rank/**, 그리고 $1(기본 /tmp/stats.json)에 수치만 뽑은 파일
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-/tmp/stats.json}"
T=tools/research
node -e 'const R=require("./data/roster.json");require("fs").writeFileSync("/tmp/specs40.json",JSON.stringify(R.classes.flatMap(c=>c.specs.map(s=>({id:c.slug+"/"+s.slug})))))'
log() { echo "::group::$*"; }
end() { echo "::endgroup::"; }
for R in world xcn cn kr; do
  log "수집 $R"
  P=5; [ "$R" = kr ] && P=1
  REGION=$R node $T/rio-role500.mjs
  REGION=$R node $T/rio-class500.mjs
  REGION=$R PAGES=$P node $T/rio-spec500.mjs /tmp/specs40.json
  end
done
log "레이드 순위(Raider.IO: 상위 공격대 조합·영웅 특성·진행 현황·초기화) — 주 1회"
# data 브랜치는 매번 통째로 덮어쓰므로, 레이드를 받지 않는 날에도 지난 파일을 먼저 가져와 이어 쓴다
if git fetch -q --depth 1 origin data 2>/dev/null && git show FETCH_HEAD:raid/comp.json > /tmp/prev-comp.json 2>/dev/null; then
  mkdir -p data/raid && cp /tmp/prev-comp.json data/raid/comp.json; echo "지난 레이드 파일 가져옴"
fi
if [ "$(node tools/ci/raid-due.mjs data/raid/comp.json)" = 1 ]; then
  node tools/research/raid-comp.mjs --write || echo "레이드 수집 실패: 지난 파일 유지(8일 넘게 묵으면 다음 날 다시 시도)"
else
  echo "레이드: 이번엔 건너뜀(매주 목요일 04:00 KST 수집)"
fi
end
log "PvP 순위·빌드(Blizzard Battle.net API, 비밀값 BNET_CLIENT_ID/SECRET)"
if [ -n "${BNET_CLIENT_ID:-}" ]; then
  node tools/research/pvp-collect.mjs --write || echo "PvP 수집 실패: 전날 값 유지"
else
  echo "PvP: 비밀값 없음, 건너뜀"
fi
end
log "이상 검사"
node $T/top500.mjs /tmp/rio500.json /tmp/rioclass.json /tmp/riorole.json > /tmp/check.txt
for R in xcn cn kr; do node $T/top500.mjs /tmp/rio500-$R.json /tmp/rioclass-$R.json /tmp/riorole-$R.json --region $R > /tmp/check-$R.txt; done
end
log "반영"
node $T/top500.mjs /tmp/rio500.json /tmp/rioclass.json /tmp/riorole.json --write
for R in xcn cn kr; do node $T/top500.mjs /tmp/rio500-$R.json /tmp/rioclass-$R.json /tmp/riorole-$R.json --region $R --write | tail -1; done
node tools/ci/stats.mjs extract "$OUT"
end
