// Raider.IO 순위 수집 공용. REGION: world(세계) | kr(한국 순위) | cn(중국 순위) | xcn(세계 순위에서 중국 서버를 뺀 상위 500명)
// xcn 은 세계 순위를 500등 아래로 계속 내려가며 중국 서버가 아닌 캐릭터가 500명 찰 때까지 받는다.
// 앞쪽은 같은 날 받은 세계 수집본(/tmp/<이름>.json)을 재사용하므로, 세계 수집을 먼저 돌려야 한다.
import fs from 'node:fs';
export const REGION = process.env.REGION || 'world';
export const API_REGION = REGION === 'xcn' ? 'world' : REGION;
export const SUF = REGION === 'world' ? '' : '-' + REGION;
// RIO_WAIT_SCALE: 기다리는 시간 배율(시험용, 기본 1)
const WS = Number(process.env.RIO_WAIT_SCALE || 1);
export const sleep = ms => new Promise(r => setTimeout(r, ms * WS));
// 요청 한 번: 5번까지 3·6·9·12초 간격으로 다시 시도. 끝내 실패하면 null, 마지막 실패 이유는 lastErr(HTTP 코드 또는 오류)
let lastErr = '';
export const get = async u => { for (let i = 0; i < 5; i++) { try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (r.ok) return await r.json(); lastErr = 'HTTP ' + r.status; } catch (e) { lastErr = (e && e.message) || String(e); } await sleep(3000 * (i + 1)); } return null; };
// 순위 한 쪽(100명): 실패하면 30·60·120초 쉬고 다시(Raider.IO 일시 장애·막힘). 그래도 실패하면 FAILED 에 남기고 경고를 찍는다(빈 쪽으로 조용히 넘기지 않는다).
// Raider.IO 가 통째로 멈춘 날 수집이 제한 시간(150분)을 넘지 않게, 실패가 5건 쌓이면 긴 대기는 건너뛴다. 결과 파일의 failed 칸으로 top500.mjs 이상 검사가 알린다.
export const FAILED = [];
const LONG = [30, 60, 120];
async function getPage(url, label, p) {
  let j = await get(url);
  for (const w of LONG) { if (j || FAILED.length >= 5) break; console.error(`Raider.IO 요청 실패(${lastErr}) ${REGION} ${label} ${p + 1}쪽 → ${w}초 뒤 다시`); await sleep(w * 1000); j = await get(url); }
  if (!j) { FAILED.push({ label, page: p + 1, err: lastErr }); console.log(`::warning::Raider.IO 요청 실패: ${REGION} ${label} ${p + 1}쪽 (${lastErr})`); }
  return j;
}
// 주소에서 목록 이름: 전문화 순위 hunter/survival, 직업 순위 hunter, 역할 순위 role:tank
const labelOf = u => { const q = new URL(u).searchParams, c = q.get('class'), sp = q.get('spec'), role = q.get('role'); return sp ? `${c}/${sp}` : c && c !== 'all' ? c : `role:${role}`; };
const MAX_PAGES = 40;
// urlOf(page) → API 주소, rowOf(character entry) → 한 줄, regionIdx: 줄에서 지역 칸, seed: 세계 수집본의 같은 목록(xcn 일 때), pages: world/kr 페이지 수
export async function collect(urlOf, rowOf, regionIdx, seed, pages = 5) {
  const label = labelOf(urlOf(0));
  if (REGION !== 'xcn') {
    const rows = [];
    for (let p = 0; p < pages; p++) { const j = await getPage(urlOf(p), label, p); const x = (j && j.rankings && j.rankings.rankedCharacters) || []; for (const c of x) rows.push(rowOf(c)); await sleep(1200); if (j && x.length < 100) break; }
    return rows;
  }
  const rows = seed ? seed.slice() : []; let p = Math.ceil(rows.length / 100);
  const nonCn = () => rows.filter(r => r[regionIdx] !== 'cn').length;
  while (nonCn() < 500 && p < MAX_PAGES) { const j = await getPage(urlOf(p), label, p); const x = (j && j.rankings && j.rankings.rankedCharacters) || []; for (const c of x) rows.push(rowOf(c)); p++; await sleep(1200); if (j && x.length < 100) break; }
  return rows.filter(r => r[regionIdx] !== 'cn').slice(0, 500);
}
export const seedOf = (name, key) => { if (REGION !== 'xcn') return null; try { return JSON.parse(fs.readFileSync(`/tmp/${name}.json`, 'utf8'))[key]; } catch (e) { return null; } };
export const who = x => [x.character.name, x.character.realm ? x.character.realm.name : '', x.character.region ? x.character.region.slug : '', x.character.path || ''];
