// PvP 순위·빌드 수집 (Blizzard Battle.net 공식 API) → data/pvp/
// 인증: 환경변수 BNET_CLIENT_ID / BNET_CLIENT_SECRET (GitHub Actions 비밀값), 또는 BNET_CRED_FILE({id, secret} JSON 파일)
// 사용법: node tools/research/pvp-collect.mjs [--write] [--quick]
//  - 지역: us·eu·kr·tw (중국은 공식 API에 없음). 표본: world(네 지역 합침) · kr(한국만)
//  - 1인 난투(shuffle)·블리츠(blitz): 전문화별 순위표를 합쳐 점수 순 상위 TOP명의 전문화 비율, 전문화마다 상위 BUILD_N명의 특성(영웅 특성·특성 코드·PvP 특성)
//  - 3v3·2v2·평점 전장(rbg): 순위표에 전문화가 없어, 상위 TEAM_N명의 캐릭터 정보에서 지금 켜 둔 전문화·영웅 특성·특성을 읽는다(전문화를 바꾼 캐릭터는 다른 전문화로 잡힐 수 있음)
import fs from 'node:fs';
import { decode } from './loadout.mjs';
const ROOT = new URL('../../', import.meta.url).pathname;
const R = JSON.parse(fs.readFileSync(ROOT + 'data/roster.json', 'utf8'));
const QUICK = process.argv.includes('--quick');
const REGIONS = ['us', 'eu', 'kr', 'tw'];
const TOP = { world: 1000, kr: 300 }, TEAM_N = { world: QUICK ? 60 : 500, kr: QUICK ? 30 : 200 }, BUILD_N = { world: QUICK ? 8 : 50, kr: QUICK ? 5 : 20 }, RANK_ROWS = 200;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ID = process.env.BNET_CLIENT_ID, SEC = process.env.BNET_CLIENT_SECRET;
if (!ID && process.env.BNET_CRED_FILE) { const c = JSON.parse(fs.readFileSync(process.env.BNET_CRED_FILE, 'utf8')); ID = c.id; SEC = c.secret; }
if (!ID) { console.error('BNET_CLIENT_ID/BNET_CLIENT_SECRET 또는 BNET_CRED_FILE 필요'); process.exit(2); }
const tokR = await fetch('https://oauth.battle.net/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(ID + ':' + SEC).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
if (!tokR.ok) { console.error('token', tokR.status); process.exit(2); }
const TOK = (await tokR.json()).access_token;
let calls = 0, fails = 0, r429 = 0;
// Battle.net API 한도: 시간당 36,000회(평균 초당 10회). 초당 9회로 고르게 보낸다
const RATE = 9; let nextAt = 0;
const slot = async () => { const now = Date.now(); const t = Math.max(now, nextAt); nextAt = t + 1000 / RATE; if (t > now) await sleep(t - now); };
const api = async (reg, path, ns, loc = 'en_US') => { for (let i = 0; i < 4; i++) { await slot(); calls++; try { const r = await fetch(`https://${reg}.api.blizzard.com${path}${path.includes('?') ? '&' : '?'}namespace=${ns}-${reg}${loc ? '&locale=' + loc : ''}`, { headers: { Authorization: 'Bearer ' + TOK } }); if (r.ok) return await r.json(); if (r.status === 404 || r.status === 403) return null; if (r.status === 429) { r429++; await sleep(2000 * (i + 1)); } } catch (e) {} await sleep(800 * (i + 1)); } fails++; return null; };
// 동시 실행 제한
const pool = async (items, n, fn) => { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; };
// 전문화: 순위표 이름(shuffle-deathknight-blood) ↔ 사이트 id(death-knight/blood)
const SPECS = R.classes.flatMap(c => c.specs.map(s => ({ id: `${c.slug}/${s.slug}`, key: c.slug.replace(/-/g, '') + '-' + s.slug.replace(/-/g, ''), role: s.role, heroes: s.heroes, cls: c.slug, en: s.en, cen: c.en })));
const BY_KEY = Object.fromEntries(SPECS.map(s => [s.key, s]));
const specOfName = (cls, spec) => SPECS.find(s => s.cen === cls && s.en === spec);
// 시즌
const seasonIdx = await api('us', '/data/wow/pvp-season/index', 'dynamic');
const SEASON = seasonIdx.current_season.id;
console.log('season', SEASON);
// 1) 순위표 받기
const boards = {};
for (const reg of REGIONS) {
  const idx = await api(reg, `/data/wow/pvp-season/${SEASON}/pvp-leaderboard/index`, 'dynamic');
  const names = (idx && idx.leaderboards || []).map(x => x.name).filter(n => /^(2v2|3v3|rbg|shuffle-|blitz-)/.test(n));
  const got = await pool(names, 6, n => api(reg, `/data/wow/pvp-season/${SEASON}/pvp-leaderboard/${n}`, 'dynamic'));
  names.forEach((n, i) => { boards[reg + '|' + n] = (got[i] && got[i].entries || []).map(e => ({ reg, name: e.character.name, realm: e.character.realm.slug, rating: e.rating, rank: e.rank, won: e.season_match_statistics ? e.season_match_statistics.won : 0, played: e.season_match_statistics ? e.season_match_statistics.played : 0, faction: e.faction && e.faction.type })); });
  console.log(reg, 'boards', names.length, 'calls', calls);
}
const regsOf = smp => smp === 'kr' ? ['kr'] : REGIONS;
// 2) 캐릭터 특성(전문화·영웅 특성·코드·PvP 특성), 캐시
const prof = {};
const heroSlug = (s, tree) => { if (!tree) return '0'; const nm = tree.name && (tree.name.en_US || tree.name); const h = s && s.heroes.find(x => x.en === nm); return h ? h.slug : '?'; };
const getProf = async p => { const k = `${p.reg}|${p.realm}|${p.name}`; if (k in prof) return prof[k]; const j = await api(p.reg, `/profile/wow/character/${p.realm}/${encodeURIComponent(p.name.toLowerCase())}/specializations`, 'profile', null);
  if (!j || !j.active_specialization) return (prof[k] = null);
  const an = j.active_specialization.name, spEn = an && (an.en_US || an); const clsEn = null;
  const act = (j.specializations || []).find(x => x.specialization.id === j.active_specialization.id) || {};
  const lo = (act.loadouts || []).find(l => l.is_active) || (act.loadouts || [])[0] || {};
  return (prof[k] = { specId: j.active_specialization.id, specEn: spEn, hero: j.active_hero_talent_tree || null, code: lo.talent_loadout_code || null,
    pvp: (act.pvp_talent_slots || []).map(x => x.selected && x.selected.talent ? { id: x.selected.talent.id, spell: x.selected.spell_tooltip && x.selected.spell_tooltip.spell ? x.selected.spell_tooltip.spell.id : null, en: x.selected.talent.name.en_US || x.selected.talent.name, ko: x.selected.talent.name.ko_KR || null } : null).filter(Boolean) }); };
// 전문화 id(블리자드) → 사이트 전문화: 전문화 순위표에서 한 명이라도 잡힌 id 로 배운다
const BLZ = {};
const out = { season: SEASON, src: 'Blizzard Battle.net API', fetched: new Date().toISOString(), date: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), regions: REGIONS, brackets: {} };
const SPEC_OUT = Object.fromEntries(SPECS.map(s => [s.id, { id: s.id, brackets: {} }]));
const RANK = {};
const addBuild = (acc, s, p) => { acc.n++; const h = heroSlug(s, p.hero); acc.hero[h] = (acc.hero[h] || 0) + 1; if (p.code) { const c = acc.codes[p.code] ||= { code: p.code, n: 0, hero: h }; c.n++; } for (const t of p.pvp) { const x = acc.pvp[t.id] ||= { n: 0, en: t.en, ko: t.ko, spell: t.spell }; x.n++; } };
const newAcc = () => ({ n: 0, other: 0, noinfo: 0, hero: {}, codes: {}, pvp: {} });
// 대표 빌드: 특성 코드가 사람마다 조금씩 달라 "완전히 같은 코드" 개수는 의미가 없다. 영웅 특성별로 코드를 노드 단위로 풀어,
// 다른 사람들 코드와 노드가 가장 많이 겹치는 실제 코드(medoid)를 고른다. agree = 그 코드와 다른 사람들의 평균 노드 일치율(누구라도 고른 노드 기준)
const medoid = list => { // list: [{code, n}]
  const D = list.map(x => ({ ...x, d: decode(x.code) })).filter(x => x.d);
  if (!D.length) return null; const len = Math.max(...D.map(x => x.d.nodes.length));
  const U = []; for (let i = 0; i < len; i++) if (D.some(x => (x.d.nodes[i] || 0) > 0)) U.push(i);
  const dist = (a, b) => U.reduce((s, i) => s + ((a.d.nodes[i] || 0) !== (b.d.nodes[i] || 0) ? 1 : 0), 0);
  let best = null, bestS = Infinity; const tot = D.reduce((s, x) => s + x.n, 0);
  for (const a of D) { let s = 0; for (const b of D) s += dist(a, b) * b.n; if (s < bestS) { bestS = s; best = a; } }
  const others = tot - 1; const agree = others > 0 && U.length ? Math.round((1 - (bestS / others) / U.length) * 100) : 100;
  return { code: best.code, n: tot, agree };
};
const finAcc = a => { const byHero = {}; for (const c of Object.values(a.codes)) (byHero[c.hero] ||= []).push(c);
  const builds = Object.entries(byHero).map(([h, L]) => { const m = medoid(L); return m ? { ...m, hero: h } : null; }).filter(Boolean).sort((x, y) => y.n - x.n);
  return { n: a.n, other: a.other, noinfo: a.noinfo, hero: a.hero, builds, pvp: Object.fromEntries(Object.entries(a.pvp).sort((x, y) => y[1].n - x[1].n).slice(0, 12)) }; };
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
// 3) 1인 난투·블리츠
for (const br of ['shuffle', 'blitz']) {
  out.brackets[br] = {};
  for (const smp of ['world', 'kr']) {
    const all = []; const perSpec = {};
    for (const s of SPECS) { const L = regsOf(smp).flatMap(reg => (boards[`${reg}|${br}-${s.key}`] || []).map(e => ({ ...e, spec: s.id }))); perSpec[s.id] = L.sort((a, b) => b.rating - a.rating); all.push(...L); }
    all.sort((a, b) => b.rating - a.rating); const top = all.slice(0, TOP[smp]);
    const specs = {}; for (const s of SPECS) { const L = perSpec[s.id]; const inTop = top.filter(e => e.spec === s.id).length; specs[s.id] = { n: inTop, total: L.length, best: L[0] ? L[0].rating : null, med: med(L.map(e => e.rating)), p90: L.length ? L[Math.floor(L.length * 0.1)].rating : null }; }
    out.brackets[br][smp] = { top: top.length, cutoff: top.length ? top[top.length - 1].rating : null, ranked: all.length, specs };
    RANK[`${br}${smp === 'kr' ? '.kr' : ''}`] = { bracket: br, sample: smp, rows: top.slice(0, RANK_ROWS).map((e, i) => [i + 1, e.rating, e.name, e.realm, e.reg, e.spec, null, e.won, e.played]) };
    // 전문화별 빌드: 상위 BUILD_N명
    await pool(SPECS, 6, async s => { const L = perSpec[s.id].slice(0, BUILD_N[smp]); const acc = newAcc(); const ps = await pool(L, 4, getProf);
      L.forEach((e, i) => { const p = ps[i]; if (!p) { acc.noinfo++; return; } if (p.specEn !== s.en) { acc.other++; return; } BLZ[p.specId] = s.id; addBuild(acc, s, p); e.hero = heroSlug(s, p.hero); });
      (SPEC_OUT[s.id].brackets[br] ||= {})[smp] = { ...finAcc(acc), total: perSpec[s.id].length, best: specs[s.id].best, top: perSpec[s.id].slice(0, 20).map(e => [e.rating, e.name, e.realm, e.reg, e.hero || null, e.won, e.played]) }; });
    console.log(br, smp, 'ranked', all.length, 'top cutoff', out.brackets[br][smp].cutoff, 'calls', calls);
  }
}
for (const k of Object.keys(RANK)) for (const r of RANK[k].rows) { if (r[6]) continue; const p = prof[`${r[4]}|${r[3]}|${r[2]}`]; const sp = SPECS.find(x => x.id === r[5]); if (p && sp && p.specEn === sp.en) r[6] = heroSlug(sp, p.hero); }
// 4) 3v3·2v2·평점 전장: 상위 TEAM_N명의 지금 전문화
const idToSpec = id => BLZ[id] || null;
for (const br of ['3v3', '2v2', 'rbg']) {
  out.brackets[br] = {};
  for (const smp of ['world', 'kr']) {
    const all = regsOf(smp).flatMap(reg => boards[`${reg}|${br}`] || []).sort((a, b) => b.rating - a.rating); const top = all.slice(0, TEAM_N[smp]);
    const ps = await pool(top, 16, getProf); const specs = {}; let noinfo = 0, unknown = 0; const acc = {};
    top.forEach((e, i) => { const p = ps[i]; if (!p) { noinfo++; return; } let sid = idToSpec(p.specId); if (!sid) { const s = SPECS.find(x => x.en === p.specEn && p.code); sid = null; } if (!sid) { unknown++; return; } e.spec = sid; const s = SPECS.find(x => x.id === sid); e.hero = heroSlug(s, p.hero); specs[sid] = (specs[sid] || 0) + 1; addBuild(acc[sid] ||= newAcc(), s, p); });
    out.brackets[br][smp] = { top: top.length, cutoff: top.length ? top[top.length - 1].rating : null, ranked: all.length, noinfo, unknown, specs: Object.fromEntries(Object.entries(specs).map(([k, n]) => [k, { n }])) };
    for (const [sid, a] of Object.entries(acc)) ((SPEC_OUT[sid].brackets[br] ||= {})[smp] = { ...finAcc(a), note: 'team' });
    RANK[`${br}${smp === 'kr' ? '.kr' : ''}`] = { bracket: br, sample: smp, rows: top.slice(0, RANK_ROWS).map((e, i) => [i + 1, e.rating, e.name, e.realm, e.reg, e.spec || null, e.hero || null, e.won, e.played]) };
    console.log(br, smp, 'top', top.length, 'noinfo', noinfo, 'unknown', unknown, 'calls', calls);
  }
}
// 5) 평점 구간(한글 이름 포함)
const tierIdx = await api('us', '/data/wow/pvp-tier/index', 'static', null);
out.tiers = [];
for (const t of (tierIdx && tierIdx.tiers || [])) { const j = await api('us', `/data/wow/pvp-tier/${t.id}`, 'static', null); if (j) out.tiers.push({ id: j.id, en: j.name && j.name.en_US, ko: j.name && j.name.ko_KR, min: j.min_rating, max: j.max_rating, bracket: j.pvp_bracket && j.pvp_bracket.type }); }
console.log('calls', calls, 'fails', fails, '429', r429, 'profiles', Object.keys(prof).length, 'blz spec ids', Object.keys(BLZ).length);
out.calls = calls; out.fails = fails;
if (process.argv.includes('--write')) {
  const D = ROOT + 'data/pvp/'; fs.mkdirSync(D + 'spec', { recursive: true }); fs.mkdirSync(D + 'rank', { recursive: true });
  fs.writeFileSync(D + 'meta.json', JSON.stringify(out) + '\n');
  for (const [id, v] of Object.entries(SPEC_OUT)) fs.writeFileSync(D + 'spec/' + id.replace('/', '-') + '.json', JSON.stringify(v) + '\n');
  for (const [k, v] of Object.entries(RANK)) fs.writeFileSync(D + 'rank/' + k + '.json', JSON.stringify(v) + '\n');
  console.log('wrote data/pvp');
}
