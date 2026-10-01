#!/usr/bin/env node
// 한글판과 영문판의 기술 툴팁 연결을 줄 단위로 대조한다.
// 사용: node tools/check/tooltip-parity.mjs [--names] [--json 결과.json]
//   종료 코드 0 = 통과, 1 = 영문에서 툴팁이 빠진 줄이 있음(tools/check/tooltip-parity-allow.txt 에 적힌 줄은 제외)
//
// 사이트가 문장에서 기술 이름을 찾는 코드(AB_STOP·abSplit·tipNorm, 쐐기·레이드 화면의 AB_RE·AB_COLON·colonPart·abWrap)는
// assets/app.js 에서 그대로 읽어 와 쓴다. 검사용으로 베끼지 않으므로 사이트 코드를 고치면 검사도 같이 바뀐다.
// 대조 단위: 같은 데이터 위치의 한글 문장과 영문 문장(예: spec paladin-protection pulls.murder.3[2]).
// 한글 문장에서 툴팁이 붙는 기술 ID가 영문 문장에는 하나도 없으면 "빠짐"으로 보고한다(언급 횟수 차이는 번역 문체라 보지 않는다).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const showNames = args.includes('--names');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const read = p => JSON.parse(fs.readFileSync(path.join(R, p), 'utf8'));
const readEn = p => { const e = p.replace(/\/([^/]+)$/, '/en/$1'); return fs.existsSync(path.join(R, e)) ? read(e) : read(p); };
const exists = p => fs.existsSync(path.join(R, p));

// ---- app.js 에서 이름 찾기 코드 꺼내기 ----
const SRC = fs.readFileSync(path.join(R, 'assets/app.js'), 'utf8');
const cut = (from, to, start = 0) => { const a = SRC.indexOf(from, start); if (a < 0) throw new Error(`app.js 에서 "${from}" 를 못 찾음`); const b = SRC.indexOf(to, a); if (b < 0) throw new Error(`app.js 에서 "${to}" 를 못 찾음`); return [a, b]; };
const [t0, t1] = cut('const AB_STOP', 'const tipNorm');
const TOP = SRC.slice(t0, t1) + SRC.slice(t1, SRC.indexOf('\n', t1) + 1);
const scopeChunk = start => { const [a, b] = cut('  const AB_RE =', '  const abWrap = ', start); const e = SRC.indexOf('\n', b); return [SRC.slice(a, e + 1), e]; };
const [SHEET_CHUNK, sheetEnd] = scopeChunk(0);
const [RAID_CHUNK] = scopeChunk(sheetEnd);
const ESC = 'const escH = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n';
const build = (chunk, ctx) => vm.runInNewContext(`${TOP}\n${ESC}\n${chunk}\n({ abWrap, tipNorm })`, ctx);

const SPAN = /<span class="ab"(?: data-tn="([^"]+)")?>([^<]+)<\/span>/g;
// 감싼 이름 → 툴팁 ID 목록과, 툴팁이 없는 이름 목록
function resolve(html, maps, tipNorm) {
  const ids = [], unknown = [];
  for (const m of html.matchAll(SPAN)) {
    const name = (m[1] || m[2]).replace(/&amp;/g, '&'), k = tipNorm(name);
    const id = maps.map(x => x && x[k]).find(Boolean);
    if (id) ids.push(String(id)); else unknown.push(m[2].replace(/&amp;/g, '&'));
  }
  return { ids, unknown };
}
const bag = a => a.reduce((o, x) => (o[x] = (o[x] || 0) + 1, o), {});

// ---- 예외 목록: "위치<TAB>기술 ID<TAB>이유" (#으로 시작하면 주석) ----
const ALLOW_F = 'tools/check/tooltip-parity-allow.txt';
const allow = new Set(exists(ALLOW_F) ? fs.readFileSync(path.join(R, ALLOW_F), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.split('\t').slice(0, 2).join('\t')) : []);

const roster = read('data/roster.json');
const SPECS = roster.classes.flatMap(c => c.specs.map(s => ({ id: `${c.slug}-${s.slug}`, role: s.role, ready: s.status === 'ready' })));
const missing = new Map();   // 위치+ID → { where, id, name, en, ko, specs:Set }
const noEn = new Map();      // 영문 문장이 아예 없는 위치
const unknownEn = new Map(); // 영문에서 감쌌지만 툴팁 사전에 없는 이름 → 횟수
let linesChecked = 0, idsKo = 0, idsEn = 0;

function compare(where, specId, koText, enText, ctxKo, ctxEn, mapsFor) {
  linesChecked++;
  if (koText == null) return;
  if (enText == null) { if (!noEn.has(where)) noEn.set(where, { where, ko: koText, specs: new Set() }); noEn.get(where).specs.add(specId); return; }
  const k = resolve(ctxKo.abWrap(String(koText)), mapsFor, ctxKo.tipNorm), e = resolve(ctxEn.abWrap(String(enText)), mapsFor, ctxEn.tipNorm);
  idsKo += k.ids.length; idsEn += e.ids.length;
  e.unknown.forEach(n => unknownEn.set(n, (unknownEn.get(n) || 0) + 1));
  const bk = bag(k.ids), be = bag(e.ids);
  for (const [id, n] of Object.entries(bk)) {
    if (be[id]) continue;
    const key = `${where}\t${id}`;
    if (allow.has(key)) continue;
    if (!missing.has(key)) missing.set(key, { where, id, en: String(enText), ko: String(koText), specs: new Set() });
    missing.get(key).specs.add(specId);
  }
}
const pairs = (ko, en, fn) => { (ko || []).forEach((x, i) => fn(x, en ? en[i] : undefined, i)); };

// ---- 쐐기 공략 ----
const core = { ko: read('data/core/dungeons.json'), en: readEn('data/core/dungeons.json') };
const routes = { ko: exists('data/core/routes.json') ? read('data/core/routes.json').dungeons : {}, en: exists('data/core/routes.json') ? readEn('data/core/routes.json').dungeons : {} };
const spellsEn = read('data/core/spells.en.json'), spellsKo = read('data/core/spells.ko.json'), names = read('data/core/names.ko.json'), npcs = read('data/core/npcs.json');
const roles = {};
for (const sp of SPECS) {
  if (!sp.ready || !exists(`data/spec/${sp.id}.json`)) continue;
  const role = roles[sp.role] || (roles[sp.role] = { ko: read(`data/role/${sp.role}.json`), en: readEn(`data/role/${sp.role}.json`) });
  const spec = { ko: read(`data/spec/${sp.id}.json`), en: readEn(`data/spec/${sp.id}.json`) };
  const mk = lang => {
    const c = core[lang], s = spec[lang];
    const SPELLS = { ...spellsEn, ...s.spells }, SPELLS_KO = { ...spellsKo, ...s.spellsKo }, tipIds = new Set(Object.values(s.tips || {}));
    const KO_ALL = {}; for (const id in SPELLS) { if (!spellsEn[id] && !tipIds.has(id)) continue; const k = SPELLS_KO[id]; if (k && k.n) KO_ALL[SPELLS[id].n] = k.n; }
    Object.assign(KO_ALL, names, s.names || {});
    return build(SHEET_CHUNK, { core: c, spec: s, KO_ALL, MOBS: npcs });
  };
  const cx = { ko: mk('ko'), en: mk('en') };
  const roleOv = (lang, d, b) => { const arr = ((role[lang].detail || {})[d] || {})[b]; const ov = (spec[lang].roleOverride || {})[`${d}/${b}`]; return arr && ov ? arr.map((l, i) => ov[i] ?? l) : arr; };
  for (const dg of core.ko.dungeons) {
    const d = dg.id, TIPS = core.ko.tips[d] || {};
    const shared = [TIPS, core.ko.commonTips], full = [TIPS, spec.ko.tips, core.ko.commonTips];
    const C = (where, ko, en, maps) => compare(`${where}`, sp.id, ko, en, cx.ko, cx.en, maps);
    for (const b of Object.keys((core.ko.detail || {})[d] || {})) {
      const xk = core.ko.detail[d][b], xe = ((core.en.detail || {})[d] || {})[b] || {};
      C(`core detail.${d}.${b}.overview`, xk.overview, xe.overview, shared);
      (xk.phases || []).forEach((p, pi) => {
        const pe = (xe.phases || [])[pi] || {};
        C(`core detail.${d}.${b}.phases[${pi}].title`, p.title, pe.title, shared);
        pairs(p.points, pe.points, (k, e, i) => C(`core detail.${d}.${b}.phases[${pi}][${i}]`, k, e, shared));
      });
      pairs(xk.group, xe.group, (k, e, i) => C(`core detail.${d}.${b}.group[${i}]`, k, e, shared));
      pairs(roleOv('ko', d, b), roleOv('en', d, b), (k, e, i) => C(`role ${sp.role} detail.${d}.${b}[${i}]`, k, e, shared));
      pairs(((spec.ko.detail || {})[d] || {})[b], ((spec.en.detail || {})[d] || {})[b], (k, e, i) => C(`spec ${sp.id} detail.${d}.${b}[${i}]`, k, e, full));
    }
    for (const [n, arr] of Object.entries(((role.ko.pulls || {})[d]) || {})) pairs(arr, ((role.en.pulls || {})[d] || {})[n], (k, e, i) => C(`role ${sp.role} pulls.${d}.${n}[${i}]`, k, e, full));
    for (const [n, arr] of Object.entries(((spec.ko.pulls || {})[d]) || {})) pairs(arr, ((spec.en.pulls || {})[d] || {})[n], (k, e, i) => C(`spec ${sp.id} pulls.${d}.${n}[${i}]`, k, e, full));
    const rk = routes.ko[d], re = routes.en[d];
    if (rk) for (const [n, arr] of Object.entries(rk.notes || {})) pairs(arr.map(x => /^\[/.test(x) ? x : '[참고] ' + x), ((re || {}).notes || {})[n] && re.notes[n].map(x => /^\[/.test(x) ? x : '[참고] ' + x), (k, e, i) => C(`routes notes.${d}.${n}[${i}]`, k, e, full));
  }
}

// ---- 레이드 공략 ----
for (const file of ['data/raid/core.json', 'data/raid/s1.json']) {
  if (!exists(file)) continue;
  const rc = { ko: read(file), en: readEn(file) };
  for (const sp of SPECS) {
    const mspec = exists(`data/spec/${sp.id}.json`) ? { ko: read(`data/spec/${sp.id}.json`), en: readEn(`data/spec/${sp.id}.json`) } : { ko: null, en: null };
    const rspec = exists(`data/raid/spec/${sp.id}.json`) ? { ko: read(`data/raid/spec/${sp.id}.json`), en: readEn(`data/raid/spec/${sp.id}.json`) } : { ko: null, en: null };
    const mk = lang => {
      const c = rc[lang], ms = mspec[lang], rs = rspec[lang];
      const SPELLS = { ...c.spells, ...(ms ? ms.spells : {}), ...(rs ? rs.spells || {} : {}) }, SPELLS_KO = { ...c.spellsKo, ...(ms ? ms.spellsKo : {}), ...(rs ? rs.spellsKo || {} : {}) };
      const specTips = { ...(ms ? ms.tips : {}), ...(rs ? rs.tips || {} : {}) }, tipIds = new Set(Object.values(specTips)), coreIds = new Set(Object.keys(c.spells));
      const KO_ALL = {}; for (const id in SPELLS) { if (!coreIds.has(id) && !tipIds.has(id)) continue; const k = SPELLS_KO[id]; if (k && k.n) KO_ALL[SPELLS[id].n] = k.n; }
      Object.assign(KO_ALL, c.names, ms ? ms.names : {}, rs ? rs.names || {} : {});
      return { ctx: build(RAID_CHUNK, { core: c, specTips, KO_ALL, MOBS: c.npcs }), specTips };
    };
    const K = mk('ko'), E = mk('en');
    for (const t of rc.ko.tabs) {
      const shared = [rc.ko.tips[t.id] || {}], full = [rc.ko.tips[t.id] || {}, K.specTips];
      const C = (where, ko, en, maps) => compare(where, sp.id, ko, en, K.ctx, E.ctx, maps);
      const xk = (rc.ko.detail[t.id] || {})[t.name] || {}, xe = ((rc.en.detail || {})[t.id] || {})[t.name] || {};
      if (sp === SPECS[0]) {
        C(`raid ${path.basename(file)} detail.${t.id}.overview`, xk.overview, xe.overview, shared);
        (xk.phases || []).forEach((p, pi) => {
          const pe = (xe.phases || [])[pi] || {};
          C(`raid ${path.basename(file)} detail.${t.id}.phases[${pi}].title`, p.title, pe.title, shared);
          pairs(p.points, pe.points, (k, e, i) => C(`raid ${path.basename(file)} detail.${t.id}.phases[${pi}][${i}]`, k, e, shared));
        });
        pairs(xk.group, xe.group, (k, e, i) => C(`raid ${path.basename(file)} detail.${t.id}.group[${i}]`, k, e, shared));
      }
      if (SPECS.findIndex(x => x.role === sp.role) === SPECS.indexOf(sp))
        pairs(((rc.ko.role[sp.role] || {})[t.id] || {})[t.name], (((rc.en.role || {})[sp.role] || {})[t.id] || {})[t.name], (k, e, i) => C(`raid ${path.basename(file)} role ${sp.role}.${t.id}[${i}]`, k, e, shared));
      if (rspec.ko) pairs(((rspec.ko.detail || {})[t.id] || {})[t.name], (((rspec.en || {}).detail || {})[t.id] || {})[t.name], (k, e, i) => C(`raid spec ${sp.id}.${t.id}[${i}]`, k, e, full));
    }
  }
}

// ---- 보고 ----
const rows = [...missing.values()];
console.log(`툴팁 대조: 문장 ${linesChecked}줄 · 연결 한글 ${idsKo} / 영문 ${idsEn} · 영문에서 빠진 곳 ${rows.length}건${noEn.size ? ` · 영문 문장 없음 ${noEn.size}곳` : ''}`);
const ID_NAME = { ...spellsEn };
for (const r of rows.slice(0, 200)) {
  const nm = (ID_NAME[r.id] || {}).n || '';
  console.log(`  ✗ ${r.where}: ${nm}(${r.id}) 빠짐${r.specs.size > 1 ? ` · 전문화 ${r.specs.size}개` : ''}\n      en: ${r.en.slice(0, 160)}`);
}
if (rows.length > 200) console.log(`  … ${rows.length - 200}건 더`);
if (noEn.size) for (const r of [...noEn.values()].slice(0, 20)) console.log(`  ! 영문 없음 ${r.where}: ${String(r.ko).slice(0, 80)}`);
if (showNames) {
  // NPC 이름(NPC 툴팁이 따로 붙음)과 한글 이름 사전 항목(Physical·Bear Form 등 한글 모드에서 번역만 됨)은 뺀다
  const NPC = new Set([...Object.keys(npcs), ...Object.keys(names), ...['data/raid/core.json', 'data/raid/s1.json'].filter(exists).flatMap(f => { const c = read(f); return [...Object.keys(c.npcs || {}), ...Object.keys(c.names || {})]; })]);
  const top = [...unknownEn.entries()].filter(([n]) => !NPC.has(n) && !NPC.has(n.replace(/['’]s?$/, ''))).sort((a, b) => b[1] - a[1]).slice(0, 60);
  console.log(`\n툴팁 사전에 없는 영문 이름(배포를 막지 않음, 상위 ${top.length}개):`);
  console.log('  ' + top.map(([n, c]) => `${n}×${c}`).join(' · '));
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ linesChecked, idsKo, idsEn, missing: rows.map(r => ({ ...r, specs: [...r.specs] })), noEn: [...noEn.values()].map(r => ({ ...r, specs: [...r.specs] })), unknownEn: Object.fromEntries(unknownEn) }, null, 1));
process.exit(rows.length ? 1 : 0);
