// Raider.IO 순위 수집 공용. REGION: world(세계) | kr(한국 순위) | cn(중국 순위) | xcn(세계 순위에서 중국 서버를 뺀 상위 500명)
// xcn 은 세계 순위를 500등 아래로 계속 내려가며 중국 서버가 아닌 캐릭터가 500명 찰 때까지 받는다.
// 앞쪽은 같은 날 받은 세계 수집본(/tmp/<이름>.json)을 재사용하므로, 세계 수집을 먼저 돌려야 한다.
import fs from 'node:fs';
export const REGION = process.env.REGION || 'world';
export const API_REGION = REGION === 'xcn' ? 'world' : REGION;
export const SUF = REGION === 'world' ? '' : '-' + REGION;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const get = async u => { for (let i = 0; i < 5; i++) { try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (r.ok) return await r.json(); } catch (e) {} await sleep(3000 * (i + 1)); } return null; };
const MAX_PAGES = 40;
// urlOf(page) → API 주소, rowOf(character entry) → 한 줄, regionIdx: 줄에서 지역 칸, seed: 세계 수집본의 같은 목록(xcn 일 때), pages: world/kr 페이지 수
export async function collect(urlOf, rowOf, regionIdx, seed, pages = 5) {
  if (REGION !== 'xcn') {
    const rows = [];
    for (let p = 0; p < pages; p++) { const j = await get(urlOf(p)); const x = (j && j.rankings && j.rankings.rankedCharacters) || []; for (const c of x) rows.push(rowOf(c)); await sleep(1200); if (j && x.length < 100) break; }
    return rows;
  }
  const rows = seed ? seed.slice() : []; let p = Math.ceil(rows.length / 100);
  const nonCn = () => rows.filter(r => r[regionIdx] !== 'cn').length;
  while (nonCn() < 500 && p < MAX_PAGES) { const j = await get(urlOf(p)); const x = (j && j.rankings && j.rankings.rankedCharacters) || []; for (const c of x) rows.push(rowOf(c)); p++; await sleep(1200); if (j && x.length < 100) break; }
  return rows.filter(r => r[regionIdx] !== 'cn').slice(0, 500);
}
export const seedOf = (name, key) => { if (REGION !== 'xcn') return null; try { return JSON.parse(fs.readFileSync(`/tmp/${name}.json`, 'utf8'))[key]; } catch (e) { return null; } };
export const who = x => [x.character.name, x.character.realm ? x.character.realm.name : '', x.character.region ? x.character.region.slug : '', x.character.path || ''];
