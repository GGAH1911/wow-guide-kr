// 전문화마다 Raider.IO 쐐기 점수 순위 상위 500명의 특성 코드 → /tmp/rio500<SUF>.json  (인자: specs40.json)
// 한 줄: [순위, 점수, 특성 코드, 이름, 서버, 지역, 경로]. REGION 은 rio-common.mjs 참고, PAGES(기본 5, 한국은 1)
import fs from 'node:fs';
import { REGION, API_REGION, SUF, collect, seedOf, who, FAILED } from './rio-common.mjs';
const PAGES = Number(process.env.PAGES || 5);
const L = JSON.parse(fs.readFileSync(process.argv[2] || '/tmp/specs40.json', 'utf8'));
const out = { fetched: new Date().toISOString(), region: REGION, specs: {}, failed: FAILED }; const seed = seedOf('rio500', 'specs');
for (const s of L) { const [cls, sp] = s.id.split('/');
  out.specs[s.id] = await collect(p => `https://raider.io/api/mythic-plus/rankings/specs?region=${API_REGION}&season=season-mn-2&class=${cls}&spec=${sp}&page=${p}`,
    x => [x.rank, x.score, x.character.talentLoadoutText || '', ...who(x)], 5, seed && seed[s.id], PAGES);
  fs.writeFileSync(`/tmp/rio500${SUF}.json`, JSON.stringify(out)); }
