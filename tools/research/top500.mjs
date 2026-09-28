// Raider.IO 수집본(rio500.json)으로 roster 에 넣을 값을 만든다.
//  - mplus: 상위 쐐기 기록 500개에 나온 같은 직업 캐릭터(기록별 등장 횟수) 가운데 전문화 비율
//  - hero500: 전문화 순위 상위 500명의 특성 코드에서 영웅 트리 판별(hero-markers.json 기준 노드 투표)
// 사용법: node top500.mjs <rio500.json> <rioclass.json> <riorole.json> [--write]  (--write 면 data/roster.json 갱신)
//  - roleShare 는 역할 점수 순위 상위 500명(riorole.json)의 전문화 비율. 순위의 전문화는 지금 켜 둔 전문화라, 직업의 그 역할 전문화가 하나면 그것으로 세고,
//    둘 이상(사제 힐러, 딜러)이면 켜 둔 전문화가 그 역할일 때만 센다(아니면 분모에서 뺀다)
//  - mplus 는 직업 점수 순위 상위 500명(rioclass.json)의 전문화 비율로 센다(전문화 표시가 없는 캐릭터는 분모에서 뺀다)
import fs from 'node:fs';
import { decode } from './loadout.mjs';
const ROOT = new URL('../../', import.meta.url).pathname;
// --region kr|cn|xcn: 따로 받은 표본(한국 순위 / 중국 순위 / 세계에서 중국 서버를 뺀 상위 500명, -kr.json·-cn.json·-xcn.json)으로 roster 의 s.<region>·meta.mplus500<region> 와 data/rank/<region>/ 를 쓴다
const ARGS = process.argv.slice(2); const ri = ARGS.indexOf('--region'); const REGION = ri >= 0 ? ARGS[ri + 1] : 'world'; if (ri >= 0) ARGS.splice(ri, 2);
const KR = REGION !== 'world'; // 따로 받은 표본
const LOW = REGION === 'kr'; // 한국: 표본이 작아 전문화 50명·이상 검사 기준 완화
const [src, clsSrc, roleSrc, flag] = ARGS;
// 점수 0 인 캐릭터(한국처럼 표본이 작은 지역의 드문 전문화 끝자락)는 순위에서 뺀다
const live = rows => rows.filter(r => Number(r[1]) > 0);
const RL = JSON.parse(fs.readFileSync(roleSrc, 'utf8')); for (const k of Object.keys(RL.roles)) RL.roles[k] = live(RL.roles[k]);
// 전체 순위(역할 구분 없음)는 순위표 파일만 쓰고 비율 계산에서는 뺀다
const ALL = RL.roles.all || null; delete RL.roles.all;
const CL = JSON.parse(fs.readFileSync(clsSrc, 'utf8')); for (const k of Object.keys(CL.classes)) CL.classes[k] = live(CL.classes[k]);
// 한국은 전문화 순위를 상위 50명까지만 쓴다(드문 전문화는 아래쪽 점수가 너무 낮아서). 직업·역할 순위는 500명
const SPEC_TOP = LOW ? 50 : 500;
const D = JSON.parse(fs.readFileSync(src, 'utf8')); for (const k of Object.keys(D.specs)) D.specs[k] = live(D.specs[k]).slice(0, SPEC_TOP);
const MK = JSON.parse(fs.readFileSync(ROOT + 'tools/research/hero-markers.json', 'utf8'));
const SEL = JSON.parse(fs.readFileSync(ROOT + 'tools/research/hero-select-nodes.json', 'utf8')).sel;
const R = JSON.parse(fs.readFileSync(ROOT + 'data/roster.json', 'utf8'));
// 특성 코드 → 영웅 slug | '0'(순위에 특성 코드가 없음) | '~'(지금 다른 전문화 특성) | '?'(이 전문화 코드인데 영웅 트리 선택이 비어 있음)
const heroKey = (id, s, code) => { if (!code) return '0'; const d = decode(code); if (!d || !MK[id].specId.includes(d.specId)) return '~'; const [ix, c0] = SEL[id]; const v = d.nodes[ix] || 0; if (v < 10) return '?'; return (v - 10) === c0 ? s.heroes[0].slug : s.heroes[1].slug; };
// 세계 상위 500명을 서버 지역으로 나눈 부분 표본(중국 제외 xcn, 중국만 cn)의 비율. 지역 칸: 직업·전문화 순위 r[5], 역할 순위 r[6]
function subsetStats(pred) {
  const out = {}, roles = {};
  const cntS = {}, rankedC = {};
  for (const [c, rows] of Object.entries(CL.classes)) { const rr = rows.filter(r => pred(r[5])); rankedC[c] = rr.length; for (const r of rr) { if (!r[2]) continue; cntS[c] ||= {}; cntS[c][r[2]] = (cntS[c][r[2]] || 0) + 1; } }
  const rc = {}, rt = {}, rsk = {};
  for (const [role, rows] of Object.entries(RL.roles)) { rc[role] = {}; rt[role] = 0; rsk[role] = 0; const rr = rows.filter(r => pred(r[6]));
    for (const [, , cls, sp] of rr) { const c = R.classes.find(x => x.slug === cls); const cand = c ? c.specs.filter(s => s.role === role) : []; const pick = cand.length === 1 ? cand[0] : cand.find(s => s.slug === sp); if (!pick) { rsk[role]++; continue; } const id = `${cls}/${pick.slug}`; rc[role][id] = (rc[role][id] || 0) + 1; rt[role]++; }
    roles[role] = { ranked: rr.length, counted: rt[role], skipped: rsk[role] }; }
  for (const c of R.classes) { const tot = Object.values(cntS[c.slug] || {}).reduce((a, b) => a + b, 0);
    for (const s of c.specs) { const id = `${c.slug}/${s.slug}`; const n = (cntS[c.slug] || {})[s.slug] || 0; const counts = Object.fromEntries(s.heroes.map(h => [h.slug, 0])); let ok = 0, other = 0, unk = 0, none = 0;
      const rows = (D.specs[id] || []).filter(r => pred(r[5]));
      for (const r of rows) { const k = heroKey(id, s, r[2]); if (k === '0') none++; else if (k === '~') other++; else if (k === '?') unk++; else { counts[k]++; ok++; } }
      const rn = rc[s.role][id] || 0;
      out[id] = { mplus: { n, classN: tot, ranked: rankedC[c.slug], share: tot ? Math.round(n / tot * 100) : null }, hero500: { counts, n: ok, excluded: other, unknown: unk, noinfo: none, ranked: rows.length }, roleShare: { n: rn, roleN: rt[s.role], share: rt[s.role] ? Math.round(rn / rt[s.role] * 1000) / 10 : null } }; } }
  return { out, roles };
}
// 직업 안 전문화 비율
const cnt = {}; for (const [c, rows] of Object.entries(CL.classes)) for (const [, , sp] of rows) { if (!sp) continue; cnt[c] ||= {}; cnt[c][sp] = (cnt[c][sp] || 0) + 1; }
const res = {}, RANK = {};
// 순위표 한 줄: [순위, 점수, 이름, 서버, 지역, Raider.IO 경로, 분류 키]
const rankRow = (rank, score, who, key) => [rank, Math.round(score * 10) / 10, who[0] || '', who[1] || '', who[2] || '', who[3] || '', key];
for (const [c, rows] of Object.entries(CL.classes)) RANK[`class-${c}`] = { kind: 'class', id: c, rows: rows.map(([rank, score, sp, ...who]) => rankRow(rank, score, who, sp || '?')) }; const vote = (d, mk) => { const sc = Object.fromEntries(Object.entries(mk).map(([h, m]) => [h, m.filter(i => (d.nodes[i] || 0) > 0).length / Math.max(1, m.length)])); const [a, b] = Object.entries(sc).sort((x, y) => y[1] - x[1]); return a[1] >= 0.6 && a[1] - b[1] >= 0.4 ? a[0] : null; };
for (const c of R.classes) { const tot = Object.values(cnt[c.slug] || {}).reduce((a, b) => a + b, 0);
  for (const s of c.specs) { const id = `${c.slug}/${s.slug}`; const n = (cnt[c.slug] || {})[s.slug] || 0;
    const m = MK[id]; const rows = D.specs[id] || []; const counts = Object.fromEntries(s.heroes.map(h => [h.slug, 0])); let ok = 0, other = 0, unk = 0, none = 0, top50 = Object.fromEntries(s.heroes.map(h => [h.slug, 0]));
    const rk = [];
    for (const [rank, score, code, ...who] of rows) { const key = heroKey(id, s, code);
      if (key === '0') none++; else if (key === '~') other++; else if (key === '?') unk++; else { counts[key]++; ok++; if (rank <= 50) top50[key]++; }
      rk.push(rankRow(rank, score, who, key)); }
    RANK[`spec-${c.slug}-${s.slug}`] = { kind: 'spec', id, rows: rk };
    res[id] = { mplus: { n, classN: tot, ranked: (CL.classes[c.slug] || []).length, share: tot ? Math.round(n / tot * 100) : null }, hero500: { counts, n: ok, excluded: other, unknown: unk, noinfo: none, ranked: rows.length }, top50 };
  } }
// 역할 안 전문화 비율
const roleCnt = {}, roleTot = {}, roleSkip = {};
for (const [role, rows] of Object.entries(RL.roles)) { roleCnt[role] = {}; roleTot[role] = 0; roleSkip[role] = 0;
  const rk = [];
  for (const [rank, score, cls, sp, ...who] of rows) { const c = R.classes.find(x => x.slug === cls); const cand = c ? c.specs.filter(s => s.role === role) : []; const pick = cand.length === 1 ? cand[0] : cand.find(s => s.slug === sp);
    rk.push(rankRow(rank, score, who, `${cls}/${pick ? pick.slug : '?'}`));
    if (!pick) { roleSkip[role]++; continue; } const id = `${cls}/${pick.slug}`; roleCnt[role][id] = (roleCnt[role][id] || 0) + 1; roleTot[role]++; }
  RANK[`role-${role}`] = { kind: 'role', id: role, rows: rk }; }
for (const c of R.classes) for (const s of c.specs) { const id = `${c.slug}/${s.slug}`; const n = roleCnt[s.role][id] || 0; res[id].roleShare = { n, roleN: roleTot[s.role], share: roleTot[s.role] ? Math.round(n / roleTot[s.role] * 1000) / 10 : null }; }
for (const role of Object.keys(RL.roles)) if (roleTot[role] < (LOW ? 300 : 400)) { console.error(`이상 검사 실패: ${role} 순위에서 센 인원 ${roleTot[role]}명 (뺀 인원 ${roleSkip[role]})`); process.exit(2); }
console.log('역할 비율:', Object.entries(roleTot).map(([r, n]) => `${r} ${n}명(뺀 ${roleSkip[r]})`).join(', '));
const MC = process.env.MURLOK_CACHE; // 선택: 로컬 비교용 캐시 파일
const M = MC && fs.existsSync(MC) ? JSON.parse(fs.readFileSync(MC, 'utf8')) : {};
for (const [id, v] of Object.entries(res)) console.log(id.padEnd(26), `share ${String(v.mplus.share).padStart(3)}% (${v.mplus.n}/${v.mplus.classN})`, '| hero500', JSON.stringify(v.hero500.counts), `ok ${v.hero500.n} other ${v.hero500.excluded} unk ${v.hero500.unknown}`, '| rio top50', JSON.stringify(v.top50), '| murlok', JSON.stringify((M[id] || {}).counts));
// 이상 검사: 패치로 특성 트리가 바뀌면 선택 노드 판별이 깨지므로, 판별 못 한 비율이나 표본이 이상하면 쓰지 않는다
const probs = [];
for (const [id, v] of Object.entries(res)) {
  const h = v.hero500; const tried = h.n + h.unknown;
  if (h.ranked < (LOW ? 30 : 400)) probs.push(`${id}: 순위 ${h.ranked}명만 받음`);
  if (h.n < (LOW ? 10 : 150)) probs.push(`${id}: 판별된 인원 ${h.n}명`);
  if (tried && h.unknown / tried > 0.1) probs.push(`${id}: 영웅 판별 실패 ${h.unknown}/${tried} (선택 노드 번호가 바뀌었을 수 있음)`);
  if (v.mplus.classN < (LOW ? 100 : 400)) probs.push(`${id}: 직업 순위 ${v.mplus.classN}명만 받음`);
}
if (probs.length) { console.error('이상 검사 실패:\n' + probs.join('\n')); process.exit(2); }
if (flag === '--write') {
  const META = { src: 'Raider.IO', date: new Date(Date.parse(D.fetched) + 9 * 3600e3).toISOString().slice(0, 10), /* 한국 날짜(매일 04:00 KST 수집은 UTC로 전날) */ season: 'season-mn-2', top: 500, specTop: SPEC_TOP, region: REGION, roles: Object.fromEntries(Object.keys(RL.roles).map(r => [r, { ranked: RL.roles[r].length, counted: roleTot[r], skipped: roleSkip[r] }])) };
  if (KR) R.meta['mplus500' + REGION] = META; else R.meta.mplus500 = META;
  // 순위표 파일(data/rank/*.json, 한국은 data/rank/kr/*.json): 사이트의 /rank/ 화면이 읽는다
  const RD = ROOT + 'data/rank/' + (KR ? REGION + '/' : ''); fs.mkdirSync(RD, { recursive: true });
  for (const f of fs.readdirSync(RD)) if (f.endsWith('.json')) fs.rmSync(RD + f);
  if (ALL) RANK.all = { kind: 'all', id: 'all', rows: ALL.map(([rank, score, cls, sp, ...who]) => { const c = R.classes.find(x => x.slug === cls); const s = c && c.specs.find(x => x.slug === sp); return rankRow(rank, score, who, `${cls}/${s ? s.slug : '?'}`); }) };
  for (const [f, v] of Object.entries(RANK)) fs.writeFileSync(RD + f + '.json', JSON.stringify({ ...v, date: META.date, src: 'Raider.IO', region: REGION }) + '\n');
  delete R.meta.top50;
  for (const c of R.classes) for (const s of c.specs) { const v = res[`${c.slug}/${s.slug}`]; const o = { mplus: v.mplus, hero500: { counts: v.hero500.counts, n: v.hero500.n, excluded: v.hero500.excluded, unknown: v.hero500.unknown, noinfo: v.hero500.noinfo, ranked: v.hero500.ranked }, roleShare: v.roleShare };
    if (KR) s[REGION] = o; else { Object.assign(s, o); delete s.top50; } }
  // (예전에는 여기서 세계 500명을 지역으로 나눈 부분 표본 xcn·cn 을 썼다. 지금은 둘 다 따로 받는다)

  fs.writeFileSync(ROOT + 'data/roster.json', JSON.stringify(R) + '\n'); console.log('roster 갱신');
}
