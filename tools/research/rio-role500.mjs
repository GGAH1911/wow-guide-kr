// 역할마다(+전체) Raider.IO 쐐기 점수 순위 상위 500명의 직업·지금 켜 둔 전문화 → /tmp/riorole<SUF>.json
// 한 줄: [순위, 점수, 직업, 전문화, 이름, 서버, 지역, 경로]. REGION 은 rio-common.mjs 참고
import fs from 'node:fs';
import { REGION, API_REGION, SUF, collect, seedOf, who, FAILED } from './rio-common.mjs';
const out = { fetched: new Date().toISOString(), region: REGION, roles: {}, failed: FAILED }; const seed = seedOf('riorole', 'roles');
// all = 역할·직업 구분 없는 전체 순위(순위표의 "전체")
for (const role of ['tank', 'healer', 'dps', 'all'])
  out.roles[role] = await collect(p => `https://raider.io/api/mythic-plus/rankings/characters?region=${API_REGION}&season=season-mn-2&class=all&role=${role}&page=${p}`,
    x => [x.rank, x.score, x.character.class.slug, x.character.spec ? x.character.spec.slug : '', ...who(x)], 6, seed && seed[role]);
fs.writeFileSync(`/tmp/riorole${SUF}.json`, JSON.stringify(out));
