// 레이드 신화 상위 공격대 처치 조합(전문화 채용) → data/raid/comp.json
// 출처: Raider.IO 공개 API
//   - 보스별 순위: /api/v1/raiding/boss-rankings?raid&boss&difficulty=mythic&region=world|kr|cn (처음 처치 순, 최대 50)
//   - 공격대별 처치 명단: /api/v1/guilds/boss-kill?region&realm&guild&raid&boss&difficulty=mythic (첫 처치의 20명과 전문화)
// 표본 4가지(사이트 공통 순서): world 세계 · xcn 세계(중국 제외: 세계 순위에서 중국 공격대를 뺀 앞쪽) · kr 한국 · cn 중국. 표본마다 상위 20개(모자라면 있는 만큼)
// 추가로 담는 것
//   - 전문화별 레이드 영웅 특성: 처치 명단 빌드 코드(loadoutText)를 쐐기 500명과 같은 방법(top500.mjs heroKey: hero-markers + hero-select-nodes)으로 판별
//   - 진행 현황: /raiding/raid-rankings 를 100곳씩 끝까지 넘겨 보스마다 신화 처치 공격대 수(세계에는 중국 공격대도 들어 있어 세계(중국 제외) = 세계에서 중국 뺀 것), 소굴(보스 1개)은 /raiding/progression
//   - 최초 처치: 보스별 순위 1위, 주간 초기화: /raiding/static-data 지역별 레이드 시작 시각(여기서 7일마다)
// 사용법: node tools/research/raid-comp.mjs [--write]
import fs from 'node:fs';
import { decode } from './loadout.mjs';
const ROOT = new URL('../../', import.meta.url).pathname;
const R = JSON.parse(fs.readFileSync(ROOT + 'data/roster.json', 'utf8'));
const TOP = 20;
const BOSSES = [
  ['the-venomous-abyss', 'nekzali-the-soulcoiler'], ['the-venomous-abyss', 'entombed-sentinels'], ['the-venomous-abyss', 'vashnik-the-malignant'], ['the-venomous-abyss', 'the-lost-explorers'],
  ['the-venomous-abyss', 'sszorak'], ['the-venomous-abyss', 'the-twin-fangs'], ['the-venomous-abyss', 'the-coiled-altar'], ['the-venomous-abyss', 'ulatek'], ['the-tidebound-grotto', 'nymrissa-wavecaller'],
];
const specIds = new Set(R.classes.flatMap(c => c.specs.map(s => `${c.slug}/${s.slug}`)));
const SPEC = Object.fromEntries(R.classes.flatMap(c => c.specs.map(s => [`${c.slug}/${s.slug}`, s])));
const MK = JSON.parse(fs.readFileSync(ROOT + 'tools/research/hero-markers.json', 'utf8'));
const SEL = JSON.parse(fs.readFileSync(ROOT + 'tools/research/hero-select-nodes.json', 'utf8')).sel;
// top500.mjs 와 같은 판별: 영웅 slug | '~'(다른 전문화 코드) | '?'(영웅 트리 미선택) | '0'(코드 없음)
const heroKey = (id, code) => { if (!code) return '0'; const d = decode(code); if (!d || !MK[id].specId.includes(d.specId)) return '~'; const [ix, c0] = SEL[id]; const v = d.nodes[ix] || 0; if (v < 10) return '?'; const h = SPEC[id].heroes; return (v - 10) === c0 ? h[0].slug : h[1].slug; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (r.ok) return await r.json(); if (r.status === 400 || r.status === 404) return null; } catch (e) {} await sleep(2500 * (i + 1)); } return null; };
const B = 'https://raider.io/api/v1';
const out = { progress: { world: {}, xcn: {}, kr: {}, cn: {} }, resets: null, src: 'Raider.IO', fetched: new Date().toISOString(), date: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), top: TOP, samples: { world: {}, xcn: {}, kr: {}, cn: {} } };
const rosterCache = {}; let req = 0, missing = 0;
for (const [raid, boss] of BOSSES) {
  const lists = {};
  for (const reg of ['world', 'kr', 'cn']) { const j = await get(`${B}/raiding/boss-rankings?raid=${raid}&boss=${boss}&difficulty=mythic&region=${reg}`); req++; lists[reg] = (j && j.bossRankings) || []; await sleep(900); }
  // 처치 명단을 비공개로 둔 공격대는 건너뛰고 다음 순위로 채운다(표본마다 명단 공개 TOP곳까지)
  const pick = { world: lists.world, xcn: lists.world.filter(x => x.guild.region.slug !== 'cn'), kr: lists.kr, cn: lists.cn };
  for (const [smp, L] of Object.entries(pick)) {
    const kills = []; const specs = {}; let seen = 0;
    for (const e of L) {
      if (kills.length >= TOP) break; seen++;
      const g = e.guild, key = `${boss}|${g.region.slug}|${g.realm.slug}|${g.name}`; // 보스마다 명단이 다르다
      if (!(key in rosterCache)) {
        const j = await get(`${B}/guilds/boss-kill?region=${g.region.slug}&realm=${encodeURIComponent(g.realm.slug)}&guild=${encodeURIComponent(g.name)}&raid=${raid}&boss=${boss}&difficulty=mythic`); req++; await sleep(900);
        rosterCache[key] = j && j.roster ? { at: j.kill && j.kill.defeatedAt, comp: {}, hero: {} } : null;
        if (j && j.roster) for (const r of j.roster) { const id = `${r.character.class.slug}/${r.character.spec.slug}`; if (!specIds.has(id)) continue; const rc = rosterCache[key]; rc.comp[id] = (rc.comp[id] || 0) + 1;
          const hk = heroKey(id, r.character.talentLoadout && r.character.talentLoadout.loadoutText); rc.hero[id] ||= {}; rc.hero[id][hk] = (rc.hero[id][hk] || 0) + 1; }
      }
      const rc = rosterCache[key]; if (!rc) { missing++; continue; }
      kills.push({ rank: smp === 'world' || smp === 'xcn' ? e.rank : e.regionRank || e.rank, guild: g.name, region: g.region.slug, at: rc.at });
      for (const [id, c] of Object.entries(rc.comp)) { specs[id] ||= { guilds: 0, total: 0, hero: {} }; specs[id].guilds++; specs[id].total += c; for (const [hk, n] of Object.entries(rc.hero[id] || {})) specs[id].hero[hk] = (specs[id].hero[hk] || 0) + n; }
    }
    // listed: 처치 순으로 살펴본 공격대 수, kills: 그중 처치 명단이 공개돼 센 곳(최대 TOP)
    out.samples[smp][boss] = { listed: seen, kills: kills.length, top: kills, specs };
    const f0 = L[0]; out.progress[smp][boss] = { count: null, first: f0 ? { guild: f0.guild.name, region: f0.guild.region.slug, at: (f0.encountersDefeated && f0.encountersDefeated[0] && f0.encountersDefeated[0].firstDefeated) || null } : null };
  }
  console.log(boss, Object.entries(out.samples).map(([k, v]) => `${k}:${v[boss].kills}`).join(' '));
}
// 진행 현황: 보스마다 신화 처치 공격대 수
const byRaid = {}; for (const [raid, boss] of BOSSES) (byRaid[raid] ||= []).push(boss);
for (const [raid, bosses] of Object.entries(byRaid)) {
  if (bosses.length === 1) { // 소굴: 보스 1개라 진행도 1 = 처치 수
    const cnt = {}; for (const reg of ['world', 'kr', 'cn']) { const j = await get(`${B}/raiding/progression?raid=${raid}&difficulty=mythic&region=${reg}`); req++; await sleep(900); cnt[reg] = j && j.progression ? j.progression.reduce((a, p) => a + (p.progress >= 1 ? p.totalGuilds : 0), 0) : null; }
    cnt.xcn = cnt.world != null && cnt.cn != null ? cnt.world - cnt.cn : null; for (const smp of Object.keys(cnt)) out.progress[smp][bosses[0]].count = cnt[smp]; continue; }
  for (const reg of ['world', 'kr', 'cn']) {
    const tally = {}, tallyX = {}; let pages = 0, guilds = 0, ok = true;
    for (let p = 0; p < 200; p++) { const j = await get(`${B}/raiding/raid-rankings?raid=${raid}&difficulty=mythic&region=${reg}&limit=100&page=${p}`); req++; pages++; await sleep(700);
      if (!j) { ok = false; break; } const L = j.raidRankings || []; if (!L.length) break; let any = false;
      for (const g of L) { const ds = (g.encountersDefeated || []).map(e => e.slug); if (!ds.length) continue; any = true; guilds++; for (const b of ds) { tally[b] = (tally[b] || 0) + 1; if (g.guild.region.slug !== 'cn') tallyX[b] = (tallyX[b] || 0) + 1; } }
      if (!any || L.length < 100) break; }
    for (const b of bosses) { out.progress[reg][b].count = ok ? tally[b] || 0 : null; if (reg === 'world') out.progress.xcn[b].count = ok ? tallyX[b] || 0 : null; }
    console.log('progress', raid, reg, 'pages', pages, 'guilds', guilds, ok ? '' : 'INCOMPLETE');
  }
}
// 주간 초기화: 지역별 레이드 시작 시각(이후 7일마다)
{ const j = await get(`${B}/raiding/static-data?expansion_id=11`); req++; const r = j && (j.raids || []).find(x => x.slug === 'the-venomous-abyss'); out.resets = r ? r.starts : null; }
// 보스 목록(순서·영문·한글 이름): 공용 공략 data/raid/core.json 탭에서
try { const core = JSON.parse(fs.readFileSync(ROOT + 'data/raid/core.json', 'utf8')); out.bosses = BOSSES.map(([raid, id]) => { const t = core.tabs.find(x => x.id === id) || {}; return { id, raid, order: t.order, en: t.name || id, ko: t.ko || null }; }); } catch (e) { out.bosses = BOSSES.map(([raid, id], i) => ({ id, raid, order: i + 1, en: id, ko: null })); }
console.log('requests', req, 'missing rosters', missing);
if (process.argv.includes('--write')) { fs.mkdirSync(ROOT + 'data/raid', { recursive: true }); fs.writeFileSync(ROOT + 'data/raid/comp.json', JSON.stringify(out) + '\n'); console.log('wrote data/raid/comp.json'); }
