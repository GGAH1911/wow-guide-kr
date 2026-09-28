// 직업마다 Raider.IO 쐐기 점수 순위 상위 500명의 지금 켜 둔 전문화 → /tmp/rioclass<SUF>.json
// 한 줄: [순위, 점수, 전문화, 이름, 서버, 지역, 경로]. REGION 은 rio-common.mjs 참고
import fs from 'node:fs';
import { REGION, API_REGION, SUF, collect, seedOf, who } from './rio-common.mjs';
const CL = ['warrior','paladin','hunter','rogue','priest','death-knight','shaman','mage','warlock','monk','druid','demon-hunter','evoker'];
const out = { fetched: new Date().toISOString(), region: REGION, classes: {} }; const seed = seedOf('rioclass', 'classes');
for (const c of CL) {
  out.classes[c] = await collect(p => `https://raider.io/api/mythic-plus/rankings/characters?region=${API_REGION}&season=season-mn-2&class=${c}&role=all&page=${p}`,
    x => [x.rank, x.score, x.character.spec ? x.character.spec.slug : '', ...who(x)], 5, seed && seed[c]);
  fs.writeFileSync(`/tmp/rioclass${SUF}.json`, JSON.stringify(out)); }
