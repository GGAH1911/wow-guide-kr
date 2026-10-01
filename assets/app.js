/* 쐐기 가이드 엔진. 페이지 셸이 window.WG = {page, spec, hero, base} 를 정하고 이 파일을 부른다.
   page: select(첫 화면) | sheet(공략) | guide(스킬) | compare(영웅 비교) | rank(순위표) | specs(전문화 목록) | notfound(404)
   데이터: data/roster.json, data/core/*, data/role/<역할>.json, data/spec/<직업>-<전문화>.json */
(() => {
"use strict";
const CFG = window.WG || {};
const BASE = CFG.base || "./";
const J0 = p => fetch(BASE + p).then(r => { if (!r.ok) throw new Error(p + " " + r.status); return r.json(); });
// 영어 화면(UI=en)이면 사람이 쓴 공략 데이터는 data/<분류>/en/<파일> 을 먼저 받고, 없으면 원본(한국어)을 쓴다. 매일 수집하는 수치 파일은 대상이 아니다.
const EN_DATA = /^data\/(?:spec\/[^/]+|core\/(?:dungeons|routes)|role\/[^/]+|raid\/(?:core|s1)|raid\/spec\/[^/]+|pvp\/maps|pvp\/strat\/[^/]+)\.json$/;
const J = p => UI === "en" && EN_DATA.test(p) ? J0(p.replace(/\/([^/]+)$/, "/en/$1")).catch(() => J0(p)) : J0(p);

// ---------- 저장값 ----------
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
// 다크 모드: 버튼 하나로 켜고 끈다. 저장값이 "light"일 때만 라이트, 나머지는 다크(시스템 설정은 보지 않음)
const THEME = () => ls.get("wg:theme") === "light" ? "light" : "dark";
document.documentElement.dataset.theme = THEME();
const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
// 버튼에는 누르면 바뀔 모드의 아이콘을 보인다(다크일 때 해, 라이트일 때 달)
const thBtn = (spin = false) => { const d = THEME() === "dark"; return `<button type="button" class="thsw${spin ? " spin" : ""}" id="thsw" aria-label="${d ? "라이트 모드로" : "다크 모드로"}" title="${d ? "라이트 모드로" : "다크 모드로"}">${d ? SUN_SVG : MOON_SVG}</button>`; };
// 전환 연출(블러 디졸브): 옛 화면은 흐려지며 살짝 커져 사라지고, 새 화면은 흐릿한 상태에서 선명해지며 나타난다(View Transitions).
// 지원하지 않는 브라우저는 색만 부드럽게 바뀌고, "동작 줄이기"를 켠 사용자는 즉시 바뀐다. 버튼 아이콘은 돌면서 해↔달로 바뀐다.
document.addEventListener("click", e => {
  const b = e.target.closest("#thsw"); if (!b) return;
  const next = THEME() === "dark" ? "light" : "dark", root = document.documentElement;
  const apply = () => { ls.set("wg:theme", next); root.dataset.theme = next; const cur = document.getElementById("thsw"); if (cur) cur.outerHTML = thBtn(true); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
  if (!document.startViewTransition) {
    root.classList.add("theme-anim"); apply(); setTimeout(() => root.classList.remove("theme-anim"), 450); return;
  }
  document.startViewTransition(apply);
});
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
};
// 옛 보호 성기사 사이트(pp-*) 저장값을 한 번만 옮긴다. pp-*는 되돌릴 때를 위해 지우지 않는다.
function migrate() {
  if (ls.get("wg:v")) return;
  const hero = ls.get("pp-hero"), lang = ls.get("pp-tiplang"), tab = ls.get("pp-tab"), open = ls.get("pp-open");
  if ([hero, lang, tab, open].some(x => x != null)) {
    ls.set("wg:spec", "paladin/protection");
    // 옛 사이트는 영웅을 고른 적이 없으면 기사단으로 보였으므로 그대로 둔다
    ls.set("wg:hero:paladin/protection", hero === "lightsmith" ? "lightsmith" : "templar");
  }
  if (lang === "ko" || lang === "en") ls.set("wg:lang", lang);
  if (tab) ls.set("wg:tab", tab);
  if (open) ls.set("wg:open", open);
  ls.set("wg:v", "1");
}
migrate();
// ---------- 사이트 언어(UI): ko(기본) | en ----------
// 주소 ?ui=en|ko 로 고르면 이 기기에 저장한다. 영어 화면은 게임 언어도 영어로 고정하고(한/EN 버튼 없음),
// 화면 문구는 assets/i18n.en.json 사전으로 그린 뒤에 바꾼다. 한국어 화면은 이 어느 것도 하지 않는다.
const UI = (() => { let q = null; try { q = new URLSearchParams(location.search).get("ui"); } catch (e) {} if (q === "en" || q === "ko") ls.set("wg:ui", q); return ls.get("wg:ui") === "en" ? "en" : "ko"; })();
let lang = UI === "en" ? "en" : ls.get("wg:lang") === "ko" ? "ko" : "en";
let I18N = null;
const HANGUL = /[가-힣]/;
// 영문 뒤에 남는 조사(예: "Top 500 players가")를 지운다
const JOSA_TAIL = /([A-Za-z0-9)\]%'’·])(?:으로|에서|까지|부터|은|는|이|가|을|를|의|에|로|와|과|도|만)(?=[\s.,)!?:·]|$)/g;
function prepI18n(dict) {
  const map = Object.assign({}, dict); const rx = L => (L || []).map(([p, r]) => [new RegExp(p, "g"), r]);
  const first = rx(map.$first), pre = rx(map.$pre), post = rx(map.$post); delete map.$first; delete map.$pre; delete map.$post;
  const all = Object.keys(map).filter(k => k.length >= 2 && !k.includes("{")).sort((a, b) => b.length - a.length).map(k => [k, map[k]]);
  // 긴 문구(8자 이상)는 숫자 규칙보다 먼저, 짧은 문구는 나중에
  return { map, long: all.filter(([k]) => k.length >= 8), phrases: all.filter(([k]) => k.length < 8), first, pre, post, raw: dict };
}
function trText(s) {
  if (!I18N || !HANGUL.test(s)) return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0]; let t = s.trim();
  const M = I18N.map;
  if (M[t] != null) return lead + M[t] + trail;
  if (I18N.x && I18N.x[t] != null) return lead + I18N.x[t] + trail;
  const nums = []; const key = t.replace(/\d[\d,.:\-]*/g, m => { nums.push(m); return "{" + (nums.length - 1) + "}"; });
  if (nums.length && M[key] != null) return lead + M[key].replace(/\{(\d+)\}/g, (_, i) => nums[i] != null ? nums[i] : "") + trail;
  for (const [re, r] of I18N.first) t = t.replace(re, r);
  for (const [k, v] of I18N.long) if (t.includes(k)) t = t.split(k).join(v);
  for (const [re, r] of I18N.pre) t = t.replace(re, r);
  for (const [k, v] of I18N.phrases) if (t.includes(k)) t = t.split(k).join(v);
  for (const [re, r] of I18N.post) t = t.replace(re, r);
  t = t.replace(JOSA_TAIL, "$1").replace(/ {2,}/g, " ");
  return lead + t + trail;
}
const I18N_ATTRS = ["title", "aria-label", "placeholder", "alt"];
const noTr = el => !el || !!(el.closest && el.closest('[translate="no"],pre,script,style,textarea'));
function trAttrs(el) { for (const a of I18N_ATTRS) { const v = el.getAttribute(a); if (v && HANGUL.test(v)) { const n = trText(v); if (n !== v) el.setAttribute(a, n); } } }
function trNode(root) {
  if (!I18N || !root) return;
  if (root.nodeType === 3) { if (HANGUL.test(root.nodeValue) && !noTr(root.parentElement)) { const n = trText(root.nodeValue); if (n !== root.nodeValue) root.nodeValue = n; } return; }
  if (root.nodeType !== 1 && root.nodeType !== 9) return;
  const el = root.nodeType === 9 ? root.documentElement : root;
  if (noTr(el)) return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const L = []; let n; while ((n = w.nextNode())) if (HANGUL.test(n.nodeValue)) L.push(n);
  for (const t of L) if (!noTr(t.parentElement)) { const v = trText(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; }
  if (el.getAttribute) trAttrs(el);
  el.querySelectorAll("[title],[aria-label],[placeholder],[alt]").forEach(x => { if (!noTr(x)) trAttrs(x); });
}
function startI18n(dict) {
  I18N = prepI18n(dict);
  document.documentElement.lang = "en";
  trNode(document);
  new MutationObserver(ms => { for (const m of ms) {
    if (m.type === "childList") m.addedNodes.forEach(trNode);
    else if (m.type === "characterData") trNode(m.target);
    else if (m.type === "attributes" && !noTr(m.target)) trAttrs(m.target);
  } }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}
// 로스터의 한글 이름(직업·전문화·영웅 특성·역할)도 사전에 넣는다(화면 고정 문구에 섮여 나오는 경우)
function rosterI18n(r) {
  if (!I18N) return;
  const add = (ko, en) => { if (ko && en && I18N.map[ko] == null) I18N.map[ko] = en; };
  Object.values(r.roles || {}).forEach(x => add(x.ko, x.en));
  // 전문화 짧은 이름(보호·무기 등)은 다른 말 속에도 나오므로 문구 전체가 같을 때만 바꾼다
  const x = {}; r.classes.forEach(c => c.specs.forEach(s => { if (s.ko && s.en) x[s.ko] = s.en; }));
  r.classes.forEach(c => { add(c.ko, c.en); c.specs.forEach(s => { add(s.koFull, s.enFull); (s.heroes || []).forEach(h => add(h.ko, h.en)); }); });
  I18N = prepI18n(Object.assign({}, I18N.map, { $first: I18N.raw.$first, $pre: I18N.raw.$pre, $post: I18N.raw.$post }));
  I18N.x = x;
  trNode(document);
}

// ---------- 로스터 ----------
let ROSTER, SPECS = [], BYID = {};
function indexRoster(r) {
  ROSTER = r;
  r.classes.forEach(c => c.specs.forEach(s => {
    const o = { id: `${c.slug}/${s.slug}`, cls: c, ...s };
    SPECS.push(o); BYID[o.id] = o;
  }));
}
const ROLE_ICON = { tank: "🛡", healer: "✚", dps: "⚔" };
const specName = s => lang === "ko" ? s.koFull : s.enFull;
const heroName = h => h ? (lang === "ko" ? h.ko : h.en) : "";
const heroOf = (s, slug) => s.heroes.find(h => h.slug === slug);
const defaultHero = s => s.defaultHero || s.heroes[0].slug;
const savedHero = s => { const h = ls.get("wg:hero:" + s.id); return heroOf(s, h) ? h : null; };
const isLight = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 170; };
function setClassColor(c) {
  const st = document.documentElement.style;
  st.setProperty("--cls", c.color); st.setProperty("--cls-ink", c.ink[0]); st.setProperty("--cls-ink-d", c.ink[1]);
}
// 출처 링크: 조사 때 쓴 Wowhead 툴팁 API 주소(JSON)는 사람이 볼 Wowhead 페이지로 바꿔 건다
const srcU = u => { const m = /^https:\/\/nether\.wowhead\.com\/tooltip\/(spell|npc|item|zone|achievement)\/(\d+)/.exec(String(u)); return m ? `https://www.wowhead.com/${lang === "ko" ? "ko/" : ""}${m[1]}=${m[2]}` : u; };
const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function icon(s, size) {
  const c = s.cls, light = isLight(c.color);
  return `<span class="ico${light ? " light" : ""}" style="--c:${c.color};${size ? `--s:${size}px;` : ""}${light ? "color:#1D1D1F" : ""}" aria-hidden="true">${esc((lang === "ko" ? s.ko : s.en).charAt(0))}<img src="https://wow.zamimg.com/images/wow/icons/large/${s.icon}.jpg" alt="" loading="lazy" onerror="this.remove()"></span>`;
}
function classIcon(c, size) {
  const light = isLight(c.color);
  return `<span class="ico${light ? " light" : ""}" style="--c:${c.color};${size ? `--s:${size}px;` : ""}${light ? "color:#1D1D1F" : ""}" aria-hidden="true">${esc((lang === "ko" ? c.ko : c.en).charAt(0))}<img src="https://wow.zamimg.com/images/wow/icons/large/classicon_${c.token.toLowerCase()}.jpg" alt="" loading="lazy" onerror="this.remove()"></span>`;
}
const sheetUrl = (id, hash) => `${BASE}${id}/${hash || ""}`;
// ---- 즐겨찾기: 방문자 브라우저(localStorage)에만 저장. 로그인·서버 없이 GitHub Pages 에서 그대로 동작한다 ----
// 저장 키 wg:favs = ["paladin/protection", ...]. 다른 기기로는 ?favs=a,b 주소(메뉴의 "즐겨찾기 링크 복사")로 옮긴다
const favList = () => { try { const a = JSON.parse(ls.get("wg:favs") || "[]"); return Array.isArray(a) ? a.filter(id => BYID[id]) : []; } catch (e) { return []; } };
const favHas = id => favList().includes(id);
const favSave = a => ls.set("wg:favs", JSON.stringify([...new Set(a)]));
const favToggle = id => { const a = favList(); favSave(a.includes(id) ? a.filter(x => x !== id) : [...a, id]); return favHas(id); };
const favBtn = id => { const on = favHas(id); return `<button type="button" class="favb" data-fav="${id}" aria-pressed="${on}" aria-label="${on ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가"}" title="${on ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가"}">${on ? "★" : "☆"}</button>`; };
// 즐겨찾기 칩 줄. mode: 쐐기(sheet)·레이드(raid)·PvP(pvp) 중 지금 보는 쪽 주소로 연다
const favChips = (mode, cur) => favList().map(id => BYID[id]).map(x => `<a class="favchip${x.id === cur ? " cur" : ""}" href="${mode === "raid" ? raidUrl(x.id) : mode === "pvp" ? pvpUrl(x.id) : sheetUrl(x.id, ls.get("wg:tab") ? "#" + ls.get("wg:tab") : "")}" data-spec="${x.id}" style="--cls-ink:${x.cls.ink[0]};--cls-ink-d:${x.cls.ink[1]}">${icon(x, 22)}<span>${esc(specName(x))}</span></a>`).join("");
// 메뉴의 즐겨찾기 묶음(추가한 순서). 별을 누르면 favRefresh 가 바로 다시 그린다
const favMenuHtml = mode => favList().length ? `<div class="gsep">★ 즐겨찾기</div>${favList().map(id => BYID[id]).map(x => `<a href="${mode === "raid" ? raidUrl(x.id) : mode === "pvp" ? pvpUrl(x.id) : sheetUrl(x.id)}" data-spec="${x.id}">${esc(x.koFull)}</a>`).join("")}<button type="button" id="gfavcopy">즐겨찾기 링크 복사</button>` : "";
const favRefresh = () => {
  document.querySelectorAll(".favb[data-fav]").forEach(b => { b.outerHTML = favBtn(b.dataset.fav); });
  const m = document.getElementById("gfavs"); if (m) m.innerHTML = favMenuHtml(m.dataset.mode);
};
document.addEventListener("click", e => {
  const b = e.target.closest(".favb[data-fav]");
  if (b) { e.preventDefault(); const on = favToggle(b.dataset.fav); favRefresh(); const bn = document.getElementById("bfav"); if (bn && on) bn.remove(); document.dispatchEvent(new CustomEvent("wg:favs")); return; }
  const cp = e.target.closest("#gfavcopy");
  if (cp) {
    const url = `${location.origin}${BASE}?favs=${favList().join(",")}`;
    const done = t => { cp.textContent = t; setTimeout(() => cp.textContent = "즐겨찾기 링크 복사", 2500); };
    try { navigator.clipboard.writeText(url).then(() => done("복사됨 · 다른 기기에서 열기"), () => prompt("이 주소를 다른 기기에서 여세요", url)); } catch (err) { prompt("이 주소를 다른 기기에서 여세요", url); }
  }
});
// ?favs=a,b 로 들어오면 즐겨찾기에 합치고 주소에서 뺀다
function favImport() {
  const q = new URLSearchParams(location.search), v = q.get("favs"); if (v == null) return 0;
  const add = v.split(",").map(x => x.trim()).filter(x => BYID[x]), before = favList().length;
  favSave([...favList(), ...add]);
  q.delete("favs"); history.replaceState(history.state, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
  const n = favList().length - before;
  if (add.length) { const t = document.createElement("div"); t.className = "favtoast"; t.textContent = n ? `즐겨찾기 ${n}개를 가져왔습니다` : "이미 즐겨찾기에 있는 전문화입니다"; document.body.append(t); setTimeout(() => t.remove(), 3500); }
  return n;
}
const guideUrl = (id, hero) => `${BASE}${id}/${hero}/`;
const raidUrl = (id, hash) => `${BASE}${id}/raid/${hash || ""}`;
const pvpUrl = (id, q) => `${BASE}${id}/pvp/${q || ""}`;
const pvpHubUrl = (q, hash) => `${BASE}pvp/${q ? "?" + q : ""}${hash || ""}`;
const compareUrl = id => `${BASE}${id}/compare/`;
// 쐐기 상위 500명(전문화별 Raider.IO 순위) 가운데 이 영웅을 고른 수와 비율(roster.hero500)
// 표본: 세계(world) 또는 한국(kr). 한국 값은 roster 의 s.kr·meta.mplus500kr. 주소 ?sample=kr 가 저장값보다 우선
// 표본 4가지(모두 500명): world(세계) · xcn(세계 순위에서 중국 서버를 뺀 상위 500, 따로 받음) · kr(한국 순위) · cn(중국 순위)
const SAMPLES = ["world", "xcn", "kr", "cn"]; // 버튼 순서: 세계 · 세계(중국 제외) · 한국 · 중국
let SAMPLE = (() => { const u = new URLSearchParams(location.search).get("sample"); const v = u || ls.get("wg:sample"); return SAMPLES.includes(v) ? v : "world"; })();
const hasKr = () => !!(ROSTER.meta && ROSTER.meta.mplus500kr);
const hasSub = () => !!(ROSTER.meta && ROSTER.meta.mplus500xcn);
const hasCn = () => !!(ROSTER.meta && ROSTER.meta.mplus500cn && ROSTER.meta.mplus500cn.region === "cn");
const SD = s => (SAMPLE !== "world" && s[SAMPLE]) || s;
const SQ = () => SAMPLE !== "world" ? "&sample=" + SAMPLE : "";
// " 중 중국 제외" 처럼 "상위 N명" 뒤에 붙는 부분 표본 설명
const SX = () => SAMPLE === "cn" && hasSub() && !hasCn() ? " 중 중국 서버" : ""; // 옛 데이터(세계 500 중 중국 서버)일 때만
// 따로 받은 표본(한국, 세계(중국 제외))은 "상위 N명" 앞에 이름을 붙이고, 세계 500명의 부분 표본(중국)은 뒤에 " 중 중국 서버"를 붙인다
const SL = () => SAMPLE === "kr" && hasKr() ? "한국 " : SAMPLE === "xcn" && hasSub() ? "세계(중국 제외) " : SAMPLE === "cn" && hasCn() ? "중국 " : "";
// 전문화 순위(영웅 특성 비율) 인원: 세계 500명, 한국 50명(meta.specTop)
const STOP = () => M5().specTop || M5().top || 500;
let reSample = () => location.reload();
// 비율 표본 필터 줄: 역할·직업을 고른 바로 아래(목록 위)에 둔다
const smpRow = () => sampleSeg() ? `<div class="smprow"><span class="tlabel">비율 기준</span>${sampleSeg()}</div>` : "";
const SNAME = { world: "세계", xcn: "세계(중국 제외)", kr: "한국", cn: "중국" };
// 세계·세계(중국 제외)는 지구본, 한국·중국은 국기(assets/flags)
const GLOBE = `<svg class="globe" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="8" cy="8" rx="2.9" ry="6.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1.6 8h12.8M2.6 4.8h10.8M2.6 11.2h10.8" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>`;
const SICON = k => k === "kr" || k === "cn" ? `<img class="flag" src="${BASE}assets/flags/${k}.svg" alt="" width="18" height="12">` : GLOBE;
const sampleSeg = () => hasKr() || hasSub() ? `<span class="seg smp" role="group" aria-label="표본">${SAMPLES.filter(k => k === "world" || (k === "kr" ? hasKr() : k === "cn" ? hasCn() || hasSub() : hasSub())).map(k => `<button type="button" data-smp="${k}" aria-pressed="${SAMPLE === k}">${SICON(k)}${SNAME[k]}</button>`).join("")}</span>` : "";
document.addEventListener("click", e => { const b = e.target.closest("[data-smp]"); if (!b) return; e.preventDefault(); e.stopPropagation(); if (b.dataset.smp === SAMPLE) return; SAMPLE = b.dataset.smp; ls.set("wg:sample", SAMPLE); reSample(); paintHeader(); }, true);
const heroTop = (s, slug) => { const h = SD(s).hero500; if (!h || !h.n || h.counts[slug] == null) return null; return { c: h.counts[slug], n: h.n, pct: Math.round(h.counts[slug] / h.n * 100) }; };
// 직업 점수 상위 500명 가운데 이 전문화 비율(roster.mplus: n명 / classN명)
const specShare = s => SD(s).mplus && SD(s).mplus.share != null ? SD(s).mplus : null;
const M5 = () => (ROSTER.meta && (SAMPLE !== "world" && ROSTER.meta["mplus500" + SAMPLE] || ROSTER.meta.mplus500)) || {};
const rankUrl = q => `${BASE}rank/?${q}`;
// ---------- 레이드 순위(data/raid/comp.json, Raider.IO 신화 처치 명단) ----------
const raidHubUrl = (q, hash) => `${BASE}raid/${q ? "?" + q : ""}${hash || ""}`;
let RCP = null; const raidComp = () => RCP || (RCP = J("data/raid/comp.json").catch(() => null));
const bossName = b => lang === "ko" && b.ko ? b.ko : b.en;
const RSMP = c => c && c.samples && c.samples[SAMPLE] ? SAMPLE : "world";
// 보스 9개 합산: 전문화마다 처치 명단(보스×공격대) 중 이 전문화가 1명 이상 있던 비율 = 채용률
function raidAgg(c, smp) {
  const S = (c && c.samples && c.samples[smp || RSMP(c)]) || {}; const ids = (c && c.bosses ? c.bosses.map(b => b.id) : Object.keys(S)).filter(id => S[id] && S[id].kills);
  const kills = ids.reduce((x, id) => x + S[id].kills, 0), out = {};
  for (const id of ids) for (const [sid, v] of Object.entries(S[id].specs)) { const o = out[sid] ||= { guilds: 0, total: 0, hero: {} }; o.guilds += v.guilds; o.total += v.total; for (const [h, n] of Object.entries(v.hero || {})) o.hero[h] = (o.hero[h] || 0) + n; }
  for (const o of Object.values(out)) o.rate = kills ? o.guilds / kills * 100 : 0;
  return { kills, bosses: ids.length, specs: out };
}
// 레이드 영웅 특성: 처치 명단 인원 중 이 전문화 코드로 영웅 트리를 고른 사람만 분모(다른 전문화 코드·미선택·코드 없음은 뺌)
const raidHero = (agg, s) => { const o = agg && agg.specs[s.id]; if (!o) return null; const counts = Object.fromEntries(s.heroes.map(h => [h.slug, o.hero[h.slug] || 0])); const n = Object.values(counts).reduce((x, y) => x + y, 0); return n ? { counts, n } : null; };
// 주간 초기화: 지역별 레이드 시작 시각(UTC 고정, 서머타임 없음)에서 7일마다
const RESET_REG = [["kr", "한국·대만·중국"], ["us", "미국"], ["eu", "유럽"]];
const nextReset = iso => { const t0 = Date.parse(iso), wk = 7 * 864e5, now = Date.now(); return now < t0 ? t0 : t0 + Math.ceil((now - t0) / wk) * wk; };
const kstFmt = (t, withDate) => { const d = new Date(t + 9 * 3600e3); const W = "일월화수목금토"[d.getUTCDay()]; const hm = String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); return withDate ? `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${W}) ${hm}` : `${W} ${hm}`; };
const leftFmt = t => { const m = Math.max(0, Math.round((t - Date.now()) / 60e3)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${m % 60}분` : `${m % 60}분`; };
const kstDate = iso => { if (!iso) return ""; const d = new Date(Date.parse(iso) + 9 * 3600e3); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };
const REGKO = { us: "미국", eu: "유럽", kr: "한국", tw: "대만", cn: "중국" };
const regFlag = k => REGKO[k] ? `<img class="flag" src="${BASE}assets/flags/${k}.svg" alt="${REGKO[k]}" title="${REGKO[k]}" width="18" height="12">` : "";
// "상위 500명 = A 380 + B 69 + 전문화 표시 없음 2" 처럼 500명이 어떻게 나뉘는지 한 줄로
const compLine = (total, parts, lead) => `<p class="comp">${lead || (SX() ? `상위 ${M5().top || 500}명${SX()} ${total}명` : `${SL()}상위 ${total}명`)} = ${parts.filter(p => p[1] > 0 || p[2]).map(([k, n]) => `${esc(k)} <b>${n}</b>`).join(" + ")}</p>`;
const classComp = c => { const l = c.specs.map(x => BYID[`${c.slug}/${x.slug}`]).filter(specShare); if (!l.length) return ""; const m = specShare(l[0]), ranked = m.ranked || m.classN; return compLine(ranked, [...l.slice().sort((x, y) => specShare(y).n - specShare(x).n).map(x => [lang === "ko" ? x.ko : x.en, specShare(x).n, 1]), ["전문화 표시 없음", ranked - m.classN]]); };
const heroComp = s => { const h = SD(s).hero500; if (!h || !h.n) return ""; const ranked = h.ranked || h.n + (h.excluded || 0) + (h.unknown || 0) + (h.noinfo || 0); return compLine(ranked, [...s.heroes.map(x => [heroName(x), h.counts[x.slug] || 0, 1]), ["지금 다른 전문화 특성", h.excluded || 0], ["특성 정보 없음", h.noinfo || 0], ["영웅 트리 미선택", h.unknown || 0]]); };
const roleComp = role => { const r = (M5().roles || {})[role]; if (!r) return ""; return compLine(r.ranked, [[`위 전문화 ${SPECS.filter(s => s.role === role).length}개 합`, r.counted, 1], ["전문화를 가를 수 없음", r.skipped]]) + (r.skipped ? `<p class="comp sub">전문화를 가를 수 없음: 직업에 ${esc(ROSTER.roles[role].ko)} 전문화가 둘 이상인데 지금 다른 역할 전문화를 켜 둔 캐릭터</p>` : ""); };

// ---------- 전문화 전환 시트 (S5) ----------
// 역할 점수 상위 500명 가운데 이 전문화 비율(roster.roleShare)
const roleShareOf = s => SD(s).roleShare && SD(s).roleShare.share != null ? SD(s).roleShare : null;
const pctTxt = v => (v >= 10 || v === 0 ? Math.round(v) : v) + "%";
// ---------- 순위 목록: 큰 순서로 정렬해 순위 번호(1~3위 배지)·아이콘·이름·인원·막대·비율 ----------
// rows: [{ s, pct, sub, href, cur }]  (pct 가 0/없으면 맨 아래에 "–")
function rankList(rows, cls) {
  const R = rows.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0) || specName(a.s).localeCompare(specName(b.s)));
  const mx = Math.max(1, ...R.map(r => r.pct || 0));
  let k = 0;
  return `<ol class="rklist${R.length > 10 ? " two" : ""}${cls ? " " + cls : ""}">${R.map(r => { const has = r.pct > 0; if (has) k++; return `<li><a class="rkrow${r.cur ? " cur" : ""}" href="${r.href}" data-spec="${r.s.id}"${r.cur ? ' aria-current="page"' : ""} style="--cls:${r.s.cls.color}"><span class="rkn${has && k <= 3 ? " t" + k : ""}">${has ? k : "–"}</span>${icon(r.s, 28)}<span class="rkname"><b>${esc(specName(r.s))}</b>${r.sub ? `<small>${r.sub}</small>` : ""}</span><span class="rkbar"><i style="width:${has ? r.pct / mx * 100 : 0}%"></i></span><span class="rkpct">${has ? pctTxt(r.pct) : "—"}</span></a></li>`; }).join("")}</ol>`;
}
function specListHtml(role, currentId, mode) {
  // mode: "sheet"(링크 대신 data-go) 또는 "page"(정적 링크)
  const list = role === "class" ? SPECS : SPECS.filter(s => s.role === role);
  const badge = s => s.status === "ready" ? "" : `<span class="badge">준비 중</span>`;
  const attrs = s => `href="${sheetUrl(s.id)}" data-spec="${s.id}"${s.id === currentId ? ' aria-current="page"' : ""}`;
  const hasRS = role !== "class" && list.some(roleShareOf);
  const hasCS = role === "class" && list.some(specShare);
  const rsNote = hasRS ? `<div class="sharenote">${roleComp(role)}<p class="note">비율: 2시즌(이번 시즌) ${SL()}${esc(ROSTER.roles[role].ko)} 쐐기 점수 상위 ${M5().top || 500}명${SX() ? SX() + " 캐릭터" : ""}(${esc(M5().src || "Raider.IO")}, ${esc(M5().date || "")})${SX() ? "가" : "이"} 지금 켜 둔 전문화. 전문화를 고르면 영웅 특성도 같은 방식으로 비교합니다. <a href="${rankUrl("role=" + role + SQ())}">${esc(ROSTER.roles[role].ko)} 순위표 ›</a></p></div>`
    : hasCS ? `<div class="sharenote"><p class="note">비율: 직업마다 ${SL()}쐐기 점수 상위 ${M5().top || 500}명${SX() ? SX() + " 캐릭터" : ""}(${esc(M5().src || "Raider.IO")}, ${esc(M5().date || "")})${SX() ? "가" : "이"} 지금 켜 둔 전문화. 직업 이름을 누르면 그 직업 순위표가 열립니다.</p></div>` : "";
  const top = hasRS || hasCS ? smpRow() : "";
  // 역할 목록: 쐐기 상위 500명 비율 순위(순위 번호·막대). 비율 자료가 없으면 예전 모양
  if (role !== "class" && hasRS) return `${top}${rankList(list.map(s => ({ s, pct: roleShareOf(s) ? roleShareOf(s).share : 0, sub: roleShareOf(s) ? `${roleShareOf(s).n}명${s.status === "ready" ? "" : " · 준비 중"}` : (s.status === "ready" ? "" : "준비 중"), href: sheetUrl(s.id), cur: s.id === currentId })))}${rsNote}`;
  if (role !== "dps" && role !== "class") {
    const sorted = hasRS ? list.slice().sort((x, y) => (roleShareOf(y) || { share: -1 }).share - (roleShareOf(x) || { share: -1 }).share) : list;
    return `${top}<div class="stiles">${sorted.map(s => `<a class="stile" ${attrs(s)} style="--cls-ink:${s.cls.ink[0]};--cls-ink-d:${s.cls.ink[1]}">${icon(s, 36)}<span><span class="sn">${esc(specName(s))}</span>${roleShareOf(s) ? `<span class="shr"><span class="sbar"><i style="width:${Math.min(100, roleShareOf(s).share)}%"></i></span><b>${pctTxt(roleShareOf(s).share)}</b> ${roleShareOf(s).n}명</span>` : ""}${badge(s)}</span></a>`).join("")}</div>${rsNote}`;
  }
  // 딜러: 많이 고른 전문화 상위 8개를 먼저 한 줄로
  const topDps = role === "dps" && hasRS ? `<div class="toprow"><span class="lb">많이 고른 딜러 전문화</span>${list.filter(roleShareOf).sort((x, y) => roleShareOf(y).share - roleShareOf(x).share).slice(0, 8).map((s, i) => `<a class="topchip" ${attrs(s)}><span class="rk">${i + 1}</span>${icon(s, 20)}${esc(lang === "ko" ? s.koFull : s.enFull)}<b>${pctTxt(roleShareOf(s).share)}</b></a>`).join("")}</div>` : "";
  const byCls = ROSTER.classes.map(c => [c, list.filter(s => s.cls === c)]).filter(([, l]) => l.length);
  return `${top}${topDps}<div>${byCls.map(([c, l]) => `<div class="clsrow" style="--cls-ink:${c.ink[0]};--cls-ink-d:${c.ink[1]}"><div class="cn"><span class="dot" style="--cls:${c.color}"></span>${hasCS ? `<a class="cnl" href="${rankUrl("class=" + c.slug)}">${esc(lang === "ko" ? c.ko : c.en)}</a>` : esc(lang === "ko" ? c.ko : c.en)}</div><div class="chips">${l.map(s => `<a class="chip${s.status === "ready" ? "" : " soon"}" ${attrs(s)}>${icon(s, 24)}${esc(lang === "ko" ? s.ko : s.en)}${role === "class" ? `<span class="rl">${ROSTER.roles[s.role].ko}</span>` : ""}${role === "dps" && roleShareOf(s) ? `<span class="pct">${pctTxt(roleShareOf(s).share)}</span>` : ""}${hasCS && specShare(s) ? `<span class="pct">${specShare(s).share}%</span>` : ""}${badge(s)}</a>`).join("")}</div></div>`).join("")}</div>${rsNote}`;
}
function openSheet(role, currentId) {
  if (document.querySelector(".sheet")) return;
  const el = document.createElement("div");
  el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "전문화 변경");
  let r = role;
  const draw = () => {
    el.innerHTML = `<div class="sheet-panel"><div class="sheet-head"><div class="t"><h2>전문화 변경</h2><button class="x" type="button" aria-label="닫기">✕</button></div>
      <div class="seg rseg" role="group" aria-label="역할">${["tank", "healer", "dps", "class"].map(k => `<button type="button" data-role="${k}" aria-pressed="${k === r}">${k === "class" ? "직업별" : ROSTER.roles[k].ko + " " + SPECS.filter(s => s.role === k).length}</button>`).join("")}</div></div>
      <div class="sheet-body">${favList().length ? `<div class="favrow"><span class="favlab">★ 즐겨찾기</span>${favChips("sheet", currentId)}</div>` : ""}${specListHtml(r, currentId)}${anySoon() ? '<p class="note">준비 중인 전문화도 고를 수 있습니다. 던전 공략과 역할 운영까지 볼 수 있고, 내 기술 대응은 순서대로 채웁니다.</p>' : ""}</div></div>`;
  };
  draw();
  const prevRe = reSample; reSample = () => draw();
  document.body.appendChild(el);
  history.pushState({ wgSheet: 1 }, "");
  const close = back => { reSample = prevRe; el.remove(); removeEventListener("popstate", onPop); document.removeEventListener("keydown", onKey); if (back) history.back(); };
  const onPop = () => close(false);
  const onKey = e => { if (e.key === "Escape") close(true); };
  addEventListener("popstate", onPop);
  document.addEventListener("keydown", onKey);
  el.addEventListener("click", e => {
    if (e.target === el || e.target.closest(".x")) return close(true);
    const rb = e.target.closest("[data-role]"); if (rb) { r = rb.dataset.role; draw(); return; }
    const a = e.target.closest("a[data-spec]");
    if (a) {
      e.preventDefault();
      ls.set("wg:spec", a.dataset.spec);
      // 시트 기록을 새 주소로 바꿔서, 뒤로 가기 한 번이면 이전 전문화로 돌아가게 한다
      location.replace(a.href.split("#")[0] + location.hash);
    }
  });
  el.querySelector(".x").focus();
}
// 빠른 전환 줄·목록 페이지의 링크를 누르면 그 전문화를 내 전문화로 저장한다
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-spec]");
  if (a && !a.closest(".sheet")) ls.set("wg:spec", a.dataset.spec);
}, true);

// ---------- 상단 고정 헤더(모든 페이지) ----------
// 홈 · (전문화 페이지) 전문화 이름 ▾ + 쐐기 공략/레이드 공략/스킬 · (그 밖) 사이트 링크 · 내 전문화 · 클라이언트 언어(한/EN) · 메뉴(☰)
// 게임 언어 버튼은 id="tiplang" 하나뿐이다(각 페이지의 언어 전환 처리가 이 버튼에 붙는다)
const SPEC_PAGES = ["sheet", "guide", "compare", "raid", "pvp"];
const HOME_SVG = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 9.5 10 3.5l7 6V17a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
const MENU_SVG = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
// 사이트 언어 전환: 한국어 화면에서는 "English", 영어 화면에서는 "한국어"(번역하지 않음)
const uiSw = () => UI === "en" ? `<button type="button" class="uisw" data-ui="ko" translate="no" lang="ko" title="한국어 화면으로">한국어</button>` : `<button type="button" class="uisw" data-ui="en" lang="en" title="English site">English</button>`;
const hlang = () => UI === "en" ? uiSw() : `<div class="hlw"><span class="hlcap" aria-hidden="true">클라이언트 언어</span><div class="vseg hlang" id="tiplang" role="group" aria-label="클라이언트 언어 (기술·NPC 이름과 툴팁)" title="클라이언트 언어: 기술·NPC 이름과 툴팁을 한글/영문 게임 클라이언트 기준으로"><button type="button" data-l="ko" aria-pressed="${lang === "ko"}">한</button><button type="button" data-l="en" aria-pressed="${lang === "en"}">EN</button></div></div>`;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-ui]"); if (!b) return;
  e.preventDefault(); ls.set("wg:ui", b.dataset.ui);
  const u = new URL(location.href); u.searchParams.delete("ui"); location.replace(u.href);
});
function siteHeader(s, view, hero) {
  const saved = BYID[ls.get("wg:spec")];
  const cur = k => CFG.page === k ? ' aria-current="page"' : "";
  // 쐐기·레이드 두 갈래: 레이드 홈(/raid/)·레이드 공략이면 레이드, 나머지는 쐐기
  const mode = ["raidhub", "raid"].includes(CFG.page) ? "raid" : ["pvphub", "pvp", "pvpmap"].includes(CFG.page) ? "pvp" : "mplus";
  const on = m => mode === m ? ' aria-current="page"' : "";
  const modeSeg = `<nav class="vseg gmode" aria-label="쐐기·레이드·PvP"><a href="${BASE}"${on("mplus")}>쐐기</a><a href="${raidHubUrl(SQ().slice(1))}"${on("raid")}>레이드</a><a href="${pvpHubUrl()}"${on("pvp")}>PvP</a></nav>`;
  const links = mode === "raid"
    ? [["raidhub-guide", raidHubUrl(SQ().slice(1), "#guide"), "공략"], ["raidhub-rank", raidHubUrl(SQ().slice(1), "#rank"), "순위"]]
    : mode === "pvp" ? [["pvphub-guide", pvpHubUrl("", "#guide"), "빌드"], ["pvphub-rank", pvpHubUrl("", "#rank"), "순위"]]
    : [["rank", rankUrl("all" + SQ()), "순위표"], ["specs", BASE + "specs/", "전문화 목록"]];
  const mid = s ? (() => { const g = s.status === "ready" && hero;
      return `<button class="nm" id="nm" type="button" aria-haspopup="dialog" title="같은 역할의 다른 전문화"><span class="dot"></span><span class="n">${esc(specName(s))}</span>${hero ? `<span class="h">· ${esc(heroName(heroOf(s, hero)))}</span>` : ""}<span class="car" aria-hidden="true">▾</span></button>${favBtn(s.id)}
    <nav class="vseg" aria-label="보기"><a href="${sheetUrl(s.id)}"${view === "sheet" ? ' aria-current="page"' : ""}><span class="long">쐐기 공략</span><span class="short">쐐기</span></a><a class="vr" href="${raidUrl(s.id)}"${view === "raid" ? ' aria-current="page"' : ""}><span class="long">레이드 공략</span><span class="short">레이드</span></a><a class="vp" href="${pvpUrl(s.id)}"${view === "pvp" ? ' aria-current="page"' : ""}><span class="long">PvP</span><span class="short">PvP</span></a><a class="vg" href="${g ? guideUrl(s.id, hero) : "#"}"${view === "guide" ? ' aria-current="page"' : ""}${g ? "" : ' aria-disabled="true" title="스킬 준비 중"'}><span class="long">스킬</span><span class="short">스킬</span></a></nav>`; })()
    : `${modeSeg}<nav class="gnav" aria-label="${mode === "raid" ? "레이드" : "쐐기"}">${links.map(([k, u, t]) => `<a href="${u}"${cur(k)}>${t}</a>`).join("")}</nav><span class="gsp"></span>${saved ? `<a class="gmine" href="${mode === "raid" ? raidUrl(saved.id) : mode === "pvp" ? pvpUrl(saved.id) : sheetUrl(saved.id)}" data-spec="${saved.id}" title="내 전문화: ${esc(saved.koFull)} ${mode === "raid" ? "레이드 공략" : mode === "pvp" ? "PvP" : "쐐기 공략"}">${icon(saved, 22)}<span class="gml">${esc(specName(saved))}</span></a>` : ""}`;
  const sh = saved && ls.get("wg:hero:" + saved.id);
  const mine = s && saved && saved.id === s.id ? "" : saved ? `<div class="gsep">내 전문화 · ${esc(saved.koFull)}</div><a href="${sheetUrl(saved.id)}">쐐기 공략</a><a href="${raidUrl(saved.id)}">레이드 공략</a><a href="${pvpUrl(saved.id)}">PvP</a>${saved.status === "ready" ? `<a href="${guideUrl(saved.id, sh && heroOf(saved, sh) ? sh : defaultHero(saved))}">스킬</a>` : ""}` : `<a href="${BASE}?pick">전문화 고르기</a>`;
  return `<header class="lnav gh"><div class="in wrap">
    <a class="home" href="${BASE}" title="첫 화면" aria-label="첫 화면">${HOME_SVG}</a>
    ${mid}${hlang()}${thBtn()}
    <button class="gmb" id="gmb" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="gmenu" aria-label="메뉴" title="메뉴">${MENU_SVG}</button>
    <div class="gmenu" id="gmenu" hidden><div class="gm-in"><div class="gsep">쐐기</div><a href="${BASE}"${cur("select")}>쐐기 홈 · 전문화 고르기</a><a href="${rankUrl("all" + SQ())}"${cur("rank")}>쐐기 순위표</a><a href="${BASE}specs/"${cur("specs")}>전문화 목록</a><div class="gsep">레이드</div><a href="${raidHubUrl(SQ().slice(1), "#guide")}"${cur("raidhub")}>레이드 홈 · 공략 고르기</a><a href="${raidHubUrl(SQ().slice(1), "#rank")}">레이드 순위</a><div class="gsep">PvP</div><a href="${pvpHubUrl("", "#guide")}"${cur("pvphub")}>PvP 홈 · 빌드 고르기</a><a href="${pvpHubUrl("", "#rank")}">PvP 순위</a><div id="gfavs" data-mode="${mode}">${favMenuHtml(mode)}</div>${mine}${s ? '<button type="button" id="gchg">전문화 변경</button>' : ""}${UI === "en" ? '<div class="gsep">Site language</div><button type="button" data-ui="ko" translate="no" lang="ko">한국어</button>' : '<div class="gsep">사이트 언어</div><button type="button" data-ui="en" lang="en">English</button>'}</div></div></div></header>`;
}
const topbar = (s, view, hero) => siteHeader(s, view, hero);
function bindTopbar(s) {
  document.getElementById("nm").onclick = () => openSheet(s.role, s.id);
  const chg = document.getElementById("gchg"); if (chg) chg.onclick = () => { closeMenu(); openSheet(s.role, s.id); };
  // 가이드로 갔다가 돌아올 때 보던 위치를 복원한다
  document.querySelectorAll(".vseg a").forEach(a => a.addEventListener("click", () => ss.set("wg:scroll:" + location.pathname, String(scrollY))));
}
// 메뉴 열고 닫기(바깥 누름·Esc·링크 누름)
const closeMenu = () => { const m = document.getElementById("gmenu"), b = document.getElementById("gmb"); if (m && !m.hidden) { m.hidden = true; if (b) b.setAttribute("aria-expanded", "false"); } };
document.addEventListener("click", e => {
  const b = e.target.closest("#gmb");
  if (b) { const m = document.getElementById("gmenu"); m.hidden = !m.hidden; b.setAttribute("aria-expanded", String(!m.hidden)); if (!m.hidden && e.detail === 0) { const f = m.querySelector("a,button"); if (f) f.focus(); } return; } // 키보드로 열 때만 첫 항목에 포커스
  if (!e.target.closest("#gmenu") || e.target.closest("#gmenu a")) closeMenu();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { const m = document.getElementById("gmenu"); if (m && !m.hidden) { closeMenu(); document.getElementById("gmb").focus(); } } });
// 전문화 페이지가 아닌 곳(첫 화면·순위표·레이드 순위·전문화 목록·404): 헤더를 body 맨 앞에 두고, 언어·표본이 바뀌면 다시 그린다
let reLang = () => {};
const paintHeader = () => { if (SPEC_PAGES.includes(CFG.page)) return; const old = document.querySelector("body > .gh"); const html = siteHeader(null); if (old) old.outerHTML = html; else document.body.insertAdjacentHTML("afterbegin", html); };
document.addEventListener("click", e => {
  if (SPEC_PAGES.includes(CFG.page)) return;
  const b = e.target.closest("#tiplang button"); if (!b || b.dataset.l === lang) return;
  lang = b.dataset.l; ls.set("wg:lang", lang); reLang(); paintHeader();
});
function specRow(s) {
  const same = s.role === "dps" ? SPECS.filter(x => x.cls === s.cls && x.role === "dps") : SPECS.filter(x => x.role === s.role);
  return `<div class="specrow"><div class="in wrap">${same.map(x => `<a class="sr${x.status === "ready" ? "" : " soon"}" href="${sheetUrl(x.id)}" data-spec="${x.id}"${x.id === s.id ? ' aria-current="page"' : ""} style="--c:${x.cls.color}">${icon(x, 32)}<span>${esc(lang === "ko" ? x.ko : x.en)}${s.role === "dps" ? "" : `<br>${esc(lang === "ko" ? x.cls.ko : x.cls.en)}`}</span></a>`).join("")}${s.role === "dps" ? `<button class="sr" type="button" id="alldps"><span class="more">…</span><span>딜러 전체</span></button>` : ""}</div></div>`;
}

// 준비 중인 전문화가 하나라도 있을 때만 "준비 중도 고를 수 있다" 안내를 보인다
const anySoon = () => Object.values(BYID).some(x => x.status !== "ready");
// ---------- 공유 링크·준비 중 배너 ----------
function bannerHtml(s, visiting) {
  const mine = BYID[ls.get("wg:spec")];
  let h = "";
  if (visiting && mine) {
    h += `<div class="banner share" id="bshare"><b>${esc(ro(s.koFull))}</b> 보는 중입니다. 저장된 내 전문화는 ${esc(mine.koFull)}입니다.<div class="acts"><a class="pill gray" href="${sheetUrl(mine.id, location.hash)}">내 전문화로</a><button class="pill" type="button" id="bsave">이 전문화로 저장</button></div></div>`;
  }
  if (!favList().length && ls.get("wg:favnudge") !== "off") {
    h += `<div class="banner share" id="bfav"><span>☆ 자주 보는 전문화는 즐겨찾기에 추가하세요. 첫 화면과 전문화 변경 맨 위에 모여 바로 열 수 있습니다. 즐겨찾기는 이 브라우저에만 저장됩니다.</span><div class="acts">${favBtn(s.id).replace('class="favb"', 'class="favb pill"').replace(/>[☆★]</, ">☆ 즐겨찾기에 추가<")}<button class="pill gray" type="button" id="bfavx">닫기</button></div></div>`;
  }
  if (s.status !== "ready") {
    const roleOk = s.role === "tank";
    h += `<div class="banner"><b>이 전문화의 기술 대응은 준비 중입니다.</b> ${roleOk ? "던전 공략과 탱커 운영은 볼 수 있습니다." : "던전 공략은 볼 수 있고, 역할 팁도 준비 중입니다."} 스킬 탭도 준비되면 열립니다.</div>`;
  }
  return h;
}
function bindBanner(s, onSave) {
  const fx = document.getElementById("bfavx"); if (fx) fx.onclick = () => { ls.set("wg:favnudge", "off"); document.getElementById("bfav").remove(); };
  const sv = document.getElementById("bsave"), cl = document.getElementById("bclose");
  if (sv) sv.onclick = () => { ls.set("wg:spec", s.id); document.getElementById("bshare").remove(); onSave(); };
  if (cl) cl.onclick = () => { ss.set("wg:nudge-off", "1"); document.getElementById("bshare").remove(); };
}

// ---------- 게임 언어: 한글 이름 치환 ----------
const JOSA = [["으로", "로"], ["이나", "나"], ["을", "를"], ["은", "는"], ["이", "가"], ["과", "와"]];
function josaFix(word, rest) {
  const c = word.charCodeAt(word.length - 1); if (c < 0xAC00 || c > 0xD7A3) return null;
  const jong = (c - 0xAC00) % 28;
  for (const [a, b] of JOSA) for (const p of [a, b]) {
    if (!rest.startsWith(p)) continue;
    const nx = rest.charAt(p.length);
    const ok = !/[가-힣]/.test(nx) || (b === "로" && /[도는서써부만의]/.test(nx)) || (b === "와" && /[의도는]/.test(nx));
    if (!ok) continue;
    return [p.length, b === "로" ? ((jong === 0 || jong === 8) ? "로" : "으로") : (jong ? a : b)];
  }
  return null;
}
function makeKo(dict) {
  const re = new RegExp("(?<![A-Za-z'’])(" + Object.keys(dict).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![A-Za-z'’])", "g");
  return s => {
    let out = "", i = 0, m; re.lastIndex = 0;
    while ((m = re.exec(s))) {
      const ko = dict[m[1]]; out += s.slice(i, m.index) + ko; i = m.index + m[0].length;
      const p = josaFix(ko, s.slice(i)); if (p) { out += p[1]; i += p[0]; }
      re.lastIndex = i;
    }
    return out + s.slice(i);
  };
}
// "산레인으로", "기사단으로"처럼 받침에 맞는 조사 로/으로
const ro = w => { const c = w.charCodeAt(w.length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + "(으)로"; const j = (c - 0xAC00) % 28; return w + (j === 0 || j === 8 ? "로" : "으로"); };
// 영문 문장에서 대문자로 이어진 덩어리(예: "Interrupt Radiant Spellsower's Light Bolt Volley")를 아는 이름 단위로 쪼갠다.
// 왼쪽부터 가장 긴 아는 이름(기술 툴팁·한글 사전·NPC)을 찾아 감싸고, 소유격('s)은 이름 밖에 둔다.
// 아는 이름이 아닌 나머지는 문장 첫 동사·연결어(AB_STOP)를 떼고 남은 것만 감싼다. 한글 문장 속 이름은 덩어리가 이름 하나라 결과가 그대로다.
const AB_STOP = new Set(("A An The And Or But If When While Whenever Once After Before During For From To On In At By With Without Into Of Then So As " +
  "This That These Those It Its They Them Their You Your Each Every Both All Any No Not Only Also Even Just Always Never Otherwise Instead " +
  "Use Using Kill Killing Interrupt Interrupts Kick Kicking Pull Pulling Put Keep Assign Go Going Take Save Stand Move Dodge Spread Stack Avoid " +
  "Dispel Purge Cast Casting Pop Hold Stop Watch Face Stun Let Bring Do Don't Run Step Drop Clear Burst Focus Swap Switch Turn Send Skip Wait " +
  "Lust Bloodlust Heroism Topicx Method Wowhead Physical Holy Fire Frost Nature Shadow Arcane Magic Poison Disease Curse Bleed Enrage " +
  "DPS Tank Tanks Healer Healers Melee Ranged Boss Bosses Trash Mob Mobs Add Adds Pull Pulls Phase Intermission DoT HoT Dead Dying " +
  "Note Tip Important Mandatory Optional Recommended Here There Now Later Next Last First Second Third " +
  "Players Player Place Soak Taunt Under Over Break Slow Freeze Rotate Refresh Spend Engage Mark Right Left Gather Press Line Leave Make Give Get " +
  "Throughout Everyone Getting Touching Eating Standing Have Aim Grab Set Split Remove Absorb Damage Party RP " +
  "Mythic Heroic Normal AoE CC Two Three Four One Until Unless Between Behind Away Back Out Up Down Both Either Neither Still Again Then").split(" "));
// 한 덩어리 seg 가 아는 이름이면 [보일 글자, 꼬리, 조회 이름] 을 돌려준다. 원형 → 소유격 → 복수 → 동사형 → 단수로 쓴 복수 이름 순서.
function abMatch(seg, known) {
  const hy = seg.match(/-[a-z][a-z-]*$/); // "Stormkeeper-empowered" → Stormkeeper + -empowered
  for (const t of ["", "'s", "’s", "'", "’", "s'", "s", "es", "ing", "ed", ...(hy ? [hy[0]] : [])]) { // Pummeling → Pummel
    if (t && !seg.endsWith(t)) continue;
    const bs = t ? seg.slice(0, -t.length) : seg;
    if (bs && /[A-Za-z!]$/.test(bs) && known(bs)) return [bs, t, ""];
  }
  if (/ies$/.test(seg) && known(seg.slice(0, -3) + "y")) return [seg, "", seg.slice(0, -3) + "y"]; // Singularities → Singularity
  if (/[^e]ing$/.test(seg) && known(seg.slice(0, -3) + "e")) return [seg, "", seg.slice(0, -3) + "e"]; // Silencing → Silence, Death Striking → Death Strike
  for (const t of ["s", "es"]) if (known(seg + t)) return [seg, "", seg + t]; // Mirror Image → Mirror Images(이름이 복수형)
  const ws = seg.split(" ");
  for (let q = 0; q < ws.length - 1; q++) if (/[a-z]s$/.test(ws[q])) { const sg = [...ws.slice(0, q), ws[q].slice(0, -1), ...ws.slice(q + 1)].join(" "); if (known(sg)) return [seg, "", sg]; } // Orbs of Disruption
  return null;
}
// 덩어리를 아는 이름들로 나누는 방법 중 아는 이름이 덮는 단어가 가장 많은 것을 고른다(같으면 조각이 적은 쪽).
// 예: "Remove Curse of Doom" → Remove + [Curse of Doom] (왼쪽부터 가장 긴 것을 고르면 [Remove Curse] + of Doom 이 됨)
function abSplit(run, known) {
  const w = run.split(" "), n = w.length, best = Array(n + 1).fill(null);
  best[n] = { cov: 0, pcs: 0, parts: [] };
  for (let i = n - 1; i >= 0; i--) {
    let b = { cov: best[i + 1].cov, pcs: best[i + 1].pcs, parts: [[w[i]], ...best[i + 1].parts] }; // i 를 일반 단어로
    for (let j = n; j > i; j--) {
      const m = abMatch(w.slice(i, j).join(" "), known); if (!m) continue;
      const c = { cov: best[j].cov + (j - i), pcs: best[j].pcs + 1, parts: [m, ...best[j].parts] };
      if (c.cov > b.cov || (c.cov === b.cov && c.pcs < b.pcs)) b = c;
    }
    best[i] = b;
  }
  const out = []; let buf = [];
  const flush = () => {
    if (!buf.length) return;
    let a = 0, b = buf.length;
    const weak = x => AB_STOP.has(x.replace(/['’]s?$/, "")) || /^[a-z&]/.test(x);
    while (a < b && weak(buf[a])) a++;
    while (b > a && /^[a-z&]/.test(buf[b - 1])) b--;
    const core = buf.slice(a, b), cw = core.join(" ");
    const wrap = core.length && /^[A-Z]/.test(core[0]) && !(core.length === 1 && AB_STOP.has(core[0].replace(/['’]s?$/, "")));
    out.push([...buf.slice(0, a), wrap ? `<span class="ab">${cw}</span>` : cw, ...buf.slice(b)].filter(Boolean).join(" "));
    buf = [];
  };
  for (const p of best[0].parts) {
    if (p.length === 1) { buf.push(p[0]); continue; }
    flush(); const [base, suf, tn] = p; out.push(`<span class="ab"${tn ? ` data-tn="${tn}"` : ""}>${base}</span>${suf}`);
  }
  flush();
  return out.join(" ");
}
const tipNorm = s => s.replace(/\s*\([^)]*\)\s*$/, "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

// ---------- Wowhead 링크: 게임 언어가 한글이면 한국어 Wowhead(/ko/), 영문이면 영문 ----------
const wh = path => `https://www.wowhead.com/${lang === "ko" ? "ko/" : ""}${path}`;
function whLinks(root) {
  (root || document).querySelectorAll('a[href*="wowhead.com/"]').forEach(a => {
    const m = a.href.match(/^https:\/\/(?:www|ko)\.wowhead\.com\/(?:ko\/)?(.*)$/); if (!m) return;
    a.href = wh(m[1]);
  });
}

// ---------- 툴팁 공용 ----------
const tipEl = document.createElement("div"); tipEl.id = "sptip"; tipEl.setAttribute("role", "tooltip"); tipEl.hidden = true;
const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
let tipFor = null, showTip = () => {};
function placeTip(el) {
  tipEl.hidden = false;
  const r = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let left = Math.min(Math.max(8, r.left), vw - w - 8), top = r.bottom + 8;
  if (top + h > vh - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
  tipEl.style.left = left + "px"; tipEl.style.top = Math.max(8, top) + "px";
}
let tipHideT = 0;
function hideTip() { clearTimeout(tipHideT); tipEl.hidden = true; tipFor = null; }
// 커서가 기술에서 툴팁으로 옮겨 가는 틈(8px)에 닫히지 않게 조금 기다렸다 닫는다. 툴팁이나 같은 기술로 돌아오면 취소
const hideTipSoon = () => { clearTimeout(tipHideT); tipHideT = setTimeout(hideTip, 300); };
const keepTip = () => clearTimeout(tipHideT);
function spellTipHtml(id, en, ko) {
  const useKo = lang === "ko" && ko;
  const s = useKo ? { n: ko.n, m: ko.m, d: ko.d, i: en.i } : en;
  return `<div class="tt-head"><img src="https://wow.zamimg.com/images/wow/icons/medium/${s.i}.jpg" alt=""><div><div class="tt-name">${esc(s.n)}${useKo ? `<span class="tt-orig">${esc(en.n)}</span>` : ""}</div>${s.m ? `<div class="tt-meta">${esc(s.m)}</div>` : ""}</div></div><div class="tt-desc">${s.d ? esc(s.d).replace(/\n/g, "<br>") : (useKo ? '<span class="tt-none">Wowhead에 공식 설명이 없는 기술입니다.</span>' : '<span class="tt-none">No official description on Wowhead.</span>')}</div><a class="tt-link" href="${wh("spell=" + id)}" target="_blank" rel="noopener">${lang === "ko" ? "Wowhead에서 보기" : "View on Wowhead"}</a>`;
}
function bindTips(sel) {
  document.body.appendChild(tipEl);
  if (canHover) {
    document.addEventListener("mouseover", e => { const el = e.target.closest(sel); if (el) { keepTip(); if (el !== tipFor) showTip(el); } });
    document.addEventListener("mouseout", e => { const el = e.target.closest(sel); if (el && (!e.relatedTarget || !el.contains(e.relatedTarget)) && !tipEl.contains(e.relatedTarget)) hideTipSoon(); });
    tipEl.addEventListener("mouseenter", keepTip);
    tipEl.addEventListener("mouseleave", e => { if (tipFor && e.relatedTarget && tipFor.contains(e.relatedTarget)) return; hideTipSoon(); });
  }
  document.addEventListener("click", e => {
    const el = e.target.closest(sel);
    if (el) { e.preventDefault(); e.stopPropagation(); if (tipFor === el && !canHover) hideTip(); else showTip(el); return; }
    if (!tipEl.contains(e.target)) hideTip();
  }, true);
  // 터치·클릭으로 생긴 focus 는 무시 (그 뒤 click 이 툴팁을 토글하므로, 여기서 먼저 열면 click 이 바로 닫아 버림)
  let lastPtr = 0; document.addEventListener("pointerdown", () => { lastPtr = Date.now(); }, true);
  document.addEventListener("focusin", e => { if (Date.now() - lastPtr < 800) return; const el = e.target.closest && e.target.closest(sel); if (el) showTip(el); });
  // 툴팁 안 Wowhead 링크를 누르면 포커스가 기술에서 링크로 옮겨 가며 focusout 이 먼저 온다. 그때 닫으면 링크가 사라져 눌리지 않으므로,
  // 포인터(마우스·터치)로 생긴 포커스 이동이나 툴팁 안으로의 이동은 무시한다(바깥을 누르면 click 처리가 닫는다)
  document.addEventListener("focusout", e => {
    if (Date.now() - lastPtr < 800) return;
    const rt = e.relatedTarget; if (rt && (tipEl.contains(rt) || (tipFor && tipFor.contains(rt)))) return;
    if ((e.target.closest && e.target.closest(sel)) || tipEl.contains(e.target)) hideTip();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") hideTip(); });
  addEventListener("scroll", () => { if (!tipEl.hidden) hideTip(); }, { passive: true });
}
function langSeg(id) {
  return `<div class="seg" id="${id}" role="group" aria-label="게임 언어 (기술·NPC 이름과 툴팁)"><button type="button" data-l="ko" aria-pressed="${lang === "ko"}">한글</button><button type="button" data-l="en" aria-pressed="${lang === "en"}">English</button></div>`;
}

// ---------- 모바일: 영상 링크를 YouTube 앱으로 열기 ----------
(function () {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isAndroid && !isIOS) return;
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href*="youtube.com/watch"]'); if (!a) return;
    const u = new URL(a.href), v = u.searchParams.get("v"), t = parseInt(u.searchParams.get("t"), 10);
    if (!v) return;
    e.preventDefault();
    const q = `watch?v=${v}${t > 0 ? `&t=${t}` : ""}`;
    if (isAndroid) {
      // 앱이 없으면 browser_fallback_url로 웹 영상이 열림
      location.href = `intent://www.youtube.com/${q}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(a.href)};end`;
      return;
    }
    // iOS: 앱으로 넘어가면 페이지가 숨겨짐. 1.5초 뒤에도 그대로면 앱이 없는 것이니 웹으로 열기
    let left = false; const onHide = () => { left = true; };
    document.addEventListener("visibilitychange", onHide, { once: true });
    addEventListener("pagehide", onHide, { once: true });
    location.href = `youtube://www.youtube.com/${q}`;
    setTimeout(() => { if (!left && !document.hidden) location.href = a.href; }, 1500);
  });
})();

const app = () => document.getElementById("app");
function fail(err) {
  console.error(err);
  app().innerHTML = `<div class="center"><h1>불러오지 못했습니다</h1><p>네트워크를 확인하고 새로고침해 주세요.</p><p><a class="pill" href="${BASE}specs/">전문화 목록</a></p></div>`;
}

// =====================================================================
// 공략 (S2·S6·S7)
// =====================================================================
async function sheetPage() {
  const s = BYID[CFG.spec];
  if (!s) { location.replace(BASE + "?pick"); return; }
  setClassColor(s.cls);
  const [core, en, ko, names, npcs, role, spec, routes] = await Promise.all([
    J("data/core/dungeons.json"), J("data/core/spells.en.json"), J("data/core/spells.ko.json"), J("data/core/names.ko.json"),
    J("data/core/npcs.json"), J(`data/role/${s.role}.json`),
    s.status === "ready" ? J(`data/spec/${s.id.replace("/", "-")}.json`) : Promise.resolve(null),
    J("data/core/routes.json").catch(() => null),
  ]);
  const ROUTES = (routes && routes.dungeons) || {};
  const saved = ls.get("wg:spec");
  let visiting = saved !== s.id;
  const save = (k, v) => { if (!visiting) ls.set(k, v); };

  const TAGS = role.tags;
  const A = n => `<span class="ab">${n}</span>`;
  const MOBS = npcs;
  const SPELLS = { ...en, ...(spec ? spec.spells : {}) }, SPELLS_KO = { ...ko, ...(spec ? spec.spellsKo : {}) };
  // 한글 이름 사전: 공략에 쓰는 기술(공용 + 전문화 매핑)만 넣는다
  const specTipIds = new Set(Object.values(spec ? spec.tips : {}));
  const KO_ALL = (() => { const o = {}; for (const id in SPELLS) { if (!en[id] && !specTipIds.has(id)) continue; const k = SPELLS_KO[id]; if (k && k.n) o[SPELLS[id].n] = k.n; } return Object.assign(o, names, spec ? spec.names : {}); })();
  const koText = makeKo(KO_ALL);
  const NPC_RE = new RegExp("(?<![A-Za-z'’])(" + [...new Set([...Object.keys(KO_ALL), ...Object.keys(MOBS)])].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![A-Za-z'’])", "g");
  const tokens = str => str.replace(/\{([^{}]+)\}/g, (m, n) => A(n));
  const answer = key => {
    const base = key.split(".")[0], a = (spec && spec.answers[key]) ?? role.answers[key] ?? (spec && spec.answers[base]) ?? role.answers[base];
    return a == null ? null : tokens(a);
  };
  // 공용 항목의 역할별 태그: 옵션 객체 rt: {dps: "prio", healer: "prio"} (없으면 원래 태그)
  const tagOf = it => (it[2] && it[2].rt && it[2].rt[s.role]) || it[0];
  const itemHtml = ([, x, o]) => {
    if (!o || !o.m) return x + (o && o.post || "");
    const ans = answer(o.m);
    return ans == null ? x + (o.post || "") : x + (o.sep ?? " → ") + ans + (o.post || "");
  };

  // 공통 탭: 준비된 전문화는 전문화 층, 준비 중이면 해제 담당표만
  const general = spec ? { id: "general", ...spec.general } : { id: "general", name: "공통", sub: "파티 공통 정보", bosses: [{ n: "해제 담당표", k: "Dispel", block: "dispel" }] };
  const D = [general, ...core.dungeons];
  const DETAIL = core.detail, RDETAIL = role.detail, SDETAIL = spec ? spec.detail : {};
  const TRASH = core.trash, RIO = core.rio;
  const rioArticle = id => `https://raider.io/news/${RIO[id][0]}`;
  const rioVideo = (id, t) => `https://www.youtube.com/watch?v=${RIO[id][1]}${t ? `&t=${t}s` : ""}`;

  // 영웅
  let hero = s.heroes[0].slug;
  const qh = new URLSearchParams(location.search).get("hero");
  hero = heroOf(s, qh) ? qh : (savedHero(s) || defaultHero(s));

  // 태그: 데이터에 실제로 있는 태그만 역할 순서대로 보여 준다
  const TAGK = Object.fromEntries(Object.entries(TAGS).map(([k, v]) => [v, k]));
  const present = new Set();
  D.forEach(d => d.bosses.forEach(b => (b.i || []).forEach(it => present.add(tagOf(it)))));
  Object.values(TRASH).forEach(gs => gs.forEach(g => g.i.forEach(it => present.add(tagOf(it)))));
  [role.brief, spec && spec.brief].forEach(src => Object.values(src || {}).forEach(bs => Object.values(bs).forEach(arr => arr.forEach(([t]) => present.add(t)))));
  if (spec) Object.values(spec.heroCards).forEach(h => h.items.forEach(([t]) => present.add(t)));
  const tagRe = new RegExp(`^\\[(${Object.values(TAGS).join("|")})\\]\\s*`);
  [DETAIL, RDETAIL, SDETAIL].forEach(src => Object.values(src).forEach(bs => Object.values(bs).forEach(x => {
    const lines = Array.isArray(x) ? x : [...(x.phases || []).flatMap(p => p.points), ...(x.group || [])];
    lines.forEach(l => { const m = String(l).match(tagRe); present.add(m ? TAGK[m[1]] : "tip"); });
  })));
  [role.pulls, spec && spec.pulls, Object.fromEntries(Object.entries(ROUTES).map(([k, r]) => [k, r.notes]))].forEach(src => Object.values(src || {}).forEach(ps => Object.values(ps).forEach(arr => (arr || []).forEach(l => { const m = String(l).match(tagRe); present.add(m ? TAGK[m[1]] : "tip"); }))));
  const ORDER = role.order.filter(t => present.has(t));
  let off = []; try { off = JSON.parse(ls.get("wg:tags:" + s.role) || "[]"); } catch (e) {}
  if (!Array.isArray(off) || ls.get("wg:tags:" + s.role) == null) off = role.off;
  let on = new Set(ORDER.filter(t => !off.includes(t)));
  if (!on.size) on = new Set(ORDER);

  let active = D[1].id;
  const st = ls.get("wg:tab"); if (st && D.some(d => d.id === st)) active = st;
  const h0 = location.hash.slice(1); if (D.some(d => d.id === h0)) active = h0;
  let openState = {}; try { openState = JSON.parse(ls.get("wg:open") || "{}") || {}; } catch (e) { openState = {}; }

  // ---- 화면 뼈대 ----
  // 영웅 특성 버튼 옆에 쐐기 상위 순위권의 선택 비율(roster.hero500)을 바로 보여 준다
  const heroPct = h => { const t = heroTop(s, h.slug); return t ? ` <span class="hpct">${t.pct}%</span>` : ""; };
  const heroSrc = s.heroes.some(h => heroTop(s, h.slug)) ? `<span class="herosrc">${SL()}쐐기 상위 ${STOP()}명${SX()} 선택</span>` : "";
  const heroSeg = `<div class="seg" id="hero" role="group" aria-label="Hero talent">${s.heroes.map(h => `<button type="button" data-h="${h.slug}" aria-pressed="${h.slug === hero}" data-ko="${esc(esc(h.ko) + heroPct(h))}">${esc(h.en)}${heroPct(h)}</button>`).join("")}</div>`;
  app().innerHTML = topbar(s, "sheet", hero) + specRow(s) + `<div class="wrap">
    <div id="banners">${bannerHtml(s, visiting)}</div>
    <p class="lede" id="lede"></p>
    <nav class="tabbar" aria-label="던전"><div class="tabs" id="tabs" role="tablist"></div><div class="tabtrack" id="tabtrack" hidden><div class="tabthumb" id="tabthumb"></div></div></nav>
    <div class="ctrl"><div class="herorow"><span class="herogrp"><span data-ko="영웅 특성">Hero</span>${heroSeg}${heroSrc}</span></div><div class="filters" id="filters"></div></div>
    <main id="main"></main>
    <footer id="foot"></footer></div>`;
  bindTopbar(s);
  bindBanner(s, () => { visiting = false; });
  const alldps = document.getElementById("alldps"); if (alldps) alldps.onclick = () => openSheet("dps", s.id);
  const tabsEl = document.getElementById("tabs"), mainEl = document.getElementById("main"), filtEl = document.getElementById("filters");

  const roleKo = ROSTER.roles[s.role].ko;
  const footer = () => {
    const src = core.sources.slice();
    if (spec) spec.sources.forEach(x => src.splice(x.after + 1, 0, x));
    return `<div><b style="color:var(--int)">차단</b> 항목의 <span class="need must">필수</span>는 놓치면 파티가 죽을 수 있는 시전, <span class="need rec">권장</span>은 피해를 줄이는 용도라 놓쳐도 생존기로 버틸 수 있는 시전입니다.</div>
      <div>한글 모드의 NPC·던전 이름은 Mythic Dungeon Tools와 LittleWigs 애드온의 한국어 번역 데이터, 기술 이름은 Wowhead 한국어 데이터를 따릅니다. 몹 이름을 누르면 나오는 생김새 이미지는 Wowhead 모델 썸네일입니다.</div>
      ${spec && spec.note ? `<div>${esc(spec.note)}</div>` : ""}
      ${spec ? `<div><b style="color:var(--tip)">참고</b> 태그는 가이드 원문이 아니라 ${esc(s.koFull)} 키트에 맞춘 추가 팁입니다.</div>` : ""}
      <div>출처: ${src.map(x => `<a href="${esc(srcU(x.u))}" target="_blank" rel="noopener">${esc(x.t)}</a>`).join(" · ")}</div>
      <div>전문화 목록과 아이콘은 게임 데이터(${esc(ROSTER.meta.gameBuild)}) 기준입니다. <a href="${BASE}specs/">전체 전문화</a> · <a href="${BASE}?pick">처음부터 고르기</a></div>`;
  };
  document.getElementById("foot").innerHTML = footer();

  // ---- 매크로·해제 담당표 ----
  const macros = () => `<p class="note" style="margin:0 0 10px">${spec.macroNote}</p><div class="macros">` +
    spec.macros.map(([n, d, c], i) => `<div class="mac"><div class="machead"><div><div class="ab">${n}</div><div class="macdesc">${d}</div></div><button class="copy" id="copy-${i}" data-i="${i}">복사</button></div><pre id="mac-${i}">${c}</pre></div>`).join("") + `</div>`;
  const dispelTable = () => {
    const kit = spec ? spec.kit.dispel : {};
    const rows = core.dispel.rows.map(r => {
      const mine = kit[r.type];
      // 내가 풀 수 있으면 내 전문화를 맨 앞에 두고, 목록에서 내 직업 항목은 뺀다
      const others = r.whoAll.split(", ").filter(x => !x.startsWith(s.cls.ko)).join(", ");
      const who = mine ? `${esc(s.koFull)} ${A(mine)}${others ? ", " + tokens(others) : ""}` : tokens(r.whoAll);
      return `<tr><td><span class="tag t-${r.cls}">${r.label}</span></td><td>${who}</td><td${mine ? ' class="me"' : ""}>${mine ? "나" : r.owner}</td></tr>`;
    }).join("");
    return `<div class="tbl"><table><thead><tr><th>디버프</th><th>풀 수 있는 직업</th><th>담당</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">${core.dispel.note}</p>`;
  };
  document.addEventListener("click", e => {
    const b = e.target.closest(".copy"); if (!b) return;
    const i = +b.dataset.i, txt = document.getElementById("mac-" + i).textContent;
    const done = () => { b.textContent = "복사됨"; setTimeout(() => b.textContent = "복사", 1500); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(document.getElementById("mac-" + i)); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = "선택됨"; setTimeout(() => b.textContent = "복사", 1500); };
    try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (err) { fallback(); }
  });

  // ---- 상세 공략 ----
  const escH = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const AB_RE = /([A-Z](?:[A-Za-z'’\-]+|(?=\s[A-Z]))(?:\s(?:(?:of|the|and|&amp;|on|in|to|a)\s)*[A-Z][A-Za-z'’\-]*)*)/g;
  // "Power Word: Shield"처럼 콜론이 든 이름은 툴팁·한글 사전에 있는 이름일 때만 한 덩어리로 감싼다
  // 꼬리에는 다음 콜론 이름("… and Shadow Word: Madness")의 앞부분을 붙이지 않는다
  const AB_COLON = /([A-Z][A-Za-z'’\-]*(?:\s[A-Z][A-Za-z'’\-]*)*:\s[A-Z][A-Za-z'’\-]*(?:\s(?:(?:of|the|and|&amp;|on|in|to|a)\s)*(?![A-Z][A-Za-z'’\-]*(?:\s[A-Z][A-Za-z'’\-]*)*:)[A-Z][A-Za-z'’\-]*)*)/g;
  const abKnown = m => { const k = tipNorm(m.replace(/&amp;/g, "&")); return Object.values(core.tips).some(t => t[k]) || (spec && spec.tips[k]) || core.commonTips[k] || KO_ALL[m] != null; };
  const abIsName = m => abKnown(m) || !!MOBS[m.replace(/&amp;/g, "&")];
  // "Put Power Word: Shield"처럼 앞에 문장 단어가 붙으면 앞 단어를 하나씩 떼며 아는 이름을 찾는다(복수 -s/-es 포함)
  const colonPart = part => {
    const w = part.split(" "), ci = w.findIndex(x => x.endsWith(":")), rest = x => x ? x.replace(AB_RE, y => abSplit(y, abIsName)) : "";
    // 앞 문장 단어(Put, Press)와 뒤에 붙은 다른 이름(and Mind Blast)을 떼어 가며 가장 긴 아는 이름을 찾는다(복수 -s/-es 포함)
    for (let i = 0; i <= ci; i++) for (let k = w.length; k > ci + 1; k--) {
      const nm = w.slice(i, k).join(" "), pl = nm.match(/^(.*?)(es|s)$/);
      const hit = abKnown(nm) ? [nm, ""] : pl && abKnown(pl[1]) ? [pl[1], pl[2]] : null;
      if (hit) return [rest(w.slice(0, i).join(" ")), `<span class="ab">${hit[0]}</span>${hit[1]}`, rest(w.slice(k).join(" "))].filter(Boolean).join(" ");
    }
    return rest(part);
  };

  const abWrap = x => escH(x).split(AB_COLON).map((part, i) => i % 2 ? colonPart(part) : part.replace(AB_RE, m => abSplit(m, abIsName))).join("");
  function deepItems(arr) {
    return (arr || []).map(x => { const m = String(x).match(tagRe); return [m ? TAGK[m[1]] : "tip", m ? String(x).slice(m[0].length) : String(x)]; })
      .filter(([t]) => on.has(t))
      .map(([t, x]) => `<li><span class="tag t-${t}">${TAGS[t]}</span><span>${abWrap(x)}</span></li>`).join("");
  }
  // 역할 층 문장 중 전문화가 자기 문구로 바꿔 쓰는 줄(roleOverride: {"던전/보스": {줄번호: 문장}})
  function roleLines(did, bn) {
    const arr = (RDETAIL[did] || {})[bn]; if (!arr) return arr;
    const ov = spec && spec.roleOverride && spec.roleOverride[`${did}/${bn}`];
    return ov ? arr.map((l, i) => ov[i] ?? l) : arr;
  }
  function deepHtml(did, b) {
    const x = (DETAIL[did] || {})[b.n]; if (!x) return "";
    const key = `deep-${did}-${b.n}`;
    const open = openState[key] === true;
    const blk = (title, arr, cls) => { const lis = deepItems(arr); return lis ? `<div class="dblk${cls ? " " + cls : ""}"><h4>${title}</h4><ul class="items">${lis}</ul></div>` : ""; };
    const phases = (x.phases || []).map(p => blk(abWrap(p.title), p.points)).join("");
    const body = phases + blk(role.label, roleLines(did, b.n), "role") + blk(`${s.koFull} 활용`, (SDETAIL[did] || {})[b.n], "spec") + blk("파티 공통", x.group);
    return `<details class="deep fold" data-k="${key}"${open ? " open" : ""}><summary><span>상세 공략</span><span class="chev" aria-hidden="true">▾</span></summary><div class="deepbody">${body || '<p class="empty">선택한 태그 항목 없음</p>'}</div></details>`;
  }
  // MDT(Mythic Dungeon Tools) 추천 경로: data/core/dungeons.json 의 mdt[던전] (Method 가이드가 거는 Tactyks PUG Friendly 경로, wago 원본 문자열)
  const mdtHtml = id => {
    const m = (core.mdt || {})[id]; if (!m) return "";
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    return `<button class="vid mdtcopy" type="button" data-d="${id}" title="게임에서 /mdt → Import에 붙여 넣기">MDT 경로 복사</button><a class="vid" href="${esc(m.wago)}" target="_blank" rel="noopener" title="${esc(m.name)} (${esc(m.author)}, Method 추천 · ${esc(m.updated)})">MDT 경로 원본</a><textarea class="mdtbox" readonly hidden aria-label="MDT 경로 문자열">${esc(m.string)}</textarea>`;
  };
  document.addEventListener("click", e => {
    const b = e.target.closest(".mdtcopy"); if (!b) return;
    const m = b.dataset.r ? ROUTES[b.dataset.d] : (core.mdt || {})[b.dataset.d]; if (!m) return;
    const box = b.parentElement.querySelector(".mdtbox");
    const label = b.dataset.label || "MDT 경로 복사";
    const done = () => { b.textContent = "복사됨 · /mdt → Import"; setTimeout(() => b.textContent = label, 2500); };
    const fallback = () => { if (box) { box.hidden = false; box.focus(); box.select(); } b.textContent = "선택됨"; setTimeout(() => b.textContent = label, 2500); };
    try { navigator.clipboard.writeText(m.string).then(done, fallback); } catch (err) { fallback(); }
  });
  document.addEventListener("click", e => {
    const b = e.target.closest(".expall"); if (!b) return;
    const all = [...document.querySelectorAll("details.deep")]; const openAll = all.some(d => !d.open);
    all.forEach(d => { d.open = openAll; openState[d.dataset.k] = openAll; });
    save("wg:open", JSON.stringify(openState));
    b.textContent = openAll ? "상세 모두 접기" : "상세 모두 펼치기";
  });
  document.addEventListener("toggle", e => { const el = e.target; if (!el.matches || !el.matches("details.fold")) return; openState[el.dataset.k] = el.open; save("wg:open", JSON.stringify(openState)); }, true);

  // ---- 툴팁 ----
  const TIPS = core.tips;
  function decorateTips(did) {
    const maps = [TIPS[did] || {}, spec ? spec.tips : {}, core.commonTips];
    // 상세 공략의 공용·역할 블록은 던전 기술 이름이므로 전문화 tips 를 쓰지 않는다(예: 기원사 Echo ↔ Echo of Nalorakk)
    const shared = [TIPS[did] || {}, core.commonTips];
    mainEl.querySelectorAll(".ab").forEach(el => {
      if (el.dataset.sid) return;
      const k = tipNorm(el.dataset.tn || el.textContent); let id = null;
      const inShared = (el.closest(".deepbody") && !el.closest(".dblk.spec")) || el.closest(".dover");
      for (const m of inShared ? shared : maps) { if (m[k]) { id = m[k]; break; } }
      if (!id) return;
      el.dataset.sid = id; el.classList.add("has-tip"); el.tabIndex = 0; el.setAttribute("role", "button");
    });
  }
  function npcMark(el, name) { el.dataset.npc = name; el.classList.add("has-tip", "npc-tip"); el.tabIndex = 0; el.setAttribute("role", "button"); }
  function npcDecorate(root) {
    root.querySelectorAll(".mob, .ab:not([data-sid]), .boss h3 > span").forEach(el => { const n = el.textContent.trim(); if (MOBS[n]) npcMark(el, n); });
    // 태그 없이 본문에 적힌 몹 이름도 감싸기. 더 긴 이름(예: Adderis & Aspix)에 속한 경우는 그대로 둠
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let n;
    while ((n = w.nextNode())) if (!n.parentElement.closest(".ab,.mob,[data-npc],pre,a,button,.tag,.need")) nodes.push(n);
    nodes.forEach(t => {
      const str = t.data; let m, i = 0, frag = null; NPC_RE.lastIndex = 0;
      while ((m = NPC_RE.exec(str))) {
        if (!MOBS[m[1]]) continue;
        frag = frag || document.createDocumentFragment();
        frag.append(str.slice(i, m.index));
        const sp = document.createElement("span"); sp.className = "npc"; sp.textContent = m[1]; npcMark(sp, m[1]); frag.append(sp);
        i = m.index + m[1].length;
      }
      if (frag) { frag.append(str.slice(i)); t.replaceWith(frag); }
    });
  }
  function koApply(root) {
    root.querySelectorAll(".ab,.mob,.npc").forEach(el => {
      const e2 = el.textContent, sk = el.dataset.sid && SPELLS_KO[el.dataset.sid];
      // 툴팁 ID의 공식 이름은 본문 이름이 그 주문과 같을 때만 씀 (예: "Holy Armaments (Lightsmith)" 매크로 제목은 제외)
      const k = (sk && tipNorm(e2) === tipNorm(SPELLS[el.dataset.sid].n) && sk.n) || KO_ALL[e2] || koText(e2);
      if (k === e2) return;
      el.textContent = k;
      const nx = el.nextSibling;
      if (nx && nx.nodeType === 3) { const p = josaFix(k, nx.data); if (p) nx.data = p[1] + nx.data.slice(p[0]); }
    });
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let n;
    while ((n = w.nextNode())) if (!n.parentElement.closest(".ab,.mob,.npc")) nodes.push(n);
    nodes.forEach(n => { const t = koText(n.data); if (t !== n.data) n.data = t; });
  }
  function showNpc(el) {
    const name = el.dataset.npc, [id, disp] = MOBS[name] || [], k = KO_ALL[name], useKo = lang === "ko" && k;
    tipFor = el;
    tipEl.innerHTML = `${disp ? `<img class="tt-model" src="https://wow.zamimg.com/modelviewer/live/webthumbs/npc/${disp % 256}/${disp}.png" alt="">` : ""}<div class="tt-name">${esc(useKo ? k : name)}${useKo ? `<span class="tt-orig">${esc(name)}</span>` : ""}</div><a class="tt-link" href="${wh("npc=" + id)}" target="_blank" rel="noopener">${lang === "ko" ? "Wowhead에서 3D 모델 보기" : "View 3D model on Wowhead"} ↗</a>`;
  }
  showTip = el => {
    if (el.dataset.npc) { showNpc(el); return placeTip(el); }
    const e2 = SPELLS[el.dataset.sid]; if (!e2) return;
    tipFor = el;
    tipEl.innerHTML = spellTipHtml(el.dataset.sid, e2, SPELLS_KO[el.dataset.sid]);
    placeTip(el);
  };
  bindTips(".has-tip");

  // ---- 언어 ----
  function applyChrome() {
    const k = lang === "ko";
    [...tabsEl.children].forEach((b, i) => b.textContent = k ? (KO_ALL[D[i].name] || D[i].name) : D[i].name);
    document.querySelectorAll("[data-ko]").forEach(el => { if (el.dataset.en == null) el.dataset.en = el.innerHTML; el.innerHTML = k ? el.dataset.ko : el.dataset.en; });
    document.getElementById("lede").textContent = `쐐기 ${core.dungeons.length}개 던전 ${roleKo} 공략 · 기술·NPC 이름은 ${k ? "한글" : "영문"} 클라이언트 기준`;
    document.querySelector(".lnav .n").textContent = specName(s);
    const hn = document.querySelector(".lnav .h"); if (hn) hn.textContent = "· " + heroName(heroOf(s, hero));
    document.title = `${specName(s)} · 쐐기 공략`;
    whLinks();
  }
  document.querySelectorAll("#tiplang button").forEach(b => b.onclick = () => {
    lang = b.dataset.l; ls.set("wg:lang", lang);
    document.querySelectorAll("#tiplang button").forEach(x => x.setAttribute("aria-pressed", x.dataset.l === lang));
    hideTip(); render(); applyChrome();
  });

  // ---- 탭·필터·영웅 ----
  D.forEach(d => {
    const b = document.createElement("button"); b.className = "tab"; b.id = "tab-" + d.id; b.type = "button"; b.setAttribute("role", "tab"); b.textContent = d.name;
    b.onclick = () => { active = d.id; save("wg:tab", d.id); history.replaceState(history.state, "", location.pathname + location.search + "#" + d.id); render(); };
    tabsEl.appendChild(b);
  });
  ORDER.forEach(k => {
    const b = document.createElement("button"); b.className = "filt t-" + k; b.id = "f-" + k; b.type = "button"; b.textContent = TAGS[k]; b.setAttribute("aria-pressed", "true");
    b.onclick = () => { on.has(k) ? on.delete(k) : on.add(k); if (!on.size) ORDER.forEach(x => on.add(x)); save("wg:tags:" + s.role, JSON.stringify(ORDER.filter(x => !on.has(x)))); render(); };
    filtEl.appendChild(b);
  });
  document.querySelectorAll("#hero button").forEach(b => b.onclick = () => {
    hero = b.dataset.h; save("wg:hero:" + s.id, hero);
    const g = document.querySelector(".vseg a.vg"); if (g && s.status === "ready") g.href = guideUrl(s.id, hero);
    render(); applyChrome();
  });

  function abName(html) { const m = html.match(/<span class="ab">([^<]+)<\/span>/); return m ? m[1] : null; }
  function heroCard(d) {
    if (!spec) return "";
    const busters = [];
    d.bosses.forEach(b => { if (b.k.startsWith("Boss")) b.i.forEach(([t, x]) => { if (t === "tb") { const n = abName(x); if (n) busters.push(`${n} <span style="color:var(--muted)">(${b.n})</span>`); } }); });
    const list = busters.length ? busters.map(x => `<span class="ab">${x}</span>`).join(", ") : "보스 탱버 정보 없음";
    const hc = spec.heroCards[hero];
    const lis = hc.items.filter(([t]) => on.has(t)).map(([t, x]) => `<li><span class="tag t-${t}">${TAGS[t]}</span><span>${tokens(x.replace("{busters}", "\u0000")).replace("\u0000", list)}</span></li>`).join("");
    return `<section class="boss herocard"><h3>${hc.title}<small>Hero</small></h3>${lis ? `<ul class="items">${lis}</ul>` : `<p class="empty">선택한 태그 항목 없음</p>`}</section>`;
  }
  // 경로 지도 + 풀 공략: data/core/routes.json (Topicx 경로, tools/routes/build_routes.py)
  // 지도 번호·몹 점에 마우스를 올리면 풀 이름, 누르면 팝업으로 공략. 보스 풀은 보스 공략을 그대로 담는다.
  // 일반 풀 = 몹 기술(core.trash에서 그 풀의 몹 항목) + 풀 운영(notes) + 역할·전문화 층 pulls[던전][풀번호]
  const slug = x => String(x).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const mobOf = it => { const m = String(it[1]).match(/<b class="mob">([^<]+)<\/b>/); return m ? m[1] : null; };
  function routeSection(d, bossOf, bossInner) {
    const r = ROUTES[d.id]; if (!r) return "";
    const items = (TRASH[d.id] || []).flatMap(g => g.i);
    const pct = x => (x / r.total * 100).toFixed(1);
    const cen = p => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
    const C = r.pulls.map(p => cen(p.p));
    // 지도
    let path = "", prev = r.entr;
    C.forEach((c, i) => { const mv = r.moves[i + 1]; path += `<line class="${mv ? "rmove" : "rseg"}" x1="${prev[0]}" y1="${prev[1]}" x2="${c[0].toFixed(0)}" y2="${c[1].toFixed(0)}"/>`; prev = c; });
    // 경로에서 잡지 않는 몹은 회색 점(잡몹 점수 0인 몹은 더 작게). 누를 수 없고 풀 점 아래에 깔린다.
    const rest = `<g class="rrest">${(r.rest || []).map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="${q[2] > 0 ? 9 : 6}"/>`).join("")}</g>`;
    const dots = r.pulls.map((p, i) => `<g class="rp" data-n="${i + 1}">${p.p.map((q, j) => `<circle cx="${q[0]}" cy="${q[1]}" r="10" fill="#${p.c}"${(p.addp || []).includes(j) ? ' class="padd"' : ""}/>`).join("")}</g>`).join("");
    const nums = C.map((c, i) => { const b = r.pulls[i].boss; return `<g class="rnum${b ? " rboss" : ""}" data-n="${i + 1}" tabindex="0" role="button" aria-label="${b ? "보스" : "일반몹"} ${i + 1}"><circle cx="${c[0].toFixed(0)}" cy="${c[1].toFixed(0)}" r="26"/><text x="${c[0].toFixed(0)}" y="${c[1].toFixed(0)}">${i + 1}</text></g>`; }).join("");
    const entr = `<g class="rentr"><circle cx="${r.entr[0]}" cy="${r.entr[1]}" r="18"/><text x="${r.entr[0] + 28}" y="${r.entr[1]}">입구</text></g>`;
    const map = `<div class="rmap" data-d="${d.id}" style="aspect-ratio:${r.w}/${r.h}"><img src="${BASE + r.img}" width="${r.w}" height="${r.h}" alt="${esc(d.name)} 경로 지도" loading="lazy"><svg viewBox="0 0 ${r.w} ${r.h}" aria-hidden="false">${rest}${path}<g class="rdots">${dots}</g>${entr}${nums}<g class="rtop"></g></svg><button type="button" class="rmz" aria-label="지도 크게 보기">⤢ 크게 보기</button></div><div class="rmtip" aria-live="polite"><span class="rmt-ph">번호나 몹 위에 마우스를 올리면 여기에 풀 정보가 나옵니다 · 누르면 공략</span></div>`;
    // 풀 공략(팝업에 띄우는 카드, 평소에는 숨김)
    const RP = ((role.pulls || {})[d.id]) || {}, SP = ((spec && spec.pulls || {})[d.id]) || {};
    const blk = (t, lis, cls) => lis ? `<div class="dblk${cls ? " " + cls : ""}"><h4>${t}</h4><ul class="items">${lis}</ul></div>` : "";
    const cards = r.pulls.map((p, i) => {
      const n = i + 1, mobs = p.mobs.filter(m => m[2] > 0 || p.boss === m[0]);
      const mv = (r.moves[n] ? `<p class="rmv">✈ ${esc(r.moves[n])}</p>` : "") + (p.add ? `<p class="radd">＋ 보충: ${p.add.map(x => `<span class="mob">${esc(x)}</span>`).join(", ")} · Topicx 경로를 만든 뒤 MDT 업데이트로 빠진 몹 대신 더 잡아 100%를 채운다</p>` : "");
      const notes = deepItems((r.notes[n] || []).map(x => /^\[/.test(x) ? x : "[참고] " + x));
      const rl = deepItems(RP[n]), sl = deepItems(SP[n]);
      const lines = blk("풀 운영", notes) + blk(role.label, rl, "role") + blk(`${s.koFull} 활용`, sl, "spec");
      const B = p.boss && bossOf(p.boss);
      let head, k, body, vid = "";
      if (B) {
        const x = bossInner(B); vid = x.vid;
        head = esc(B.n); k = B.k; body = mv + x.list + lines + x.deep;
      } else {
        const names = new Set(mobs.map(m => m[0]));
        const its = items.filter(it => names.has(mobOf(it)) && on.has(tagOf(it))).map(it => `<li><span class="tag t-${tagOf(it)}">${TAGS[tagOf(it)]}</span><span>${itemHtml(it)}</span></li>`).join("");
        const comp = `<p class="rcomp">${mobs.map(m => `<span class="mob">${esc(m[0])}</span> ${m[1]}`).join(" · ")}</p>`;
        head = (p.boss ? [p.boss] : mobs.slice(0, 2).map(m => m[0])).map(esc).join(", ") + (!p.boss && mobs.length > 2 ? ` +${mobs.length - 2}` : "");
        k = p.boss ? "Boss" : `${pct(p.f)}% · 누적 ${pct(p.cum)}%`;
        body = mv + comp + (its ? `<ul class="items">${its}</ul>` : "") + lines;
        if (!its && !lines) body += `<p class="empty">선택한 태그 항목 없음</p>`;
      }
      return `<section class="boss pcard${p.boss ? " pboss" : ""}" data-pull="${n}" hidden><h3><span class="bn">${head}</span><small>${vid}<span class="pcat">${p.boss ? "보스" : "일반몹"}</span>&nbsp;${n}&nbsp;·&nbsp;<span class="pk">${k}</span></small></h3><div class="pullbody">${body}</div></section>`;
    }).join("");
    const src = routes.source;
    const last = r.pulls[r.pulls.length - 1].cum;
    const short = last < r.total ? `<p class="rwarn">이 경로는 최신 MDT 데이터 기준 잡몹 ${pct(last)}%에서 끝난다. 경로를 만든 뒤 MDT에서 빠진 몹이 있어서이니 마지막 보스 전에 근처 몹을 조금 더 잡는다.</p>` : "";
    return `<div class="sechead"><h2>경로 · 일반몹 · 보스</h2><p>${esc(src.author)} PUG 경로 · 번호나 몹 위에 마우스를 올리면 풀 이름, 누르면 공략 · 회색 점은 이 경로에서 잡지 않는 몹 · 잡몹 총량 ${r.total}</p></div>
      <p class="dlinks rlinks"><button class="vid mdtcopy" type="button" data-d="${d.id}" data-r="1" data-label="이 경로 MDT 복사" title="게임에서 /mdt → Import에 붙여 넣기">이 경로 MDT 복사</button>${r.video ? `<a class="vid" href="${esc(r.video)}" target="_blank" rel="noopener">▶ ${esc(src.author)} 해설 영상</a>` : ""}<a class="vid" href="${esc(src.folder)}" target="_blank" rel="noopener" title="${esc(src.name)} · ${esc(src.updated)}">경로 원본</a><textarea class="mdtbox" readonly hidden aria-label="MDT 경로 문자열">${esc(r.string)}</textarea></p>
      ${fixHtml(r)}${short}${map}<div class="pulls" hidden>${cards}</div>`;
  }
  // 경로 보정 안내: MDT 업데이트로 번호만 바뀐 몹을 다시 연결(relink)했거나 빠진 몹 대신 보충(add)한 경우. 복사 문자열도 보정본이다.
  function fixHtml(r) {
    const f = r.fixes || []; if (!f.length) return "";
    const one = ([n, name, k]) => `<span>${n}풀</span> <span class="mob">${esc(name)}</span> <span>${k === "add" ? "보충" : k === "group" ? "같은 무리라 함께" : "다시 연결"}</span>`;
    return `<p class="rfix"><span>MDT 경로 보정:</span> ${f.map(one).join(" · ")}<span>. Topicx 경로를 만든 뒤 MDT 업데이트로 바뀐 부분을 맞췄습니다(빠진 몹 대신 보충, 같은 무리 몹은 함께 당김). 복사 문자열 이름 끝에 "(보정)"이 붙습니다.</span></p>`;
  }
  function trashSection(d, fold) {
    const tr = TRASH[d.id]; if (!tr || ROUTES[d.id]) return "";
    const cards = tr.map((g, gi) => {
      const lis = g.i.filter(it => on.has(tagOf(it))).map(it => `<li><span class="tag t-${tagOf(it)}">${TAGS[tagOf(it)]}</span><span>${itemHtml(it)}</span></li>`).join("");
      const body = lis ? `<ul class="items">${lis}</ul>` : `<p class="empty">선택한 태그 항목 없음</p>`;
      return fold({ n: g.n, k: `Trash · ${g.i.length}` }, body, " trash", `trash-${d.id}-${gi}`, false);
    }).join("");
    return `<div class="sechead"><h2>일반몹</h2><p>구간을 눌러 펼치기 · 출처 Icy Veins</p></div>` + cards;
  }
  // 풀 공략 팝업: body에 한 번 만들고 던전마다 다시 묶는다. 카드는 열 때 팝업으로 옮기고 닫을 때 숨김 보관함으로 돌려놓는다.
  const PM = (() => {
    const el = document.createElement("div"); el.className = "pmodal"; el.hidden = true;
    el.innerHTML = `<div class="pm-back" data-x></div><div class="pm-box" role="dialog" aria-modal="true" aria-label="풀 공략"><div class="pm-bar"><button type="button" class="pm-nav" data-step="-1" aria-label="이전 풀">◀</button><span class="pm-pos"></span><button type="button" class="pm-nav" data-step="1" aria-label="다음 풀">▶</button><button type="button" class="expall pm-exp" hidden>상세 모두 펼치기</button><button type="button" class="pm-x" data-x>닫기 ✕</button></div><div class="pm-body"></div></div>`;
    document.body.append(el);
    return { el, body: el.querySelector(".pm-body"), pos: el.querySelector(".pm-pos"), cur: null, n: 0, ctx: null };
  })();
  // 팝업과 지도 보기는 휴대폰 뒤로 가기로 닫히도록 history에 한 칸씩 쌓는다(위에서부터 닫힘).
  const LAYERS = [];
  const pushLayer = k => { LAYERS.push(k); history.pushState({ wgLayer: k }, ""); };
  const closeTop = k => { if (LAYERS[LAYERS.length - 1] === k) history.back(); else (k === "pm" ? pmCloseRaw : mvCloseRaw)(); };
  addEventListener("popstate", () => { const k = LAYERS.pop(); if (k === "pm") pmCloseRaw(); else if (k === "mv") mvCloseRaw(); });
  // 지도 띠에 넣는 풀 한 줄(분류 · 번호 · 이름 · 비중). 카드에 이미 입힌 한글화·몹 표시를 그대로 가져온다.
  const bandHtml = (store, n) => {
    const q = `.pcard[data-pull="${n}"]`, c = store.querySelector(q) || PM.body.querySelector(q); if (!c) return "";
    return `<span class="pcat${c.classList.contains("pboss") ? " b" : ""}">${c.querySelector(".pcat").textContent}</span><b>${n}</b><span class="rmt-n">${c.querySelector(".bn").innerHTML}</span><small>${pkHtml(c.querySelector(".pk").textContent)}</small>`;
  };
  function pkHtml(k) { const i = k.indexOf(" · "); return i < 0 ? escH(k) : `${escH(k.slice(0, i))}<span class="pk2">${escH(k.slice(i))}</span>`; }
  const untab = el => el.querySelectorAll("[tabindex]").forEach(x => x.removeAttribute("tabindex"));
  // 하이라이트한 풀은 몹 점을 번호 원 위(맨 위 칸 .rtop)로 올려 번호에 가리지 않게 하고, 나머지는 제자리(.rdots)로 돌린다
  const raiseDots = (svg, n) => {
    const top = svg.querySelector(".rtop"), base = svg.querySelector(".rdots"); if (!top || !base) return;
    if (n && top.children.length === 1 && top.firstElementChild.dataset.n === String(n)) return; // 이미 올라가 있음(마우스 이벤트 반복 방지)
    [...top.children].forEach(g => base.appendChild(g));
    const g = n && base.querySelector(`.rp[data-n="${n}"]`); if (g) top.appendChild(g);
  };
  function pmCloseRaw(refocus = true) {
    if (PM.el.hidden) return;
    const c = PM.ctx;
    if (PM.cur) { PM.cur.hidden = true; if (c && c.store.isConnected) c.store.append(PM.cur); else PM.cur.remove(); }
    PM.cur = null; PM.el.hidden = true; document.documentElement.classList.remove("pm-open");
    if (c && c.store.isConnected) { c.sel(null); const g = refocus && MV.el.hidden && c.svg.querySelector(`.rnum[data-n="${PM.n}"]`); g && g.focus({ preventScroll: true }); }
  }
  const pmClose = () => closeTop("pm");
  function pmOpen(n) {
    const c = PM.ctx; if (!c) return;
    const card = c.store.querySelector(`.pcard[data-pull="${n}"]`); if (!card) return;
    if (PM.cur) { PM.cur.hidden = true; c.store.append(PM.cur); }
    card.hidden = false; PM.body.replaceChildren(card); PM.cur = card; PM.n = +n;
    PM.pos.textContent = `${n} / ${c.max}`;
    PM.el.querySelector('[data-step="-1"]').disabled = PM.n <= 1;
    PM.el.querySelector('[data-step="1"]').disabled = PM.n >= c.max;
    // 상세 공략이 있는 카드(보스 풀)에서만 "상세 모두 펼치기"를 보인다. 글자는 지금 펼침 상태에 맞춘다
    const ex = PM.el.querySelector(".pm-exp"), deeps = [...card.querySelectorAll("details.deep")];
    ex.hidden = !deeps.length; ex.textContent = deeps.length && deeps.every(x => x.open) ? "상세 모두 접기" : "상세 모두 펼치기";
    const was = PM.el.hidden;
    PM.el.hidden = false; document.documentElement.classList.add("pm-open"); PM.body.scrollTop = 0;
    c.sel(n); c.hide();
    if (!MV.el.hidden) mvSelect(n);
    if (was) { pushLayer("pm"); PM.el.querySelector(".pm-x").focus({ preventScroll: true }); }
  }
  PM.el.addEventListener("click", e => {
    if (e.target.closest("[data-x]")) return pmClose();
    const st = e.target.closest(".pm-nav"); if (st && PM.ctx) pmOpen(Math.min(PM.ctx.max, Math.max(1, PM.n + +st.dataset.step)));
  });
  document.addEventListener("keydown", e => {
    if (PM.el.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); pmClose(); }
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.target.closest("input,textarea") && PM.ctx) pmOpen(Math.min(PM.ctx.max, Math.max(1, PM.n + (e.key === "ArrowLeft" ? -1 : 1))));
  });
  // ---- 지도 크게 보기: 전체 화면, 두 손가락 확대·한 손가락 이동·빈 곳 두 번 탭 확대, 휠 확대(데스크톱) ----
  // 터치: 풀을 한 번 탭하면 하이라이트 + 띠, 같은 풀을 다시 탭하거나 "공략 보기"를 누르면 팝업. 마우스: 올리면 하이라이트, 누르면 팝업.
  const MV = (() => {
    const el = document.createElement("div"); el.className = "mviewer"; el.hidden = true;
    el.innerHTML = `<div class="mv-stage"><div class="mv-layer"></div></div><button type="button" class="mv-x" aria-label="지도 닫기">✕</button><div class="mv-zoom"><button type="button" data-z="in" aria-label="확대">+</button><button type="button" data-z="out" aria-label="축소">−</button><button type="button" data-z="fit" aria-label="원래대로">⟲</button></div><div class="mv-band" hidden><div class="mv-info"></div><button type="button" class="mv-go">공략 보기 ›</button></div>`;
    document.body.append(el);
    return { el, stage: el.querySelector(".mv-stage"), layer: el.querySelector(".mv-layer"), band: el.querySelector(".mv-band"), info: el.querySelector(".mv-info"), w: 1, h: 1, k: 1, fit: 1, tx: 0, ty: 0, sel: null, pts: [], svg: null };
  })();
  const mvMaxK = () => Math.max(MV.fit * 2, 3);
  const mvApply = () => { MV.layer.style.transform = `translate(${MV.tx}px,${MV.ty}px) scale(${MV.k})`; if (MV.sel) mvBandPos(); };
  const mvClamp = () => {
    const W = MV.stage.clientWidth, H = MV.stage.clientHeight, w = MV.w * MV.k, h = MV.h * MV.k;
    MV.tx = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, MV.tx));
    MV.ty = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, MV.ty));
  };
  const mvZoomAt = (k, cx, cy) => {
    k = Math.min(mvMaxK(), Math.max(MV.fit, k));
    const mx = (cx - MV.tx) / MV.k, my = (cy - MV.ty) / MV.k;
    MV.k = k; MV.tx = cx - mx * k; MV.ty = cy - my * k; mvClamp(); mvApply();
  };
  const mvFit = () => { MV.fit = Math.min(MV.stage.clientWidth / MV.w, MV.stage.clientHeight / MV.h); MV.k = MV.fit; MV.tx = MV.ty = 0; mvClamp(); mvApply(); };
  // 탭 판정: 가장 가까운 번호 원·몹 점을 찾고, 화면에서 24px 안쪽이면 그 풀(번호가 작아도 손가락으로 잡히게)
  const mvHit = (cx, cy) => {
    const mx = (cx - MV.tx) / MV.k, my = (cy - MV.ty) / MV.k; let best = null, bd = Infinity;
    MV.pts.forEach(p => { const d = Math.hypot(p.x - mx, p.y - my) - p.r; if (d < bd) { bd = d; best = p.n; } });
    return bd * MV.k <= 24 ? best : null;
  };
  const mvBandPos = () => {}; // 띠는 항상 화면 하단(지도는 끌어서 옮길 수 있음)
  function mvSelect(n) {
    MV.sel = n ? String(n) : null;
    if (!MV.svg) return;
    MV.svg.classList.toggle("sel", !!n); MV.svg.querySelectorAll("[data-n]").forEach(g => g.classList.toggle("on", g.dataset.n === MV.sel)); raiseDots(MV.svg, MV.sel);
    if (!n || !PM.ctx) { MV.band.hidden = true; return; }
    MV.info.innerHTML = bandHtml(PM.ctx.store, n); untab(MV.info);
    MV.band.hidden = false; mvBandPos();
  }
  function mvOpen(n) {
    const c = PM.ctx; if (!c) return;
    const svg = c.svg.cloneNode(true); untab(svg); svg.classList.remove("sel"); svg.querySelectorAll(".on").forEach(g => g.classList.remove("on"));
    const img = c.map.querySelector("img").cloneNode(); img.loading = "eager";
    const vb = svg.viewBox.baseVal; MV.w = vb.width; MV.h = vb.height;
    MV.layer.style.width = MV.w + "px"; MV.layer.style.height = MV.h + "px";
    MV.layer.replaceChildren(img, svg); MV.svg = svg;
    const pt = (g, ci, num) => ({ n: g.dataset.n, x: +ci.getAttribute("cx"), y: +ci.getAttribute("cy"), r: +ci.getAttribute("r"), num });
    MV.pts = [...svg.querySelectorAll(".rnum")].map(g => pt(g, g.querySelector("circle"), true)).concat([...svg.querySelectorAll(".rp")].flatMap(g => [...g.querySelectorAll("circle")].map(ci => pt(g, ci, false))));
    MV.band.classList.remove("hover"); // 손가락으로 열면 "공략 보기"를 보인다(마우스를 움직이면 다시 숨김)
    MV.el.hidden = false; document.documentElement.classList.add("mv-open"); pushLayer("mv");
    mvFit(); mvSelect(n || null); c.hide();
    MV.el.querySelector(".mv-x").focus({ preventScroll: true });
  }
  function mvCloseRaw() { if (MV.el.hidden) return; MV.el.hidden = true; document.documentElement.classList.remove("mv-open"); MV.layer.replaceChildren(); MV.svg = null; MV.sel = null; MV.band.hidden = true; }
  (() => {
    const ptrs = new Map(); let G = null, lastTap = { t: 0, x: 0, y: 0 };
    const sr = () => MV.stage.getBoundingClientRect();
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), mid = p => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
    const base = () => { const p = [...ptrs.values()].map(q => ({ ...q })); G = { k: MV.k, tx: MV.tx, ty: MV.ty, p, moved: G ? G.moved : false, multi: (G && G.multi) || p.length > 1, t0: G ? G.t0 : performance.now() }; };
    MV.stage.addEventListener("pointerdown", e => { try { MV.stage.setPointerCapture(e.pointerId); } catch (_) {} ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); base(); });
    MV.stage.addEventListener("pointermove", e => {
      const r = sr();
      if (!ptrs.has(e.pointerId)) { // 마우스 올리기 = 하이라이트
        // 마우스는 올리기만 해도 띠가 바뀌므로 띠의 "공략 보기"까지 갈 수 없다 → 마우스 띠에서는 버튼을 숨기고 풀을 눌러 연다
        if (e.pointerType === "mouse") { const n = mvHit(e.clientX - r.left, e.clientY - r.top); MV.band.classList.add("hover"); if (n !== MV.sel) mvSelect(n); MV.stage.style.cursor = n ? "pointer" : ""; }
        return;
      }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = [...ptrs.values()];
      if (p.length === 1 && G.p.length === 1) {
        const dx = p[0].x - G.p[0].x, dy = p[0].y - G.p[0].y;
        if (!G.moved && Math.hypot(dx, dy) > 6) G.moved = true;
        if (G.moved) { MV.tx = G.tx + dx; MV.ty = G.ty + dy; mvClamp(); mvApply(); }
      } else if (p.length >= 2 && G.p.length >= 2) {
        G.moved = true;
        const m0 = mid(G.p), m1 = mid(p), k = Math.min(mvMaxK(), Math.max(MV.fit, G.k * dist(p[0], p[1]) / dist(G.p[0], G.p[1])));
        const mx = (m0.x - r.left - G.tx) / G.k, my = (m0.y - r.top - G.ty) / G.k;
        MV.k = k; MV.tx = m1.x - r.left - mx * k; MV.ty = m1.y - r.top - my * k; mvClamp(); mvApply();
      }
    });
    const end = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size) return base();
      const g = G; G = null;
      if (e.type !== "pointerup" || g.moved || g.multi || performance.now() - g.t0 > 500) return;
      const r = sr(), x = e.clientX - r.left, y = e.clientY - r.top, n = mvHit(x, y), now = performance.now();
      if (e.pointerType !== "mouse") MV.band.classList.remove("hover");
      if (n) { lastTap.t = 0; if (e.pointerType === "mouse" || MV.sel === n) pmOpen(n); else mvSelect(n); return; }
      if (now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40) { mvZoomAt(MV.k > MV.fit * 1.05 ? MV.fit : MV.fit * 2.5, x, y); lastTap.t = 0; }
      else { lastTap = { t: now, x, y }; if (e.pointerType !== "mouse") mvSelect(null); }
    };
    MV.stage.addEventListener("pointerup", end); MV.stage.addEventListener("pointercancel", end);
    MV.stage.addEventListener("wheel", e => { e.preventDefault(); const r = sr(); mvZoomAt(MV.k * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    MV.el.addEventListener("click", e => {
      if (e.target.closest(".mv-x")) return closeTop("mv");
      if (e.target.closest(".mv-go")) return MV.sel && pmOpen(MV.sel);
      const z = e.target.closest("[data-z]"); if (!z) return;
      const W = MV.stage.clientWidth / 2, H = MV.stage.clientHeight / 2;
      if (z.dataset.z === "fit") mvFit(); else mvZoomAt(MV.k * (z.dataset.z === "in" ? 1.6 : 1 / 1.6), W, H);
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && PM.el.hidden && !MV.el.hidden) { e.preventDefault(); closeTop("mv"); } });
    addEventListener("resize", () => { if (!MV.el.hidden) mvFit(); });
  })();
  function bindRoute() {
    LAYERS.length = 0; pmCloseRaw(false); mvCloseRaw();
    const map = mainEl.querySelector(".rmap"); if (!map) { PM.ctx = null; return; }
    const svg = map.querySelector("svg"), tip = map.nextElementSibling, ph = tip.innerHTML, store = mainEl.querySelector(".pulls");
    const sel = n => { svg.classList.toggle("sel", !!n); svg.querySelectorAll("[data-n]").forEach(g => g.classList.toggle("on", g.dataset.n === String(n))); raiseDots(svg, n); };
    const hide = () => { tip.innerHTML = ph; tip.classList.remove("on"); if (PM.el.hidden) sel(null); };
    // 풀 정보는 지도 아래 전용 칸(.rmtip)에만 띄워 지도를 가리지 않는다. 비어 있을 때는 안내 문구.
    const show = n => {
      const h = bandHtml(store, n); if (!h) return;
      tip.innerHTML = h; untab(tip); tip.classList.add("on"); sel(n);
    };
    const nOf = g => g.dataset.n;
    svg.querySelectorAll(".rnum,.rp").forEach(g => {
      g.addEventListener("mouseenter", () => show(nOf(g)));
      g.addEventListener("mouseleave", hide);
    });
    // 마우스로 누르면 바로 팝업, 손가락으로 누르면 지도 크게 보기(누른 풀을 골라 둔 채로)
    let lastPT = "mouse";
    map.addEventListener("pointerdown", e => { lastPT = e.pointerType; });
    map.addEventListener("click", e => {
      if (e.target.closest(".rmz")) return mvOpen();
      const g = e.target.closest(".rnum,.rp"), n = g && g.dataset.n;
      if (lastPT !== "mouse") return mvOpen(n);
      if (n) pmOpen(n);
    });
    svg.querySelectorAll(".rnum").forEach(g => {
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pmOpen(nOf(g)); } });
      g.addEventListener("focus", () => { if (g.matches(":focus-visible")) show(nOf(g)); });
      g.addEventListener("blur", hide);
    });
    PM.ctx = { store, svg, map, sel, hide, max: store.querySelectorAll(".pcard").length };
  }
  function render() {
    [...tabsEl.children].forEach((b, i) => b.setAttribute("aria-selected", D[i].id === active));
    [...filtEl.children].forEach(b => b.setAttribute("aria-pressed", on.has(b.id.slice(2))));
    document.querySelectorAll("#hero button").forEach(b => b.setAttribute("aria-pressed", b.dataset.h === hero));
    const d = D.find(x => x.id === active);
    const bosses = d.bosses.filter(b => (!b.hero || b.hero === hero) && b.k !== "Trash");
    const fold = (b, body, cls = "", key = b.k, defOpen = b.k !== "Macro") => {
      const open = key in openState ? openState[key] : defOpen;
      return `<details class="boss fold${cls}" data-k="${key}"${open ? " open" : ""}><summary><h3><span class="bn">${b.n}</span><small>${b.k} <span class="chev" aria-hidden="true">▾</span></small></h3></summary>${body}</details>`;
    };
    const blockHtml = b => b.block === "dispel" ? dispelTable() : macros();
    // 보스 공략 본문(요약 = 공용 층 + 역할 층 role.brief + 전문화 층 spec.brief, 그리고 상세 공략)
    const bossInner = b => {
      const extra = [...(((role.brief || {})[d.id] || {})[b.n] || []), ...(((spec && spec.brief || {})[d.id] || {})[b.n] || [])];
      const lis = [...b.i, ...extra].filter(it => on.has(tagOf(it))).map(it => `<li><span class="tag t-${tagOf(it)}">${TAGS[tagOf(it)]}</span><span>${itemHtml(it)}</span></li>`).join("");
      // 간편 공략 = 흐름 요약(상세 공략의 overview) + 요약 항목. 상세 공략처럼 접고 펼 수 있는 표시를 단다(기본 펼침).
      const ov = ((DETAIL[d.id] || {})[b.n] || {}).overview;
      const inner = (ov ? `<p class="dover">${abWrap(ov)}</p>` : "") + (lis ? `<ul class="items">${lis}</ul>` : `<p class="empty">선택한 태그 항목 없음</p>`);
      const ek = `easy-${d.id}-${b.n}`, eOpen = openState[ek] !== false;
      const list = d.id === "general" ? inner : `<details class="easy fold" data-k="${ek}"${eOpen ? " open" : ""}><summary><span>간편 공략</span><span class="chev" aria-hidden="true">▾</span></summary><div class="easybody">${inner}</div></details>`;
      return { list, deep: deepHtml(d.id, b), vid: (RIO[d.id] && b.k !== "Trash") ? `<a class="vid" href="${rioVideo(d.id, b.t)}" target="_blank" rel="noopener">▶ 영상</a>` : "" };
    };
    const R0 = ROUTES[d.id], inRoute = new Set(R0 ? R0.pulls.filter(p => p.boss).map(p => p.boss) : []);
    mainEl.innerHTML = `<div><h2 class="dname">${d.name}</h2><p class="dsub">${d.sub}${d.time ? ` · <span class="dtime">제한 시간 <b>${d.time}분</b></span>` : ""}${RIO[d.id] ? `</p><p class="dlinks"><a class="vid" href="${rioVideo(d.id)}" target="_blank" rel="noopener">▶ Raider.IO 영상</a><a class="vid rio" href="${rioArticle(d.id)}" target="_blank" rel="noopener">Raider.IO 글</a>${ROUTES[d.id] ? "" : mdtHtml(d.id)}` : ` · <a class="vid" href="${core.generalVideo.href}" target="_blank" rel="noopener">${core.generalVideo.label}</a>`}</p></div>` + (d.id !== "general" ? heroCard(d) : "") + bosses.map(b => {
      if (b.block) return fold(b, blockHtml(b));
      if (inRoute.has(b.n)) return "";
      const x = bossInner(b);
      if (d.id === "general") return fold(b, x.list, b.hero ? " herocard" : "");
      return `<section class="boss${b.hero ? " herocard" : ""}" id="boss-${slug(b.n)}"><h3><span>${b.n}</span><small>${x.vid}${b.k}</small></h3>${x.list}${x.deep}</section>`;
    }).join("") + routeSection(d, n => bosses.find(b => b.n === n), bossInner) + trashSection(d, fold);
    bindRoute();
    decorateTips(d.id);
    npcDecorate(mainEl);
    if (lang === "ko") koApply(mainEl);
    whLinks(mainEl);
    const t = document.getElementById("tab-" + active); t && t.scrollIntoView({ block: "nearest", inline: "center" });
  }
  render();
  applyChrome();
  const back = ss.get("wg:scroll:" + location.pathname);
  if (back != null) { ss.set("wg:scroll:" + location.pathname, ""); if (+back > 0) scrollTo(0, +back); }

  // ---- 던전 목록 스크롤 막대 ----
  (function () {
    const track = document.getElementById("tabtrack"), thumb = document.getElementById("tabthumb");
    const sync = () => {
      const sw = tabsEl.scrollWidth, cw = tabsEl.clientWidth;
      if (sw <= cw + 1) { track.hidden = true; return; }
      track.hidden = false;
      const tw = track.clientWidth, w = Math.max(28, tw * cw / sw), x = (tw - w) * tabsEl.scrollLeft / (sw - cw);
      thumb.style.width = w + "px"; thumb.style.transform = "translateX(" + x + "px)";
    };
    tabsEl.addEventListener("scroll", sync, { passive: true });
    addEventListener("resize", sync);
    if (window.ResizeObserver) new ResizeObserver(sync).observe(tabsEl);
    let drag = null;
    thumb.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); thumb.setPointerCapture(e.pointerId); thumb.classList.add("dragging"); drag = { x: e.clientX, left: tabsEl.scrollLeft }; });
    thumb.addEventListener("pointermove", e => { if (!drag) return; const sw = tabsEl.scrollWidth, cw = tabsEl.clientWidth, tw = track.clientWidth, w = thumb.offsetWidth; tabsEl.scrollLeft = drag.left + (e.clientX - drag.x) * (sw - cw) / Math.max(1, tw - w); });
    const end = () => { drag = null; thumb.classList.remove("dragging"); };
    thumb.addEventListener("pointerup", end); thumb.addEventListener("pointercancel", end);
    track.addEventListener("pointerdown", e => { if (e.target === thumb) return; const r = thumb.getBoundingClientRect(); tabsEl.scrollBy({ left: (e.clientX < r.left ? -1 : 1) * tabsEl.clientWidth * 0.8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
    tabsEl.addEventListener("wheel", e => { if (tabsEl.scrollWidth <= tabsEl.clientWidth + 1) return; if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabsEl.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    sync(); setTimeout(sync, 300);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
  })();
}

// =====================================================================
// 스킬 가이드 (S3). 본문은 tools/build.mjs가 정적 HTML로 만들고, 여기서는 상단 바·툴팁·언어만 붙인다
// =====================================================================
function guidePage() {
  const s = BYID[CFG.spec], G = window.GUIDE;
  setClassColor(s.cls);
  const hero = CFG.hero;
  // 영어 화면: 빌드 때 넣어 둔 영문 본문(<template id="gbody-en">)으로 바꾼다
  if (UI === "en") { const t = document.getElementById("gbody-en"); if (t) document.getElementById("gbody").innerHTML = t.innerHTML; }
  const visiting = ls.get("wg:spec") !== s.id;
  if (!visiting) ls.set("wg:hero:" + s.id, hero);
  document.getElementById("top").innerHTML = topbar(s, "guide", hero);
  bindTopbar(s);
  document.querySelectorAll("[data-hero-go]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); location.replace(a.href); }));
  const KO_ALL = (() => { const o = {}; for (const id in G.en) { if (G.ko[id]) o[G.en[id].n] = G.ko[id].n; } return Object.assign(o, G.koExtra); })();
  const koText = makeKo(KO_ALL);
  document.querySelectorAll(".skill-card[data-sid]").forEach(c => { c.tabIndex = 0; c.setAttribute("role", "button"); });
  showTip = card => { const id = card.dataset.sid, e2 = G.en[id]; if (!e2) return; tipFor = card; tipEl.innerHTML = spellTipHtml(id, e2, G.ko[id]); placeTip(card); };
  bindTips(".skill-card[data-sid]");
  const koOrig = new Map();
  const w = document.createTreeWalker(document.getElementById("gbody"), NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const p = n.parentElement; if (!p.closest("script,style,#sptip,.kname,.langseg,.lnav")) if (/[A-Za-z]/.test(n.data)) koOrig.set(n, n.data); }
  function applyBodyLang() {
    const ko = lang === "ko";
    koOrig.forEach((en, n) => {
      const card = n.parentElement.classList.contains("name") && n.parentElement.closest(".skill-card[data-sid]");
      const k = card && G.ko[card.dataset.sid];
      n.data = ko ? ((k && n === n.parentElement.firstChild && en.trim() === G.en[card.dataset.sid].n) ? k.n : koText(en)) : en;
    });
    document.querySelectorAll(".skill-card").forEach(c => {
      const nm = c.querySelector(".info .name"), el = c.querySelector(".kname"); if (!nm || !el) return;
      const t = nm.firstChild, en = koOrig.get(t);
      el.textContent = (ko && en && t.data !== en) ? en : "";
    });
    document.querySelector(".lnav .n").textContent = specName(s);
    document.querySelector(".lnav .h").textContent = "· " + heroName(heroOf(s, hero));
    whLinks();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("#tiplang button"); if (!b) return;
    lang = b.dataset.l; ls.set("wg:lang", lang);
    document.querySelectorAll("#tiplang button").forEach(x => x.setAttribute("aria-pressed", x.dataset.l === lang));
    applyBodyLang(); if (tipFor) showTip(tipFor);
  });
  applyBodyLang();
  document.querySelectorAll(".bcode").forEach(i => i.addEventListener("focus", () => i.select()));
  document.querySelectorAll(".bcopy").forEach(b => b.addEventListener("click", async () => {
    const inp = b.parentElement.querySelector(".bcode"); let ok = false;
    try { await navigator.clipboard.writeText(inp.value); ok = true; } catch (e) {}
    if (!ok) { inp.focus(); inp.select(); try { ok = document.execCommand("copy"); } catch (e) {} }
    b.textContent = ok ? "복사됨" : "직접 복사"; b.classList.toggle("done", ok);
    setTimeout(() => { b.textContent = "복사"; b.classList.remove("done"); }, 1600);
  }));
  const pr = document.getElementById("print"); if (pr) pr.onclick = () => print();
}


// =====================================================================
// 영웅 특성 비교 (S4): 두 영웅을 나란히. 쐐기 상위 50명 사용 수, Wowhead 추천, 운영 요점, 던전 카드 포인트
// =====================================================================
async function comparePage() {
  const s = BYID[CFG.spec];
  if (!s || s.status !== "ready") { location.replace(sheetUrl(CFG.spec || "")); return; }
  setClassColor(s.cls);
  const base = s.id.replace("/", "-");
  const [spec, guide, names] = await Promise.all([J(`data/spec/${base}.json`), J(`data/spec/${base}.guide.json`), J("data/core/names.ko.json")]);
  const cur = savedHero(s) || defaultHero(s);
  const H = s.heroes;
  const KO_ALL = (() => { const o = {}; for (const id in spec.spells) { const k = spec.spellsKo[id]; if (k && k.n) o[spec.spells[id].n] = k.n; } return Object.assign(o, names, spec.names); })();
  const tokens = str => str.replace(/:\s*\{busters\}/g, " (탱버 목록은 던전 탭의 영웅 카드)").replace(/\{busters\}/g, "던전 탭 영웅 카드의 탱버").replace(/\{([^{}]+)\}/g, (m, n) => `<span class="ab">${n}</span>`);
  const stars = slug => { const b = (guide.heroes[slug] || { sections: [] }).sections.find(x => x.id === "builds"); if (!b) return []; return b.html.split("build-row").slice(1).filter(r => /class="star"/.test(r.split("bcode")[0])).map(r => ((r.match(/bname">([^<]*)/) || [])[1] || "").trim()); };
  const ops = slug => (spec.general.bosses.find(b => b.hero === slug) || { i: [] }).i;
  const cards = slug => (spec.heroCards[slug] || { items: [] }).items;
  const TAGS = { tb: "탱버", int: "차단", dodge: "회피", disp: "해제", pos: "위치", tip: "참고", aoe: "광역 피해", prio: "우선 처치", cc: "제어" };
  const li = ([t, x]) => `<li><span class="tag t-${t}">${TAGS[t] || t}</span><span>${x}</span></li>`;
  let T = M5();
  function render() {
    T = M5();
    const n = H.map(h => heroTop(s, h.slug));
    const col = (h, i) => {
      const c = n[i];
      const st = stars(h.slug);
      return `<div class="cmpcol${h.slug === cur ? " cur" : ""}">
        <h2>${esc(heroName(h))}${lang === "ko" ? `<small>${esc(h.en)}</small>` : `<small>${esc(h.ko)}</small>`}${h.slug === defaultHero(s) ? '<span class="badge rec">쐐기 추천</span>' : ""}</h2>
        <div class="cmpbox"><div class="lb">${SL()}쐐기 상위 ${STOP()}명${SX()} 사용</div>${c == null ? '<div class="muted">자료 없음</div>' : `<div class="big"><b>${c.pct}%</b> · ${c.c}명</div><div class="bar"><i style="width:${c.pct}%"></i></div>`}</div>
        <div class="cmpbox"><div class="lb">Wowhead 추천 ★</div>${st.length ? st.map(x => `<span class="schip">${esc(x)}</span>`).join(" ") : '<div class="muted">없음</div>'}</div>
        <div class="cmpbox"><div class="lb">운영 요점</div><ul class="items">${ops(h.slug).map(li).join("")}</ul></div>
        <div class="cmpbox"><div class="lb">던전 카드 포인트</div><ul class="items">${cards(h.slug).map(([t, x]) => li([t, tokens(x)])).join("")}</ul></div>
        <div class="cmpbtns"><a class="pill" href="${sheetUrl(s.id)}" data-pick="${h.slug}">이 특성으로 공략 보기</a> <a class="pill gray" href="${guideUrl(s.id, h.slug)}" data-pick="${h.slug}">스킬 보기</a></div>
      </div>`;
    };
    document.getElementById("cmpbody").innerHTML = `<div class="cmpgrid">${H.map(col).join("")}</div>
      ${heroComp(s)}<p class="note">${SL()}쐐기 상위 ${STOP()}명${SX()}: ${esc(T.src || "Raider.IO")} ${SL()}${esc(specName(s))} 쐐기 점수 순위 상위 ${STOP()}명${SX() ? SX() + " 캐릭터가" : "이"} 지금 켜 둔 특성 코드에서 영웅 특성을 읽어 센 수입니다(${esc(T.date || "")} 확인). 비율의 분모는 영웅 특성이 판별된 ${esc(String((SD(s).hero500 || {}).n || ""))}명입니다. <a href="${rankUrl("spec=" + s.id + SQ())}">순위표 ›</a> · <a href="https://raider.io/mythic-plus-character-rankings/season-mn-2/${SAMPLE === "kr" && hasKr() ? "kr" : "world"}/${s.cls.slug}/${s.slug}" target="_blank" rel="noopener">Raider.IO 원문 ↗</a> Wowhead 추천 ★는 이 전문화 스킬 탭의 특성 빌드 코드 표와 같습니다. 운영 요점과 던전 카드 포인트는 공략 공통 탭·영웅 카드와 같은 내용입니다.</p>`;
    const ko = lang === "ko"; const koText = makeKo(KO_ALL);
    document.querySelectorAll("#cmpbody .ab").forEach(el => { const k = tipNorm(el.textContent); const id = spec.tips[k]; if (id) { el.dataset.sid = id; el.classList.add("has-tip"); el.tabIndex = 0; el.setAttribute("role", "button"); } });
    if (ko) { const w = document.createTreeWalker(document.getElementById("cmpbody"), NodeFilter.SHOW_TEXT); const ns = []; let t; while ((t = w.nextNode())) if (/[A-Za-z]/.test(t.data) && !t.parentElement.closest("a.pill,.note a,small")) ns.push(t); ns.forEach(t => t.data = koText(t.data)); }
    whLinks();
  }
  app().innerHTML = topbar(s, "compare", cur) + `<div class="wrap"><section class="s1-hero cmphero"><h1>영웅 특성 비교</h1><p>${esc(specName(s))} · 쐐기 기준</p>${hasKr() ? `<div class="langrow"><span class="tlabel">표본</span>${sampleSeg()}</div>` : ""}</section><div id="cmpbody"></div></div>`;
  bindTopbar(s);
  showTip = el => { const id = el.dataset.sid; const e2 = spec.spells[id]; if (!e2) return; tipFor = el; tipEl.innerHTML = spellTipHtml(id, e2, spec.spellsKo[id]); placeTip(el); };
  bindTips("#cmpbody .ab[data-sid]");
  reSample = () => { document.querySelectorAll("[data-smp]").forEach(x => x.setAttribute("aria-pressed", x.dataset.smp === SAMPLE)); render(); };
  document.addEventListener("click", e => {
    const b = e.target.closest("#tiplang button"); if (b) { lang = b.dataset.l; ls.set("wg:lang", lang); document.querySelectorAll("#tiplang button").forEach(x => x.setAttribute("aria-pressed", x.dataset.l === lang)); render(); return; }
    const a = e.target.closest("a[data-pick]"); if (a && ls.get("wg:spec") === s.id) ls.set("wg:hero:" + s.id, a.dataset.pick);
  });
  render();
}

// =====================================================================
// 레이드 공략 (/<직업>/<전문화>/raid/): 공용 층 data/raid/core.json + 역할 층(core.role) + 전문화 층 data/raid/spec/<id>.json(있으면)
// 쐐기 공략(sheetPage)과 같은 부품(태그·툴팁·한글 전환·상세 공략)을 쓰되 난이도(일반·영웅·신화) 전환이 있다.
// 문장 난이도: brief 항목은 옵션 {d:"hm"}, 상세 줄은 머리 "@hm " 접두사. 없으면 모든 난이도.
// =====================================================================
const DIFF = [["n", "일반"], ["h", "영웅"], ["m", "신화"]];
// 보스 요약(전투 유형·블러드·배정): 영어 화면은 영문 meta, 한국어 화면은 metaKo
const MK = t => UI === "en" && t.meta ? t.meta : t.metaKo;
const RAID_TAGS = { soak: "분담", swap: "교대", cd: "생존기" };
// 레이드 묶음: 2시즌(이번 시즌, 상위 공격대 조합·전문화 활용 줄 있음) · 지난 시즌(공통 공략만). 주소 ?set=, 저장값 wg:rset, 또는 #보스로 고른다
const RAID_SETS = [
  { id: "s2", ko: "2시즌 (이번 시즌)", file: "data/raid/core.json", comp: true },
  { id: "s1", ko: "1시즌", file: "data/raid/s1.json", comp: false },
];
async function raidPage() {
  const s = BYID[CFG.spec];
  if (!s) { location.replace(BASE + "?pick"); return; }
  setClassColor(s.cls);
  const q0 = new URLSearchParams(location.search), h00 = location.hash.slice(1);
  let set = RAID_SETS.find(x => x.id === (q0.get("set") || ls.get("wg:rset"))) || RAID_SETS[0];
  let core = await J(set.file).catch(() => null);
  if (!core) { set = RAID_SETS[0]; core = await J(set.file); }
  // #보스가 다른 묶음에 있으면 그 묶음으로
  if (h00 && h00 !== "overview" && !core.tabs.some(t => t.id === h00) && !q0.get("set")) for (const o of RAID_SETS) { if (o === set) continue; const c2 = await J(o.file).catch(() => null); if (c2 && c2.tabs.some(t => t.id === h00)) { set = o; core = c2; break; } }
  const [role, mspec, rspec, guide, comp0] = await Promise.all([
    J(`data/role/${s.role}.json`),
    s.status === "ready" ? J(`data/spec/${s.id.replace("/", "-")}.json`).catch(() => null) : Promise.resolve(null),
    J(`data/raid/spec/${s.id.replace("/", "-")}.json`).catch(() => null),
    s.status === "ready" ? J(`data/spec/${s.id.replace("/", "-")}.guide.json`).catch(() => null) : Promise.resolve(null),
    set.comp ? J("data/raid/comp.json").catch(() => null) : Promise.resolve(null),
  ]);
  const comp = set.comp ? comp0 : null;
  const RAIDS = Object.fromEntries((core.raids || []).map(r => [r.id, r]));
  const raidName = id => { const r = RAIDS[id]; return r ? (lang === "ko" && r.ko ? r.ko : r.name) : id; };
  const inRaid = t => core.tabs.filter(x => x.raid === t.raid);
  const idxInRaid = t => inRaid(t).indexOf(t) + 1;
  const isLair = t => t.raid === "the-tidebound-grotto";
  const bossSub = t => set.id === "s2" ? (isLair(t) ? "소굴 보스" : `${t.order}번째 보스`) : (inRaid(t).length === 1 ? `${raidName(t.raid)} · 1보스 레이드` : `${raidName(t.raid)} ${idxInRaid(t)}번째 보스`);
  const bossSmall = t => set.id === "s2" ? (isLair(t) ? "Lair" : "Boss " + t.order) : `${esc(RAIDS[t.raid] ? RAIDS[t.raid].name : t.raid)}${inRaid(t).length > 1 ? " · Boss " + idxInRaid(t) : ""}`;
  const setSeg = `<div class="seg" id="rset" role="group" aria-label="레이드">${RAID_SETS.map(o => `<button type="button" data-set="${o.id}" aria-pressed="${o === set}">${o.ko}</button>`).join("")}</div>`;
  const TAGS = { ...role.tags, ...RAID_TAGS };
  const TAGK = Object.fromEntries(Object.entries(TAGS).map(([k, v]) => [v, k]));
  const A = n => `<span class="ab">${n}</span>`;
  const MOBS = core.npcs;
  const SPELLS = { ...core.spells, ...(mspec ? mspec.spells : {}), ...(rspec ? rspec.spells || {} : {}) };
  const SPELLS_KO = { ...core.spellsKo, ...(mspec ? mspec.spellsKo : {}), ...(rspec ? rspec.spellsKo || {} : {}) };
  const specTips = { ...(mspec ? mspec.tips : {}), ...(rspec ? rspec.tips || {} : {}) };
  const specTipIds = new Set(Object.values(specTips));
  const coreIds = new Set(Object.keys(core.spells));
  const KO_ALL = (() => { const o = {}; for (const id in SPELLS) { if (!coreIds.has(id) && !specTipIds.has(id)) continue; const k = SPELLS_KO[id]; if (k && k.n) o[SPELLS[id].n] = k.n; } return Object.assign(o, core.names, mspec ? mspec.names : {}, rspec ? rspec.names || {} : {}); })();
  const koText = makeKo(KO_ALL);
  const NPC_RE = new RegExp("(?<![A-Za-z'’])(" + [...new Set([...Object.keys(KO_ALL), ...Object.keys(MOBS)])].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![A-Za-z'’])", "g");
  const tokens = str => str.replace(/\{([^{}]+)\}/g, (m, n) => A(n));

  const saved = ls.get("wg:spec");
  const visiting = saved !== s.id;
  const save = (k, v) => { if (!visiting || k === "wg:raiddiff" || k === "wg:rtab") ls.set(k, v); };
  let hero = savedHero(s) || defaultHero(s);
  let diff = ls.get("wg:raiddiff"); if (!["n", "h", "m"].includes(diff)) diff = "h";
  const qd = new URLSearchParams(location.search).get("diff"); if (["n", "h", "m"].includes(qd)) diff = qd;

  const T = core.tabs;
  const overview = { id: "overview", name: "개요" };
  const D = [overview, ...T];
  const RDETAIL = core.role[s.role] || {}, SDETAIL = rspec ? rspec.detail || {} : {}, SBRIEF = rspec ? rspec.brief || {} : {};
  // 태그: 데이터에 있는 것만(역할 순서 뒤에 레이드 태그)
  const present = new Set();
  const tagRe = new RegExp(`^(?:@([nhm]+) )?\\[(${Object.values(TAGS).join("|")})\\]\\s*`);
  const scan = l => { const m = String(l).match(tagRe); present.add(m ? TAGK[m[2]] : "tip"); };
  T.forEach(t => { t.brief.forEach(([k]) => present.add(k)); const x = (core.detail[t.id] || {})[t.name] || {}; (x.phases || []).forEach(p => p.points.forEach(scan)); (x.group || []).forEach(scan); ((RDETAIL[t.id] || {})[t.name] || []).forEach(scan); ((SDETAIL[t.id] || {})[t.name] || []).forEach(scan); ((SBRIEF[t.id] || {})[t.name] || []).forEach(([k]) => present.add(k)); });
  const ORDER = [...role.order, "soak", "swap", "cd"].filter(t => present.has(t));
  let off = []; try { off = JSON.parse(ls.get("wg:rtags:" + s.role) || "[]"); } catch (e) {}
  if (!Array.isArray(off)) off = [];
  let on = new Set(ORDER.filter(t => !off.includes(t))); if (!on.size) on = new Set(ORDER);

  let active = T[0].id;
  const st = ls.get("wg:rtab"); if (st && D.some(d => d.id === st)) active = st;
  const h0 = location.hash.slice(1); if (D.some(d => d.id === h0)) active = h0;
  let openState = {}; try { openState = JSON.parse(ls.get("wg:ropen") || "{}") || {}; } catch (e) { openState = {}; }

  const inDiff = d => !d || d.includes(diff);
  const dBadge = d => !d || d === "nhm" ? "" : `<span class="dbadge d-${d.includes("n") ? "n" : d.includes("h") ? "h" : "m"}">${d === "m" ? "신화" : d === "hm" ? "영웅+" : d === "h" ? "영웅" : d === "nh" ? "일반·영웅" : "일반"}</span>`;
  const diffSeg = `<div class="seg" id="rdiff" role="group" aria-label="난이도">${DIFF.map(([k, t]) => `<button type="button" data-d="${k}" aria-pressed="${k === diff}">${t}</button>`).join("")}</div>`;

  app().innerHTML = topbar(s, "raid", hero) + `<div class="wrap">
    <p class="lede" id="lede"></p>
    <nav class="tabbar" aria-label="보스"><div class="tabs" id="tabs" role="tablist"></div></nav>
    <div class="ctrl"><div class="herorow"><span class="herogrp"><span class="tlabel">레이드</span>${setSeg}</span><span class="herogrp"><span class="tlabel">난이도</span>${diffSeg}</span></div><div class="filters" id="filters"></div></div>
    <main id="main" class="raid"></main>
    <footer id="foot"></footer></div>`;
  bindTopbar(s);
  const tabsEl = document.getElementById("tabs"), mainEl = document.getElementById("main"), filtEl = document.getElementById("filters");
  const roleKo = ROSTER.roles[s.role].ko;
  document.getElementById("foot").innerHTML = `<div>난이도: 기술마다 게임 던전 도감의 적용 난이도를 따릅니다. <span class="dbadge d-h">영웅+</span>는 영웅·신화, <span class="dbadge d-m">신화</span>는 신화에서만 나오는 내용입니다. 일반·영웅은 인원(10~30명)에 따라 체력과 기믹 대상 수만 달라지고, 신화는 20명 고정입니다.</div>
    ${rspec && rspec.note ? `<div>${esc(rspec.note)}</div>` : ""}
    <div>한글 모드의 기술 이름은 Wowhead 한국어 데이터, NPC 이름은 Wowhead 한국어 NPC 데이터를 따릅니다.</div>
    <div>출처: ${core.sources.map(x => `<a href="${esc(srcU(x.u))}" target="_blank" rel="noopener">${esc(x.t)}</a>`).join(" · ")}</div>
    <div><a href="${sheetUrl(s.id)}">쐐기 공략</a> · <a href="${BASE}specs/">전체 전문화</a> · <a href="${BASE}">첫 화면</a></div>`;

  const escH = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // 레이드: 이름 속 연결어에 by·for·with·from 추가, 끝 느낌표(Pop!) 포함
  const AB_RE = /([A-Z](?:[A-Za-z'’\-]+|(?=\s[A-Z]))(?:\s(?:(?:of|the|and|&amp;|on|in|to|a|by|for|with|from)\s)*[A-Z][A-Za-z'’\-]*)*!?)/g;
  const abIsName = m => { const k = tipNorm(m.replace(/&amp;/g, "&")); return Object.values(core.tips).some(t => t[k]) || !!specTips[k] || KO_ALL[m.replace(/&amp;/g, "&")] != null || !!MOBS[m.replace(/&amp;/g, "&")]; };
  const abWrap = x => escH(x).replace(AB_RE, m => abSplit(m, abIsName));
  const parse = l => { const m = String(l).match(tagRe); return m ? { d: m[1] || null, t: TAGK[m[2]], x: String(l).slice(m[0].length) } : { d: null, t: "tip", x: String(l) }; };
  const lineLi = (t, body, d) => `<li><span class="tag t-${t}">${TAGS[t]}</span><span>${dBadge(d)}${body}</span></li>`;
  const deepItems = arr => (arr || []).map(parse).filter(o => on.has(o.t) && inDiff(o.d)).map(o => lineLi(o.t, abWrap(o.x), o.d)).join("");
  function deepHtml(t) {
    const x = (core.detail[t.id] || {})[t.name]; if (!x) return "";
    const key = `rdeep-${t.id}`; const open = openState[key] !== false;
    const blk = (title, arr, cls) => { const lis = deepItems(arr); return lis ? `<div class="dblk${cls ? " " + cls : ""}"><h4>${title}</h4><ul class="items">${lis}</ul></div>` : ""; };
    const phases = (x.phases || []).map(p => blk(abWrap(p.title), p.points)).join("");
    const body = (x.overview ? `<p class="dover">${abWrap(x.overview)}</p>` : "") + phases + blk(`${roleKo} 할 일`, (RDETAIL[t.id] || {})[t.name], "role") + blk(`${s.koFull} 활용`, (SDETAIL[t.id] || {})[t.name], "spec") + blk("공대 공통", x.group);
    return `<details class="deep fold" data-k="${key}"${open ? " open" : ""}><summary><span>상세 공략</span><span class="chev" aria-hidden="true">▾</span></summary><div class="deepbody">${body || '<p class="empty">선택한 태그·난이도 항목 없음</p>'}</div></details>`;
  }
  const tipMaps = id => [core.tips[id] || {}, specTips];
  function decorateTips(id) {
    mainEl.querySelectorAll(".ab").forEach(el => {
      if (el.dataset.sid) return;
      const k = tipNorm(el.dataset.tn || el.textContent); let sid = null;
      const inShared = !el.closest(".dblk.spec") && !el.closest(".sbrief");
      for (const m of inShared ? [core.tips[id] || {}] : tipMaps(id)) { if (m[k]) { sid = m[k]; break; } }
      if (!sid && id === "overview") for (const t of T) { const m = core.tips[t.id] || {}; if (m[k]) { sid = m[k]; break; } }
      if (!sid) return;
      el.dataset.sid = sid; el.classList.add("has-tip"); el.tabIndex = 0; el.setAttribute("role", "button");
    });
  }
  function npcMark(el, name) { el.dataset.npc = name; el.classList.add("has-tip", "npc-tip"); el.tabIndex = 0; el.setAttribute("role", "button"); }
  function npcDecorate(root) {
    root.querySelectorAll(".ab:not([data-sid]), .boss h3 > span.bn").forEach(el => { const n = el.textContent.trim(); if (MOBS[n]) npcMark(el, n); });
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let n;
    while ((n = w.nextNode())) if (!n.parentElement.closest(".ab,.mob,[data-npc],a,button,.tag,.dbadge")) nodes.push(n);
    nodes.forEach(t => {
      const str = t.data; let m, i = 0, frag = null; NPC_RE.lastIndex = 0;
      while ((m = NPC_RE.exec(str))) { if (!MOBS[m[1]]) continue; frag = frag || document.createDocumentFragment(); frag.append(str.slice(i, m.index)); const sp = document.createElement("span"); sp.className = "npc"; sp.textContent = m[1]; npcMark(sp, m[1]); frag.append(sp); i = m.index + m[1].length; }
      if (frag) { frag.append(str.slice(i)); t.replaceWith(frag); }
    });
  }
  function koApply(root) {
    root.querySelectorAll(".ab,.npc,.bn").forEach(el => {
      const e2 = el.textContent, sk = el.dataset.sid && SPELLS_KO[el.dataset.sid];
      const k = (sk && SPELLS[el.dataset.sid] && tipNorm(e2) === tipNorm(SPELLS[el.dataset.sid].n) && sk.n) || KO_ALL[e2] || koText(e2);
      if (k === e2) return;
      el.textContent = k;
      const nx = el.nextSibling; if (nx && nx.nodeType === 3) { const p = josaFix(k, nx.data); if (p) nx.data = p[1] + nx.data.slice(p[0]); }
    });
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let n;
    while ((n = w.nextNode())) if (!n.parentElement.closest(".ab,.npc,.bn")) nodes.push(n);
    nodes.forEach(n => { const t = koText(n.data); if (t !== n.data) n.data = t; });
  }
  function showNpc(el) {
    const name = el.dataset.npc, [id, disp] = MOBS[name] || [], k = KO_ALL[name], useKo = lang === "ko" && k;
    tipFor = el;
    tipEl.innerHTML = `${disp ? `<img class="tt-model" src="https://wow.zamimg.com/modelviewer/live/webthumbs/npc/${disp % 256}/${disp}.png" alt="">` : ""}<div class="tt-name">${esc(useKo ? k : name)}${useKo ? `<span class="tt-orig">${esc(name)}</span>` : ""}</div><a class="tt-link" href="${wh("npc=" + id)}" target="_blank" rel="noopener">${lang === "ko" ? "Wowhead에서 보기" : "View on Wowhead"} ↗</a>`;
  }
  showTip = el => {
    if (el.dataset.npc) { showNpc(el); return placeTip(el); }
    const e2 = SPELLS[el.dataset.sid]; if (!e2) return;
    tipFor = el; tipEl.innerHTML = spellTipHtml(el.dataset.sid, e2, SPELLS_KO[el.dataset.sid]); placeTip(el);
  };
  bindTips(".has-tip");

  const tabName = d => d.id === "overview" ? "개요" : (lang === "ko" ? (d.ko || KO_ALL[d.name] || d.name) : d.name);
  function applyChrome() {
    [...tabsEl.children].forEach((b, i) => b.textContent = (D[i].order ? D[i].order + ". " : "") + tabName(D[i]));
    const dk = DIFF.find(x => x[0] === diff)[1];
    const setDesc = set.id === "s2" ? `${lang === "ko" ? "맹독 심연" : "The Venomous Abyss"} 8보스 + ${lang === "ko" ? "소굴" : "Tidebound Grotto"} 1보스` : `${set.ko} 레이드 ${(core.raids || []).length}개 · ${T.length}보스`;
    document.getElementById("lede").textContent = `${setDesc} · ${roleKo} 레이드 공략 · ${dk} 난이도 · 기술·NPC 이름은 ${lang === "ko" ? "한글" : "영문"} 클라이언트 기준`;
    document.title = `${specName(s)} · 레이드 공략`;
    whLinks();
  }
  document.querySelectorAll("#tiplang button").forEach(b => b.onclick = () => { lang = b.dataset.l; ls.set("wg:lang", lang); document.querySelectorAll("#tiplang button").forEach(x => x.setAttribute("aria-pressed", x.dataset.l === lang)); hideTip(); render(); applyChrome(); });
  document.querySelectorAll("#rdiff button").forEach(b => b.onclick = () => { diff = b.dataset.d; save("wg:raiddiff", diff); document.querySelectorAll("#rdiff button").forEach(x => x.setAttribute("aria-pressed", x.dataset.d === diff)); render(); applyChrome(); });
  D.forEach(d => {
    const b = document.createElement("button"); b.className = "tab"; b.id = "tab-" + d.id; b.type = "button"; b.setAttribute("role", "tab");
    b.onclick = () => { active = d.id; save("wg:rtab", d.id); history.replaceState(history.state, "", location.pathname + location.search + "#" + d.id); render(); };
    tabsEl.appendChild(b);
  });
  ORDER.forEach(k => {
    const b = document.createElement("button"); b.className = "filt t-" + k; b.id = "f-" + k; b.type = "button"; b.textContent = TAGS[k]; b.setAttribute("aria-pressed", "true");
    b.onclick = () => { on.has(k) ? on.delete(k) : on.add(k); if (!on.size) ORDER.forEach(x => on.add(x)); ls.set("wg:rtags:" + s.role, JSON.stringify(ORDER.filter(x => !on.has(x)))); render(); };
    filtEl.appendChild(b);
  });
  document.addEventListener("toggle", e => { const el = e.target; if (!el.matches || !el.matches("details.fold")) return; openState[el.dataset.k] = el.open; ls.set("wg:ropen", JSON.stringify(openState)); }, true);

  // 레이드 빌드: 스킬 탭 빌드 표(Wowhead)에서 이름이 "레이드"로 시작하는 행. ★ = Wowhead 추천
  const buildName = n => n.replace("(Virtue)", "(Beacon of Virtue)").replace("(Faith)", "(Beacon of Faith)").replace("Single Target/Cleave", "단일·소수 광역").replace("Single Target", "단일").replace("(Advanced)", "(심화)");
  // 레이드 영웅 특성(상위 공격대 처치 명단) vs 쐐기 상위 500명
  const raidHeroHtml = () => {
    const ag = comp && comp.samples && comp.bosses ? raidAgg(comp) : null; const rh = ag && raidHero(ag, s); if (!rh) return "";
    const sm = SNAME[RSMP(comp)], mp = SD(s).hero500;
    const bar = (cnt, n) => `<span class="hbar">${s.heroes.map((h, i) => `<i class="h${i}" style="width:${n ? cnt[h.slug] / n * 100 : 0}%"></i>`).join("")}</span>`;
    const row = (t, cnt, n, note) => `<tr><th>${t}</th><td>${bar(cnt, n)}</td>${s.heroes.map(h => `<td class="num"><b>${n ? Math.round(cnt[h.slug] / n * 100) : 0}%</b></td>`).join("")}<td class="muted">${note}</td></tr>`;
    return `<section class="boss"><h3><span>영웅 특성: 레이드 vs 쐐기</span><small>${esc(sm)}</small></h3><div class="smprow">${sampleSeg()}</div>
      <div class="tbl"><table class="rhero"><thead><tr><th></th><th></th>${s.heroes.map((h, i) => `<th class="num"><span class="hdot h${i}"></span>${esc(heroName(h))}</th>`).join("")}<th></th></tr></thead><tbody>
      ${row("레이드", rh.counts, rh.n, `상위 공격대 처치 명단 연인원 ${rh.n}명(보스 ${ag.bosses}개)`)}
      ${mp && mp.n ? row("쐐기", mp.counts, mp.n, `${SL()}쐐기 상위 ${STOP()}명 중 ${mp.n}명`) : ""}</tbody></table></div>
      <p class="note">레이드는 이 전문화로 신화 보스를 처음 잡을 때 켜 둔 특성 코드에서 영웅 트리를 읽었습니다(쐐기 순위와 같은 방법). 전체 전문화 비교는 <a href="${raidHubUrl(SQ().slice(1), "#hero")}">레이드 순위</a>에 있습니다.</p></section>`;
  };
  const raidBuilds = () => {
    if (!guide) return "";
    const rows = []; const starH = new Set();
    s.heroes.forEach(h => { const b = ((guide.heroes[h.slug] || {}).sections || []).find(x => x.id === "builds"); if (!b) return;
      b.html.split('<div class="build-row">').slice(1).forEach(r => { const n = ((r.match(/bname">([^<]*)/) || [])[1] || "").trim(); if (!/^레이드/.test(n)) return; const code = (r.match(/class="bcode" readonly value="([^"]+)"/) || [])[1]; if (!code) return; const star = /class="star"/.test(r.split("bcode")[0]); if (star) starH.add(h.slug); rows.push({ h, n: buildName(n), code, star }); }); });
    if (!rows.length) return "";
    const rec = [...starH].map(x => heroOf(s, x)).filter(Boolean);
    return `<section class="boss"><h3><span>레이드 특성 빌드</span><small>Builds</small></h3>
      ${rec.length ? `<p class="rrec">레이드 추천 영웅 특성: <b>${rec.map(h => esc(heroName(h))).join(", ")}</b> <span class="muted">(Wowhead ★)</span></p>` : ""}
      ${rows.map((r, i) => `<div class="build-row"><div class="bname">${esc(heroName(r.h))} · ${esc(r.n)}${r.star ? '<span class="star" title="Wowhead 추천">★</span>' : ""}</div><input class="bcode" readonly value="${r.code}" aria-label="특성 코드"><button class="bcopy" type="button" data-c="${i}">복사</button><a class="blink" href="https://www.wowhead.com/talent-calc/blizzard/${r.code}" target="_blank" rel="noopener">Wowhead ↗</a></div>`).join("")}
      <p class="note">게임에서 특성 창(N) → 빌드 목록 → 가져오기 → 붙여넣기. 코드와 ★는 <a href="${guideUrl(s.id, hero)}#builds">스킬 탭 빌드 표</a>(Wowhead 기준)와 같습니다.</p></section>`;
  };
  document.addEventListener("click", e => { const b = e.target.closest(".bcopy[data-c]"); if (!b) return; const inp = b.previousElementSibling; const done = () => { b.textContent = "복사됨"; setTimeout(() => b.textContent = "복사", 1500); }; try { navigator.clipboard.writeText(inp.value).then(done, () => { inp.select(); }); } catch (err) { inp.select(); } });
  // 신화 상위 공격대 처치 조합(Raider.IO): 표본(세계·세계(중국 제외)·한국·중국)마다 이 보스를 처음 잡은 상위 공격대 N팀의 첫 처치 20명 구성
  const compOf = bossId => comp && (comp.samples ? (comp.samples[SAMPLE] || comp.samples.world || {})[bossId] : (comp.bosses || {})[bossId]);
  const SDESC = { world: "세계 순위", xcn: "세계 순위에서 중국 공격대를 뺀", kr: "한국 순위", cn: "중국 순위" };
  const compHtml = (bossId, title) => {
    if (!comp) return "";
    const c = compOf(bossId); const smp = comp.samples ? SAMPLE : "world"; const top = comp.top || 20;
    const head = `<section class="boss rcomp"><h3><span>${title}</span><small>${esc(SNAME[smp] || "세계")}</small></h3>${comp.samples ? `<div class="smprow">${sampleSeg()}</div>` : ""}`;
    if (!c || !c.kills) return head + `<p class="empty">${esc(SNAME[smp] || "")}에서 아직 이 보스를 신화로 잡은 공격대가 없습니다.</p></section>`;
    const L = Object.entries(c.specs).map(([id, v]) => ({ s: BYID[id], ...v })).filter(x => x.s).sort((x, y) => y.guilds - x.guilds || y.total - x.total);
    const mine = c.specs[s.id] || { guilds: 0, total: 0 };
    const rowOf = (x, i) => `<tr${x.s.id === s.id ? ' class="me"' : ""}><td class="num">${i + 1}</td><td>${icon(x.s, 18)} ${esc(specName(x.s))}</td><td><span class="sbar"><i style="width:${x.guilds / c.kills * 100}%"></i></span> ${x.guilds}/${c.kills}</td><td class="num">${(x.total / c.kills).toFixed(1)}</td></tr>`;
    const T12 = L.slice(0, 12), myIx = L.findIndex(x => x.s.id === s.id);
    return head + `<p class="rrec"><b>${esc(s.koFull)}</b>: ${esc(SNAME[smp])} 상위 ${c.kills}팀 중 <b>${mine.guilds}팀</b>이 데려감${mine.guilds ? ` (공격대당 평균 ${(mine.total / c.kills).toFixed(1)}명)` : ""}${myIx >= 0 ? ` · 채용 ${myIx + 1}위` : ""}</p>
      ${c.listed && c.listed > c.kills ? `<p class="comp sub">처치 순 앞쪽 ${c.listed}팀 중 처치 명단을 공개한 ${c.kills}팀 기준입니다(나머지는 명단 비공개).</p>` : c.kills < top ? `<p class="comp sub">${esc(SNAME[smp])}에서 이 보스를 신화로 잡은 공격대가 ${c.kills}팀뿐이라 ${c.kills}팀 기준입니다.</p>` : ""}
      <div class="tbl"><table><thead><tr><th class="num">#</th><th>전문화</th><th>데려간 공격대</th><th class="num">공격대당 평균</th></tr></thead><tbody>${T12.map(rowOf).join("")}${myIx >= 12 ? rowOf(L[myIx], myIx) : ""}</tbody></table></div>
      <p class="note">${esc(SDESC[smp] || "")} 신화 처치 순으로 앞쪽 ${c.kills}팀의 첫 처치 20명 구성(${esc(comp.src)}, ${esc(comp.date)} 확인). 공격대마다 처음 처치한 한 번의 구성 기준이라 다른 난이도·공격대와는 다를 수 있습니다.</p></section>`;
  };
  function overviewHtml() {
    const rows = T.map(t => { const x = (core.detail[t.id] || {})[t.name] || {}; const all = [...t.brief.map(b => (b[2] || {}).d), ...(x.phases || []).flatMap(p => p.points.map(l => parse(l).d))]; const nm = all.filter(d => d === "m").length, nh = all.filter(d => d === "hm" || d === "h").length;
      return `<tr><td>${t.order}</td><td><a href="#${t.id}" data-go="${t.id}"><span class="bn">${esc(t.name)}</span></a>${isLair(t) ? ' <span class="dbadge d-n">소굴</span>' : set.id !== "s2" ? ` <span class="dbadge d-n">${esc(raidName(t.raid))}</span>` : ""}</td><td>${esc(MK(t).fight || t.meta.fight || "")}</td><td>${esc(MK(t).lust || t.meta.lust || "")}</td><td>${esc(MK(t).assign || t.meta.assign || "")}</td><td class="num">${nh}</td><td class="num">${nm}</td></tr>`; }).join("");
    const head = set.id === "s2" ? `<h2 class="dname">${lang === "ko" ? "맹독 심연" : "The Venomous Abyss"}</h2><p class="dsub">한밤 2시즌 레이드 8보스와 소굴 보스 1개. 보스를 누르면 그 보스 탭으로 갑니다.</p>`
      : `<h2 class="dname">한밤 ${set.ko} 레이드</h2><p class="dsub">${(core.raids || []).map(r => `${esc(raidName(r.id))} ${core.tabs.filter(t => t.raid === r.id).length}보스`).join(" · ")}. 지난 시즌 레이드라 상위 공격대 조합은 없고, 공통 공략(요약·단계별 상세·역할별 할 일)${T.some(t => SDETAIL[t.id]) ? "과 전문화 활용 줄이 있습니다" : "만 있습니다"}. 보스를 누르면 그 보스 탭으로 갑니다.</p>`;
    return `<div>${head}</div>
      <section class="boss"><h3><span>보스 한눈에</span><small>Overview</small></h3><div class="tbl"><table class="rovt"><thead><tr><th>#</th><th>보스</th><th>전투 유형</th><th>블러드</th><th>필요한 배정</th><th class="num">영웅+ 줄</th><th class="num">신화 줄</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">전투 유형·블러드·배정은 Wowhead 보스 가이드의 요약입니다. 영웅+·신화 줄은 이 사이트 공략에서 그 난이도부터 나오는 항목 수입니다.</p></section>
      ${raidHeroHtml()}
      ${raidBuilds()}
      ${compHtml("ulatek", "최종 보스 상위 공격대 조합")}
      <section class="boss"><h3><span>난이도</span><small>Difficulty</small></h3><ul class="items">
        ${lineLi("tip", "일반·영웅은 인원(10~30명)에 맞춰 보스 체력과 기믹 대상 수가 바뀌고, 기믹 종류는 같습니다.")}
        ${lineLi("tip", "영웅부터 붙는 기술이 있고(<span class=\"dbadge d-h\">영웅+</span>), 신화는 20명 고정에 아래 난이도에 없는 기술이 더해집니다(<span class=\"dbadge d-m\">신화</span>).")}
        ${lineLi("tip", "위쪽 난이도 전환으로 고른 난이도까지의 내용만 보입니다. 고른 난이도는 이 기기에 저장됩니다.")}</ul></section>`;
  }
  function render() {
    [...tabsEl.children].forEach((b, i) => b.setAttribute("aria-selected", D[i].id === active));
    [...filtEl.children].forEach(b => b.setAttribute("aria-pressed", on.has(b.id.slice(2))));
    if (active === "overview") { mainEl.innerHTML = overviewHtml(); }
    else {
      const t = T.find(x => x.id === active);
      const extra = (SBRIEF[t.id] || {})[t.name] || [];
      const items = [...t.brief, ...extra].filter(([k, , o]) => on.has(k) && inDiff((o || {}).d));
      const lis = items.map(([k, x, o]) => lineLi(k, tokens(x), (o || {}).d)).join("");
      const meta = [MK(t).fight && `전투: ${MK(t).fight}`, MK(t).lust && `블러드: ${MK(t).lust}`, MK(t).assign && `배정: ${MK(t).assign}`].filter(Boolean).map(esc).join(" · ");
      mainEl.innerHTML = `<div><h2 class="dname"><span class="bn">${esc(t.name)}</span></h2><p class="dsub">${esc(bossSub(t))}${meta ? " · " + meta : ""}</p></div>
        <section class="boss"><h3><span class="bn">${esc(t.name)}</span><small>${bossSmall(t)}</small></h3>${lis ? `<ul class="items">${lis}</ul>` : `<p class="empty">선택한 태그·난이도 항목 없음</p>`}${deepHtml(t)}</section>${compHtml(t.id, "신화 상위 공격대 조합")}`;
    }
    decorateTips(active);
    npcDecorate(mainEl);
    if (lang === "ko") koApply(mainEl);
    whLinks(mainEl);
    mainEl.querySelectorAll("[data-go]").forEach(a => a.onclick = e => { e.preventDefault(); active = a.dataset.go; save("wg:rtab", active); history.replaceState(history.state, "", location.pathname + location.search + "#" + active); render(); scrollTo(0, 0); });
    const tb = document.getElementById("tab-" + active); tb && tb.scrollIntoView({ block: "nearest", inline: "center" });
  }
  reSample = () => { render(); };
  document.querySelectorAll("#rset button").forEach(b => b.onclick = () => { if (b.dataset.set === set.id) return; ls.set("wg:rset", b.dataset.set); location.href = raidUrl(s.id) + "?set=" + b.dataset.set; });
  if (q0.get("set")) ls.set("wg:rset", set.id);
  render(); applyChrome();
}

// =====================================================================
// 레이드 순위 (/raid/): 진행 현황 · 전문화 × 보스 채용 · 쐐기·레이드 영웅 특성 · 주간 초기화 (data/raid/comp.json)
// =====================================================================
async function raidHubPage() {
  const q = new URLSearchParams(location.search);
  const saved = BYID[ls.get("wg:spec")];
  let role = ["tank", "healer", "dps"].includes(q.get("role")) ? q.get("role") : "all";
  app().innerHTML = '<div class="wrap rank"><p class="muted">불러오는 중…</p></div>';
  const c = await raidComp();
  const pct = v => Math.round(v) + "%";
  const ordOf = b => b.raid === "the-tidebound-grotto" ? "소굴" : String(b.order);
  const heat = p => p == null ? "" : ` style="--h:${(p / 100).toFixed(2)}"`;
  const draw = () => {
    if (!c || !c.samples || !c.bosses) { app().innerHTML = '<div class="wrap rank"><p>레이드 순위 데이터를 불러오지 못했습니다.</p></div>'; return; }
    const smp = RSMP(c), sm = SNAME[smp], agg = raidAgg(c, smp), S = c.samples[smp], P = (c.progress || {})[smp] || {}, B = c.bosses;
    const inRole = s => role === "all" || s.role === role;
    const roleSeg = `<span class="seg" role="group" aria-label="역할">${[["all", "전체"], ["tank", ROLE_ICON.tank + " " + ROSTER.roles.tank.ko], ["healer", ROLE_ICON.healer + " " + ROSTER.roles.healer.ko], ["dps", ROLE_ICON.dps + " " + ROSTER.roles.dps.ko]].map(([k, t]) => `<button type="button" data-rrole="${k}" aria-pressed="${role === k}">${t}</button>`).join("")}</span>`;
    // 진행 현황
    const prog = `<section class="boss" id="progress"><h3><span>진행 현황</span><small>${esc(sm)} · 신화</small></h3><div class="tbl"><table class="rtab rprogt"><thead><tr><th>#</th><th>보스</th><th class="num">처치 공격대</th><th>${esc(sm)} 최초 처치</th><th class="num">조합 표본</th></tr></thead><tbody>${B.map(b => { const p = P[b.id] || {}, f = p.first, k = S[b.id] || {};
      return `<tr><td>${ordOf(b)}</td><td>${esc(bossName(b))}</td><td class="num"><b>${p.count == null ? "?" : p.count.toLocaleString()}</b></td><td>${f ? `${regFlag(f.region)}${esc(f.guild)} <span class="muted">${kstDate(f.at)}</span>` : "—"}</td><td class="num">${k.kills || 0}팀${k.listed > k.kills ? `<span class="rs">${k.listed}팀 중 명단 공개</span>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="note">처치 공격대: Raider.IO 신화 순위에서 그 보스를 잡은 공격대 수${smp === "xcn" ? "(세계 순위에서 중국 공격대를 뺌)" : ""}. 최초 처치 날짜는 한국 날짜. 조합 표본: 아래 채용 표에 쓴, 처치 순 앞쪽에서 처치 명단이 공개된 공격대 수(최대 ${c.top || 20}팀).</p></section>`;
    // 전문화 × 보스 채용
    const L = SPECS.filter(inRole).map(s => ({ s, o: agg.specs[s.id] || { rate: 0, guilds: 0, total: 0 } })).sort((x, y) => y.o.rate - x.o.rate || y.o.total - x.o.total);
    const specs = `<section class="boss" id="specs"><h3><span>전문화 채용</span><small>${esc(sm)} · 보스별</small></h3>
      <p class="rbleg">${B.map(b => `<span><b>${ordOf(b)}</b> ${esc(bossName(b))}</span>`).join("")}</p>
      <div class="tbl rheat-w"><table class="rheat"><thead><tr><th class="num">#</th><th class="sn">전문화</th><th class="num">채용률</th>${B.map(b => `<th class="num" title="${esc(bossName(b))}">${ordOf(b)}<span class="rs">${(S[b.id] || {}).kills || 0}팀</span></th>`).join("")}</tr></thead><tbody>
      ${L.map(({ s, o }, i) => `<tr${saved && saved.id === s.id ? ' class="me"' : ""}><td class="num">${i + 1}</td><td class="sn"><a href="${raidUrl(s.id)}">${icon(s, 18)} ${esc(specName(s))}</a></td><td class="num"><b>${pct(o.rate)}</b></td>${B.map(b => { const k = S[b.id]; if (!k || !k.kills) return '<td class="num muted">—</td>'; const v = k.specs[s.id]; const p = v ? v.guilds / k.kills * 100 : 0; return `<td class="num hc"${heat(p)} title="${esc(bossName(b))}: ${v ? v.guilds : 0}/${k.kills}팀, 공격대당 ${v ? (v.total / k.kills).toFixed(1) : 0}명">${Math.round(p)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="note">칸 숫자: 그 보스를 신화로 잡은 상위 공격대 중 이 전문화를 1명 이상 데려간 비율(%). 채용률: 보스 ${agg.bosses}개 처치 명단 ${agg.kills}개를 합친 비율. 칸에 마우스를 올리면 팀 수와 공격대당 인원이 보입니다. 공격대마다 첫 처치 한 번의 20명 기준입니다.</p></section>`;
    // 영웅 특성: 쐐기 vs 레이드
    const hbar = (s, cnt, n) => `<span class="hbar">${s.heroes.map((h, i) => `<i class="h${i}" style="width:${n ? cnt[h.slug] / n * 100 : 0}%"></i>`).join("")}</span>`;
    const htxt = (s, cnt, n) => s.heroes.map((h, i) => `<span class="ht"><span class="hdot h${i}"></span>${esc(heroName(h))} <b>${n ? Math.round(cnt[h.slug] / n * 100) : 0}%</b></span>`).join("");
    const topH = (s, cnt, n) => n ? s.heroes.slice().sort((x, y) => cnt[y.slug] - cnt[x.slug])[0].slug : null;
    const HR = SPECS.filter(inRole).map(s => { const rh = raidHero(agg, s), mp = SD(s).hero500; return { s, rh, mp: mp && mp.n ? mp : null }; }).filter(x => x.rh || x.mp);
    // 레이드 연인원이 적으면(10명 미만) 쐐기와 다르다고 하지 않는다
    const MINH = 10; const isDiff = x => x.rh && x.mp && x.rh.n >= MINH && topH(x.s, x.rh.counts, x.rh.n) !== topH(x.s, x.mp.counts, x.mp.n);
    const diff = HR.filter(isDiff);
    const hero = `<section class="boss" id="hero"><h3><span>영웅 특성: 쐐기 vs 레이드</span><small>${esc(sm)}</small></h3>
      ${diff.length ? `<p class="rrec">쐐기와 레이드에서 많이 쓰는 영웅 특성이 다른 전문화 <b>${diff.length}개</b>: ${diff.map(x => esc(specName(x.s))).join(", ")}</p>` : ""}
      <div class="tbl"><table class="rtab rherot"><thead><tr><th>전문화</th><th>쐐기 <span class="rs">${SL()}상위 ${STOP()}명</span></th><th>레이드 <span class="rs">상위 공격대 처치 명단</span></th></tr></thead><tbody>
      ${HR.map(x => { const { s, rh, mp } = x, dd = isDiff(x); return `<tr${saved && saved.id === s.id ? ' class="me"' : ""}><td><a href="${raidUrl(s.id)}">${icon(s, 18)} ${esc(specName(s))}</a>${dd ? ' <span class="dbadge d-m">다름</span>' : ""}</td><td>${mp ? hbar(s, mp.counts, mp.n) + `<div class="hts">${htxt(s, mp.counts, mp.n)} <span class="muted">${mp.n}명</span></div>` : '<span class="muted">—</span>'}</td><td>${rh ? hbar(s, rh.counts, rh.n) + `<div class="hts">${htxt(s, rh.counts, rh.n)} <span class="muted">연인원 ${rh.n}명${rh.n < MINH ? " · 표본 적음" : ""}</span></div>` : '<span class="muted">처치 명단에 없음</span>'}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="note">둘 다 캐릭터가 켜 둔 특성 코드에서 영웅 트리를 읽었습니다. 쐐기는 ${esc(M5().src || "Raider.IO")} 쐐기 점수 상위권(${esc(M5().date || "")}), 레이드는 보스 ${agg.bosses}개 처치 명단을 합친 연인원(같은 사람이 보스마다 한 번씩 세어짐)입니다. 다른 전문화 코드·영웅 트리 미선택·코드 없음은 분모에서 뺐습니다. "다름"은 레이드 연인원 ${MINH}명 이상일 때만 표시합니다.</p></section>`;
    // 주간 초기화
    const R = c.resets || {};
    const reset = `<section class="boss" id="reset"><h3><span>주간 초기화</span><small>한국 시각</small></h3><div class="tbl"><table class="rtab"><thead><tr><th>지역</th><th>매주</th><th>다음 초기화</th><th class="num">남은 시간</th></tr></thead><tbody>${RESET_REG.filter(([k]) => R[k]).map(([k, t]) => { const n = nextReset(R[k]); return `<tr><td>${esc(t)}</td><td>${kstFmt(n)}</td><td>${kstFmt(n, true)}</td><td class="num" data-reset="${n}">${leftFmt(n)}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="note">레이드 귀속·위대한 금고·쐐기돌이 바뀌는 시각입니다. 초기화 시각은 UTC 고정이라 미국·유럽은 서머타임 때 한국 시각으로 1시간 달라집니다(여기 표는 자동으로 맞춤). 기준: Raider.IO 레이드 지역별 시작 시각에서 7일마다.</p></section>`;
    // 레이드 공략 입구: 내 전문화 레이드 공략 · 레이드 묶음(2시즌·1시즌) · 다른 전문화 고르기
    const RN = { va: ["맹독 심연", "The Venomous Abyss"], vs: ["공허첨탑", "The Voidspire"], dr: ["꿈의 균열", "The Dreamrift"], mq: ["쿠엘다나스 진격로", "March on Quel'Danas"], sf: ["진균나락", "Sporefall"] };
    const rn = k => esc(RN[k][lang === "ko" ? 0 : 1]);
    const setDesc = { s2: `${rn("va")} 8보스 + 소굴 1보스 · 상위 공격대 조합 포함`, s1: `${rn("vs")} 6 · ${rn("dr")} 1 · ${rn("mq")} 2 · ${rn("sf")} 1` };
    const setCard = o => saved ? `<a class="rset" href="${raidUrl(saved.id)}?set=${o.id}"><b>${o.ko} ›</b><span>${setDesc[o.id]}</span></a>` : `<div class="rset"><b>${o.ko}</b><span>${setDesc[o.id]}</span></div>`;
    // 전문화 고르기: 역할마다 레이드 채용률 순위
    const pickGrid = ["tank", "healer", "dps"].map(r => `<div class="rpg"><span class="tlabel">${ROLE_ICON[r]} ${ROSTER.roles[r].ko} · ${esc(sm)} 신화 채용률 순</span>${rankList(SPECS.filter(x => x.role === r).map(x => { const o = agg.specs[x.id]; return { s: x, pct: o ? o.rate : 0, sub: o ? `처치 명단 ${o.guilds}/${agg.kills}` : "상위 공격대 채용 없음", href: raidUrl(x.id), cur: saved && saved.id === x.id }; }))}</div>`).join("");
    const guideSec = `<section class="boss" id="guide"><h3><span>레이드 공략</span><small>전문화별</small></h3>
      ${saved ? `<a class="rmine" href="${raidUrl(saved.id)}">${icon(saved, 28)}<span><b>${esc(specName(saved))} 레이드 공략 ›</b><span class="sub">보스별 요약·단계별 상세·역할과 전문화 할 일 · 난이도 전환</span></span></a>` : `<p class="hint">전문화를 고르면 그 전문화 기준 레이드 공략이 열립니다.</p>`}
      <div class="rsets">${RAID_SETS.map(setCard).join("")}</div>
      <details class="rpick"${saved ? "" : " open"}><summary>${saved ? "다른 전문화로 보기" : "전문화 고르기"}</summary>${pickGrid}</details></section>`;
    // 역할별 채용 요약(상위 3): 누르면 아래 전문화 채용 표가 그 역할로
    const rcard = r => { const L = SPECS.filter(x => x.role === r && agg.specs[x.id]).sort((x, y) => agg.specs[y.id].rate - agg.specs[x.id].rate || agg.specs[y.id].total - agg.specs[x.id].total).slice(0, 3);
      return `<a class="hr-card" href="#specs" data-rrole="${r}"><span class="hr-t">${ROLE_ICON[r]} ${ROSTER.roles[r].ko} 채용</span><ol>${L.map(x => `<li>${icon(x, 20)}<span class="n">${esc(specName(x))}</span><b>${Math.round(agg.specs[x.id].rate)}%</b></li>`).join("")}</ol><span class="more">보스별 채용 보기 ›</span></a>`; };
    app().innerHTML = `<div class="wrap rank rhub">
      <section class="s1-hero"><h1>레이드</h1><p>2시즌(이번 시즌) 맹독 심연과 1시즌 레이드 공략, 그리고 신화 상위 공격대 순위(${esc(c.src || "Raider.IO")}, ${esc(c.date || "")}).</p></section>
      <nav class="rhnav"><a href="#guide">공략</a><a href="#rank">채용 요약</a><a href="#progress">진행 현황</a><a href="#specs">전문화 채용</a><a href="#hero">영웅 특성</a><a href="#reset">주간 초기화</a></nav>
      ${guideSec}
      <section class="home-rank" id="rank"><div class="hr-head"><h2>레이드 순위 <span>맹독 심연 신화 · ${esc(sm)} 상위 공격대(보스마다 최대 ${c.top || 20}팀)가 데려간 전문화 · 채용률 = 보스 ${agg.bosses}개 처치 명단 ${agg.kills}개 중 그 전문화가 있던 비율</span></h2>${sampleSeg()}</div>
        <div class="hr-grid">${["tank", "healer", "dps"].map(rcard).join("")}</div></section>
      ${prog}
      <div class="rkchips rrole"><span class="tlabel">역할</span>${roleSeg}</div>
      ${specs}${hero}${reset}</div>`;
    document.title = "레이드 · 공략과 순위";
  };
  const sync = () => { const p = new URLSearchParams(); if (role !== "all") p.set("role", role); if (SAMPLE !== "world") p.set("sample", SAMPLE); history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash); };
  reSample = () => { const y = scrollY; draw(); sync(); scrollTo(0, y); };
  reLang = () => { const y = scrollY; draw(); scrollTo(0, y); };
  app().addEventListener("click", e => { const b = e.target.closest("[data-rrole]"); if (!b) return; const card = b.classList.contains("hr-card"); if (card) e.preventDefault(); if (b.dataset.rrole !== role) { role = b.dataset.rrole; const y = scrollY; draw(); sync(); scrollTo(0, y); } if (card) { const el = document.getElementById("specs"); if (el) el.scrollIntoView({ block: "start" }); } });
  setInterval(() => document.querySelectorAll("#reset [data-reset]").forEach(el => el.textContent = leftFmt(+el.dataset.reset)), 60e3);
  draw(); sync();
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
}

// =====================================================================
// PvP (/pvp/ 홈, /<직업>/<전문화>/pvp/): 블리자드 공식 순위(data/pvp/*)
// 모드 이름은 게임 한국어 업적 문구 기준: 1인 조합전 · 전장 대공세 · 3v3 투기장 · 2v2 투기장 · 평점제 전장
// =====================================================================
const PVP_BR = [["shuffle", "1인 조합전", "Solo Shuffle"], ["blitz", "전장 대공세", "Blitz"], ["3v3", "3v3 투기장", "3v3"], ["2v2", "2v2 투기장", "2v2"], ["rbg", "평점제 전장", "RBG"]];
const PVP_SMP = [["world", "세계"], ["kr", "한국"]];
const PVP_TEAM = br => ["3v3", "2v2", "rbg"].includes(br);
const pvpState = () => { const q = new URLSearchParams(location.search); let br = q.get("br") || ls.get("wg:pvpbr"); if (!PVP_BR.some(x => x[0] === br)) br = "shuffle"; let smp = q.get("smp") || ls.get("wg:pvpsmp"); if (!PVP_SMP.some(x => x[0] === smp)) smp = "world"; return { br, smp }; };
const pvpSeg = (st) => `<span class="seg pvpbr" role="group" aria-label="모드">${PVP_BR.map(([k, t]) => `<button type="button" data-pbr="${k}" aria-pressed="${st.br === k}">${t}</button>`).join("")}</span>`;
const pvpSmpSeg = (st) => `<span class="seg smp" role="group" aria-label="표본">${PVP_SMP.map(([k, t]) => `<button type="button" data-psmp="${k}" aria-pressed="${st.smp === k}">${k === "kr" ? `<img class="flag" src="${BASE}assets/flags/kr.svg" alt="" width="18" height="12">` : GLOBE}${t}</button>`).join("")}</span>`;
const brName = k => (PVP_BR.find(x => x[0] === k) || [k, k])[1];
const armoryUrl = (reg, realm, name) => `https://worldofwarcraft.blizzard.com/${UI === "en" ? "en-us" : "ko-kr"}/character/${encodeURIComponent(reg)}/${encodeURIComponent(realm)}/${encodeURIComponent(String(name).toLowerCase())}`;
const PVP_REG = { us: "미국", eu: "유럽", kr: "한국", tw: "대만" };
const pflag = k => PVP_REG[k] ? `<img class="flag" src="${BASE}assets/flags/${k}.svg" alt="${PVP_REG[k]}" title="${PVP_REG[k]}" width="18" height="12">` : "";
const pvpNote = (M, st) => { const b = M.brackets[st.br] && M.brackets[st.br][st.smp]; if (!b) return ""; return PVP_TEAM(st.br) ? `${brName(st.br)} 순위 상위 ${b.top}명의 <b>지금 켜 둔 전문화</b> 기준(순위표에 전문화가 없어 캐릭터 정보로 읽음, 전문화를 바꾼 캐릭터는 다르게 잡힐 수 있음${b.noinfo ? `, 정보 없음 ${b.noinfo}명 제외` : ""}).` : `전문화별 ${brName(st.br)} 순위를 합쳐 점수 순 상위 ${b.top}명(컷 ${b.cutoff}점, 전체 ${b.ranked.toLocaleString()}명 중).`; };
// ---------- PvP 3·4단계: 지도 공략, 전문화 전략 ----------
const pvpMapUrl = id => `${BASE}pvp/map/?m=${id}`;
const PVP_TAGS = { tb: "탱버", int: "차단", pos: "위치", dodge: "회피", disp: "해제", cc: "제어", aoe: "광역 피해", prio: "우선 처치", tip: "참고", soak: "분담", swap: "교대", cd: "생존기" };
const PVP_TAGK = Object.fromEntries(Object.entries(PVP_TAGS).map(([k, v]) => [v, k]));
// "[@b |@r ][태그] 문장" → { m, k, x }
const pvpParse = l => { const m = String(l).match(/^(?:@(b|r) )?\[([^\]]+)\] (.+)$/); return m ? { m: m[1] || null, k: PVP_TAGK[m[2]] || "tip", x: m[3] } : { m: null, k: "tip", x: String(l) }; };
const pvpLi = (k, html, modeBadge) => `<li><span class="tag t-${k}">${PVP_TAGS[k] || "참고"}</span><span>${modeBadge || ""}${html}</span></li>`;
const pvpModeBadge = m => m === "b" ? '<span class="dbadge d-h">전장 대공세</span>' : m === "r" ? '<span class="dbadge d-n">평점제 전장</span>' : "";
// 한글 모드 사전: 기술(tips→spells/spellsKo) + 이름(names)
const pvpDict = (...srcs) => { const o = {}; for (const S of srcs) { if (!S) continue; for (const id of Object.keys(S.spells || {})) { const en = S.spells[id] && S.spells[id].n, ko = S.spellsKo && S.spellsKo[id] && S.spellsKo[id].n; if (en && ko) o[en] = ko; } Object.assign(o, S.names || {}); } return o; };
async function pvpMapPage() {
  const q = new URLSearchParams(location.search);
  app().innerHTML = '<div class="wrap rank"><p class="muted">불러오는 중…</p></div>';
  const MS = await J("data/pvp/maps.json").catch(() => null);
  const maps = (MS && MS.maps) || [];
  if (!maps.length) { app().innerHTML = '<div class="wrap rank"><p>전장·투기장 공략 데이터가 없습니다.</p></div>'; return; }
  let id = q.get("m"); if (!maps.some(m => m.id === id)) id = maps[0].id;
  let mode = ls.get("wg:pvpmode") === "r" ? "r" : "b";
  const role0 = (BYID[ls.get("wg:spec")] || {}).role;
  const draw = () => {
    const M = maps.find(m => m.id === id); const bg = M.type === "bg";
    const ko = lang === "ko" ? makeKo(pvpDict(M)) : (s => s);
    const nm = m => lang === "ko" && m.ko ? m.ko : m.name;
    const show = p => !bg || !p.m || p.m === mode;
    const tabs = [["bg", "전장"], ["arena", "투기장"]].map(([t, lb]) => { const L = maps.filter(m => m.type === t); return L.length ? `<div class="mapgrp"><span class="tlabel">${lb}</span>${L.map(m => `<a class="mapt" href="${pvpMapUrl(m.id)}" data-map="${m.id}"${m.id === id ? ' aria-current="page"' : ""}>${esc(nm(m))}</a>`).join("")}</div>` : ""; }).join("");
    const brief = (M.brief || []).filter(([, , o]) => !bg || !(o && o.m) || o.m === mode).map(([k, x, o]) => pvpLi(k, ko(x), bg && o && o.m ? pvpModeBadge(o.m) : "")).join("");
    const secs = ((M.detail || {}).sections || []).map(sec => { const L = sec.points.map(pvpParse).filter(show); return L.length ? `<h4>${esc(ko(sec.title))}</h4><ul class="items">${L.map(p => pvpLi(p.k, esc(ko(p.x)), bg ? pvpModeBadge(p.m) : "")).join("")}</ul>` : ""; }).join("");
    const roles = ["tank", "healer", "dps"].filter(r => ((M.role || {})[r] || []).length).sort((a, b) => (b === role0) - (a === role0));
    const roleHtml = roles.map(r => { const L = M.role[r].map(pvpParse).filter(show); return L.length ? `<h4>${ROLE_ICON[r]} ${ROSTER.roles[r].ko}</h4><ul class="items">${L.map(p => pvpLi(p.k, esc(ko(p.x)), bg ? pvpModeBadge(p.m) : "")).join("")}</ul>` : ""; }).join("");
    const meta = M.meta || {};
    app().innerHTML = `<div class="wrap rank rhub">
      <section class="s1-hero"><h1>PvP 전장·투기장 공략</h1><p>한밤 2시즌 전장(전장 대공세·평점제 전장)과 투기장. 장소를 고르면 목표·배치·역할별 할 일을 봅니다.</p></section>
      <nav class="maptabs">${tabs}</nav>
      ${bg ? `<div class="rkchips"><span class="tlabel">모드</span><span class="seg" role="group"><button type="button" data-pmode="b" aria-pressed="${mode === "b"}">전장 대공세 (8v8)</button><button type="button" data-pmode="r" aria-pressed="${mode === "r"}">평점제 전장 (10v10)</button></span></div>` : ""}
      <div><h2 class="dname">${esc(nm(M))}</h2><p class="dsub">${bg ? "전장" : "투기장"}${meta.goal ? " · " + esc(ko(meta.goal)) : ""}${meta.size ? " · " + esc(meta.size) : ""}${lang === "ko" && M.ko ? ` · ${esc(M.name)}` : ""}</p></div>
      <section class="boss"><h3><span>요약</span><small>Brief</small></h3><ul class="items">${brief}</ul></section>
      ${(M.detail || {}).overview ? `<section class="boss"><h3><span>흐름</span><small>Overview</small></h3><p>${esc(ko(M.detail.overview))}</p>${secs}</section>` : ""}
      ${roleHtml ? `<section class="boss"><h3><span>역할별 할 일</span><small>Roles</small></h3>${roleHtml}</section>` : ""}
      <p class="note">출처: ${(M.sources || []).map(s => `<a href="${esc(srcU(s.u))}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join(" · ")}. 장소·기술 이름은 게임 데이터(한글 클라이언트) 기준입니다. 전문화별 할 일은 각 전문화 PvP 페이지의 "PvP 전략"에 있습니다.</p></div>`;
    document.title = `${nm(M)} · PvP 전장·투기장 공략`;
  };
  const sync = () => history.replaceState(null, "", location.pathname + "?m=" + id);
  app().addEventListener("click", e => {
    const a = e.target.closest("[data-map]"); if (a) { e.preventDefault(); id = a.dataset.map; draw(); sync(); scrollTo(0, 0); return; }
    const b = e.target.closest("[data-pmode]"); if (b) { mode = b.dataset.pmode; ls.set("wg:pvpmode", mode); draw(); }
  });
  reLang = () => draw();
  draw(); sync();
}
// PvP 홈의 전장·투기장 목록(3단계)
const pvpMapListHtml = maps => { if (!maps || !maps.length) return ""; const nm = m => lang === "ko" && m.ko ? m.ko : m.name;
  return ["bg", "arena"].map(t => { const L = maps.filter(m => m.type === t); return L.length ? `<div class="rpg"><span class="tlabel">${t === "bg" ? "전장 (전장 대공세·평점제 전장)" : "투기장 (1인 조합전·2v2·3v3)"}</span><div class="rpl">${L.map(m => `<a href="${pvpMapUrl(m.id)}"><span>${esc(nm(m))}</span></a>`).join("")}</div></div>` : ""; }).join(""); };
// 전문화 PvP 전략(4단계)
const pvpStratHtml = (s, St, mspec, P) => { if (!St) return "";
  const pv = {}; for (const br of Object.values((P && P.brackets) || {})) for (const smp of Object.values(br)) for (const t of Object.values(smp.pvp || {})) if (t.en && t.ko) pv[t.en] = t.ko;
  const ko = lang === "ko" ? makeKo({ ...pvpDict(mspec, St), ...pv }) : (x => x);
  const list = L => `<ul class="items">${(L || []).map(pvpParse).map(p => pvpLi(p.k, esc(ko(p.x)))).join("")}</ul>`;
  return `<section class="boss"><h3><span>PvP 전략</span><small>${esc(specName(s))}</small></h3>
    <h4>투기장 · 1인 조합전</h4>${list(St.arena)}
    <h4>전장 · 전장 대공세 · 평점제 전장</h4>${list(St.bg)}
    ${St.pvpTalents ? `<h4>PvP 특성</h4><p>${esc(ko(St.pvpTalents))}</p>` : ""}
    <p class="note">${esc(St.note || "")} 장소별 공략은 <a href="${BASE}pvp/#maps">PvP 전장·투기장 공략</a>에 있습니다.</p></section>`; };

async function pvpHubPage() {
  const saved = BYID[ls.get("wg:spec")];
  const st = pvpState();
  app().innerHTML = '<div class="wrap rank"><p class="muted">불러오는 중…</p></div>';
  const [M, MS] = await Promise.all([J("data/pvp/meta.json").catch(() => null), J("data/pvp/maps.json").catch(() => null)]);
  if (!M) { app().innerHTML = '<div class="wrap rank"><p>PvP 데이터를 아직 받지 못했습니다.</p></div>'; return; }
  let role = "all"; const rankCache = {};
  const draw = async () => {
    const b = (M.brackets[st.br] || {})[st.smp];
    const rk = `${st.br}${st.smp === "kr" ? ".kr" : ""}`; const R = rankCache[rk] || (rankCache[rk] = await J(`data/pvp/rank/${rk}.json`).catch(() => ({ rows: [] })));
    const share = id => b && b.specs[id] && b.top ? b.specs[id].n / b.top * 100 : 0;
    const rcard = r => { const L = SPECS.filter(x => x.role === r && b && b.specs[x.id] && b.specs[x.id].n).sort((x, y) => share(y.id) - share(x.id)).slice(0, 3);
      return `<a class="hr-card" href="#specs" data-prole="${r}"><span class="hr-t">${ROLE_ICON[r]} ${ROSTER.roles[r].ko}</span><ol>${L.map(x => `<li>${icon(x, 20)}<span class="n">${esc(specName(x))}</span><b>${pctTxt(Math.round(share(x.id) * 10) / 10)}</b></li>`).join("") || `<li class="muted">상위 ${b.top}명 안에 없음</li>`}</ol><span class="more">전문화 표 보기 ›</span></a>`; };
    const L = SPECS.filter(x => role === "all" || x.role === role).map(x => ({ s: x, v: (b && b.specs[x.id]) || { n: 0 } })).sort((x, y) => y.v.n - x.v.n || (y.v.best || 0) - (x.v.best || 0));
    const team = PVP_TEAM(st.br);
    const table = `<div class="tbl"><table class="rtab"><thead><tr><th class="num">#</th><th>전문화</th><th>상위 ${b ? b.top : 0}명 중</th>${team ? "" : '<th class="num">순위 인원</th><th class="num">최고</th><th class="num">중앙값</th>'}</tr></thead><tbody>${L.map(({ s, v }, i) => `<tr${saved && saved.id === s.id ? ' class="me"' : ""}><td class="num">${i + 1}</td><td><a class="spl" href="${pvpUrl(s.id, `?br=${st.br}&smp=${st.smp}`)}">${icon(s, 18)} ${esc(specName(s))}</a></td><td><span class="sbar"><i style="width:${Math.min(100, share(s.id) * 4)}%"></i></span> <b>${v.n}</b>명 <span class="muted">${pctTxt(Math.round(share(s.id) * 10) / 10)}</span></td>${team ? "" : `<td class="num">${(v.total || 0).toLocaleString()}</td><td class="num">${v.best || "—"}</td><td class="num">${v.med || "—"}</td>`}</tr>`).join("")}</tbody></table></div>`;
    const rows = (R.rows || []).slice(0, 100);
    const ladder = rows.length ? `<div class="tbl"><table class="rtab"><thead><tr><th class="num">순위</th><th class="num">점수</th><th>캐릭터</th><th>전문화</th><th>영웅 특성</th><th class="num">승/판</th></tr></thead><tbody>${rows.map(r => { const s = BYID[r[5]]; const h = s && r[6] ? heroOf(s, r[6]) : null; return `<tr><td class="num">${Number(r[0])}</td><td class="num"><b>${Number(r[1])}</b></td><td><a href="${armoryUrl(r[4], r[3], r[2])}" target="_blank" rel="noopener" translate="no">${esc(r[2])}</a> <span class="rs" translate="no">${pflag(r[4])} ${esc(r[3])}</span></td><td>${s ? `<a class="spl" href="${pvpUrl(s.id, `?br=${st.br}&smp=${st.smp}`)}">${icon(s, 16)} ${esc(specName(s))}</a>` : '<span class="muted">—</span>'}</td><td>${h ? esc(heroName(h)) : '<span class="muted">—</span>'}</td><td class="num">${Number(r[7])}/${Number(r[8])}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="empty">${esc(PVP_SMP.find(x => x[0] === st.smp)[1])} ${brName(st.br)} 순위 기록이 없습니다.</p>`;
    const tiers = (M.tiers || []).filter((t, i, a) => a.findIndex(x => x.en === t.en) === i).sort((x, y) => (y.min || 0) - (x.min || 0));
    // 전문화 고르기: 역할마다 지금 모드·표본의 상위권 비율 순위
    // 그 역할이 상위권에 한 명도 없으면(예: 1인 조합전 탱커) 전문화별 순위표에 오른 인원 비율로 매긴다
    const pickGrid = ["tank", "healer", "dps"].map(r => { const L = SPECS.filter(x => x.role === r); const inTop = L.some(x => b && b.specs[x.id] && b.specs[x.id].n);
      const tot = L.reduce((a, x) => a + ((b && b.specs[x.id] && b.specs[x.id].total) || 0), 0); const byTotal = !inTop && tot > 0;
      const label = byTotal ? `${esc(brName(st.br))} ${esc(PVP_SMP.find(x => x[0] === st.smp)[1])} 순위표 인원 순 (상위 ${b.top}명 안에는 없음)` : `${esc(brName(st.br))} ${esc(PVP_SMP.find(x => x[0] === st.smp)[1])} 상위 ${b ? b.top : 0}명 비율 순`;
      return `<div class="rpg"><span class="tlabel">${ROLE_ICON[r]} ${ROSTER.roles[r].ko} · ${label}</span>${rankList(L.map(x => { const v = b && b.specs[x.id]; const pct = byTotal ? (v && v.total ? v.total / tot * 100 : 0) : (v && b.top ? v.n / b.top * 100 : 0);
        return { s: x, pct: Math.round(pct * 10) / 10, sub: byTotal ? (v && v.total ? `순위 인원 ${v.total.toLocaleString()}명` : "순위 기록 없음") : (v && v.n ? `${v.n}명` : "상위권에 없음"), href: pvpUrl(x.id, `?br=${st.br}&smp=${st.smp}`), cur: saved && saved.id === x.id }; }))}</div>`; }).join("");
    app().innerHTML = `<div class="wrap rank rhub">
      <section class="s1-hero"><h1>PvP</h1><p>한밤 2시즌 평점제 PvP. 블리자드 공식 순위표(미국·유럽·한국·대만) 기준 전문화 비율, 추천 빌드, 순위(${esc(M.src)}, ${esc(M.date)}). 중국은 공식 API에 없어 빠집니다.</p></section>
      <nav class="rhnav"><a href="#guide">빌드</a><a href="#maps">전장·투기장</a><a href="#rank">전문화 비율</a><a href="#ladder">순위표</a><a href="#tiers">평점 구간</a></nav>
      <section class="boss" id="guide"><h3><span>전문화별 PvP 빌드</span><small>추천 빌드 · 영웅 특성 · PvP 특성</small></h3>
        ${saved ? `<a class="rmine" href="${pvpUrl(saved.id, `?br=${st.br}&smp=${st.smp}`)}">${icon(saved, 28)}<span><b>${esc(specName(saved))} PvP ›</b><span class="sub">${esc(brName(st.br))} 상위권이 쓰는 빌드·영웅 특성·PvP 특성</span></span></a>` : '<p class="hint">전문화를 고르면 그 전문화의 PvP 빌드가 열립니다.</p>'}
        <details class="rpick"${saved ? "" : " open"}><summary>${saved ? "다른 전문화로 보기" : "전문화 고르기"}</summary>${pickGrid}</details>
        <p class="note">전문화 페이지에는 모드별 추천 빌드·PvP 특성과 함께 "PvP 전략"(투기장·전장에서 그 전문화가 할 일)이 있습니다.</p></section>
      ${MS && MS.maps && MS.maps.length ? `<section class="boss" id="maps"><h3><span>전장·투기장 공략</span><small>목표·배치·역할별 할 일</small></h3>${pvpMapListHtml(MS.maps)}<p class="note">장소마다 목표·시작 배치·역할별 할 일. 전장은 전장 대공세(8v8)와 평점제 전장(10v10) 차이를 따로 표시합니다.</p></section>` : ""}
      <div class="rkchips pvpctl"><span class="tlabel">모드</span>${pvpSeg(st)}</div>
      <div class="rkchips"><span class="tlabel">표본</span>${pvpSmpSeg(st)}</div>
      <section class="home-rank" id="rank"><div class="hr-head"><h2>${esc(brName(st.br))} 전문화 비율 <span>${pvpNote(M, st)}</span></h2></div>
        ${b && b.top ? `<div class="hr-grid">${["tank", "healer", "dps"].map(rcard).join("")}</div>` : `<p class="empty">${esc(PVP_SMP.find(x => x[0] === st.smp)[1])} ${brName(st.br)} 순위 기록이 없습니다.</p>`}</section>
      ${b && b.top ? `<section class="boss" id="specs"><h3><span>전문화 표</span><small>${esc(brName(st.br))}</small></h3><div class="rkchips rrole"><span class="tlabel">역할</span><span class="seg" role="group">${[["all", "전체"], ["tank", ROLE_ICON.tank + " " + ROSTER.roles.tank.ko], ["healer", ROLE_ICON.healer + " " + ROSTER.roles.healer.ko], ["dps", ROLE_ICON.dps + " " + ROSTER.roles.dps.ko]].map(([k, t]) => `<button type="button" data-prole="${k}" aria-pressed="${role === k}">${t}</button>`).join("")}</span></div>${table}
        <p class="note">${team ? "" : "순위 인원: 그 전문화의 이번 시즌 순위표에 점수가 있는 캐릭터 수. 최고·중앙값은 그 순위표의 점수."}</p></section>` : ""}
      <section class="boss" id="ladder"><h3><span>순위표</span><small>${esc(brName(st.br))} 상위 100</small></h3>${ladder}
        <p class="note">영웅 특성은 캐릭터 정보를 받은 경우에만 표시합니다. 캐릭터 이름을 누르면 블리자드 전투정보실로 갑니다.</p></section>
      <section class="boss" id="tiers"><h3><span>평점 구간</span><small>정예병 등</small></h3><div class="tbl"><table class="rtab"><thead><tr><th>등급</th><th class="num">평점</th></tr></thead><tbody>${tiers.map(t => `<tr><td>${esc(lang === "ko" && t.ko ? t.ko : t.en)}</td><td class="num">${t.min}${t.max && t.max < 5000 ? "–" + t.max : "+"}</td></tr>`).join("")}</tbody></table></div></section></div>`;
    document.title = `PvP · ${brName(st.br)} 순위와 빌드`;
  };
  const sync = () => { const p = new URLSearchParams(); if (st.br !== "shuffle") p.set("br", st.br); if (st.smp !== "world") p.set("smp", st.smp); history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash); };
  const redraw = async () => { const y = scrollY; await draw(); sync(); scrollTo(0, y); };
  app().addEventListener("click", async e => {
    const bb = e.target.closest("[data-pbr]"); if (bb) { st.br = bb.dataset.pbr; ls.set("wg:pvpbr", st.br); await redraw(); return; }
    const sb = e.target.closest("[data-psmp]"); if (sb) { st.smp = sb.dataset.psmp; ls.set("wg:pvpsmp", st.smp); await redraw(); return; }
    const rb = e.target.closest("[data-prole]"); if (rb) { const card = rb.classList.contains("hr-card"); if (card) e.preventDefault(); role = rb.dataset.prole; await redraw(); if (card) { const el = document.getElementById("specs"); if (el) el.scrollIntoView({ block: "start" }); } }
  });
  reLang = () => redraw();
  await draw(); sync();
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
}
async function pvpSpecPage() {
  const s = BYID[CFG.spec];
  if (!s) { location.replace(BASE + "?pick"); return; }
  setClassColor(s.cls);
  const hero = savedHero(s) || defaultHero(s);
  const st = pvpState();
  const [M, P, St, MSP] = await Promise.all([J("data/pvp/meta.json").catch(() => null), J(`data/pvp/spec/${s.id.replace("/", "-")}.json`).catch(() => null), J(`data/pvp/strat/${s.id.replace("/", "-")}.json`).catch(() => null), J(`data/spec/${s.id.replace("/", "-")}.json`).catch(() => null)]);
  const draw = () => {
    const b = M && (M.brackets[st.br] || {})[st.smp]; const d = P && (P.brackets[st.br] || {})[st.smp];
    const team = PVP_TEAM(st.br);
    const inTop = b && b.specs[s.id] ? b.specs[s.id].n : 0;
    const roleRank = b ? SPECS.filter(x => x.role === s.role).map(x => [x.id, (b.specs[x.id] || { n: 0 }).n]).sort((x, y) => y[1] - x[1]).findIndex(x => x[0] === s.id) + 1 : 0;
    const hs = d ? s.heroes.map(h => [h, d.hero[h.slug] || 0]) : []; const hn = hs.reduce((x, y) => x + y[1], 0);
    const mp = SD(s).hero500;
    const heroBar = (cnt, n) => `<span class="hbar">${s.heroes.map((h, i) => `<i class="h${i}" style="width:${n ? cnt(h) / n * 100 : 0}%"></i>`).join("")}</span>`;
    const heroSec = d && hn ? `<section class="boss"><h3><span>영웅 특성</span><small>PvP vs 쐐기</small></h3><div class="tbl"><table class="rhero"><thead><tr><th></th><th></th>${s.heroes.map((h, i) => `<th class="num"><span class="hdot h${i}"></span>${esc(heroName(h))}</th>`).join("")}<th></th></tr></thead><tbody>
      <tr><th>${esc(brName(st.br))}</th><td>${heroBar(h => d.hero[h.slug] || 0, hn)}</td>${s.heroes.map(h => `<td class="num"><b>${Math.round((d.hero[h.slug] || 0) / hn * 100)}%</b></td>`).join("")}<td class="muted">${team ? "상위권 중 이 전문화" : "이 전문화 상위"} ${hn}명</td></tr>
      ${mp && mp.n ? `<tr><th>쐐기</th><td>${heroBar(h => mp.counts[h.slug] || 0, mp.n)}</td>${s.heroes.map(h => `<td class="num"><b>${Math.round((mp.counts[h.slug] || 0) / mp.n * 100)}%</b></td>`).join("")}<td class="muted">쐐기 상위 ${mp.n}명</td></tr>` : ""}</tbody></table></div></section>` : "";
    const builds = d && d.builds && d.builds.length ? `<section class="boss"><h3><span>추천 빌드</span><small>영웅 특성별 대표 빌드</small></h3>
      ${d.builds.filter(x => heroOf(s, x.hero)).slice(0, 3).map(x => { const h = heroOf(s, x.hero); return `<div class="build-row"><div class="bname">${esc(heroName(h))} · ${x.n}명 중 대표${x.agree != null ? ` · 평균 일치 ${x.agree}%` : ""}</div><input class="bcode" readonly value="${esc(x.code)}" aria-label="특성 코드"><button class="bcopy pcopy" type="button">복사</button><a class="blink" href="https://www.wowhead.com/talent-calc/blizzard/${esc(x.code)}" target="_blank" rel="noopener">Wowhead ↗</a></div>`; }).join("")}
      <p class="note">게임에서 특성 창(N) → 빌드 목록 → 가져오기 → 붙여넣기. ${team ? `${brName(st.br)} 상위권 중 이 전문화 ${d.n}명` : `이 전문화 ${brName(st.br)} 상위 ${d.n}명`}의 특성 코드를 영웅 특성별로 모아, 다른 사람들 코드와 특성이 가장 많이 겹치는 실제 코드를 골랐습니다(평균 일치: 그 코드와 나머지 사람들 사이에서 같은 특성의 비율). 사람 수가 많은 영웅 특성부터 보여 줍니다. PvP 특성은 코드에 들어 있지 않으니 아래 표를 보고 고르세요.</p></section>` : "";
    const pv = d && d.pvp ? Object.entries(d.pvp).sort((a, b) => (b[1].n || 0) - (a[1].n || 0)) : [];
    const pvpSec = pv.length ? `<section class="boss"><h3><span>PvP 특성</span><small>채택률</small></h3><div class="tbl"><table class="rtab"><thead><tr><th>특성</th><th>채택</th></tr></thead><tbody>${pv.slice(0, 10).map(([id, x]) => `<tr><td>${x.spell ? `<a href="https://www.wowhead.com/${lang === "ko" ? "ko/" : ""}spell=${x.spell}" target="_blank" rel="noopener">${esc(lang === "ko" && x.ko ? x.ko : x.en)}</a>` : esc(lang === "ko" && x.ko ? x.ko : x.en)}</td><td><span class="sbar"><i style="width:${x.n / d.n * 100}%"></i></span> ${Math.round(x.n / d.n * 100)}% <span class="muted">(${x.n}/${d.n})</span></td></tr>`).join("")}</tbody></table></div><p class="note">PvP 특성 칸 3개 중 고른 비율. 이름은 게임 데이터(블리자드 API 한국어·영어)입니다.</p></section>` : "";
    const topSec = d && d.top && d.top.length ? `<section class="boss"><h3><span>상위 캐릭터</span><small>${esc(brName(st.br))}</small></h3><div class="tbl"><table class="rtab"><thead><tr><th class="num">#</th><th class="num">점수</th><th>캐릭터</th><th>영웅 특성</th><th class="num">승/판</th></tr></thead><tbody>${d.top.map((r, i) => { const h = r[4] ? heroOf(s, r[4]) : null; return `<tr><td class="num">${i + 1}</td><td class="num"><b>${Number(r[0])}</b></td><td><a href="${armoryUrl(r[3], r[2], r[1])}" target="_blank" rel="noopener" translate="no">${esc(r[1])}</a> <span class="rs" translate="no">${pflag(r[3])} ${esc(r[2])}</span></td><td>${h ? esc(heroName(h)) : '<span class="muted">—</span>'}</td><td class="num">${Number(r[5])}/${Number(r[6])}</td></tr>`; }).join("")}</tbody></table></div></section>` : "";
    const sum = b ? `<p class="rrec"><b>${esc(s.koFull)}</b>: ${esc(brName(st.br))} ${team ? `상위 ${b.top}명 중` : `상위 ${b.top}명(컷 ${b.cutoff}점) 중`} <b>${inTop}명</b>${b.top ? ` (${pctTxt(Math.round(inTop / b.top * 1000) / 10)})` : ""} · ${ROSTER.roles[s.role].ko} ${roleRank}위${d && !team && d.total != null ? ` · 순위 인원 ${d.total.toLocaleString()}명, 최고 ${d.best || "—"}점` : ""}</p>` : "";
    const none = !d || !d.n ? `<p class="empty">${esc(PVP_SMP.find(x => x[0] === st.smp)[1])} ${brName(st.br)}에서 이 전문화의 상위권 기록이 없습니다.</p>` : "";
    document.getElementById("main").innerHTML = `${sum}${none}${heroSec}${builds}${pvpSec}${pvpStratHtml(s, St, MSP, P)}${topSec}`;
    document.getElementById("lede").textContent = `한밤 2시즌 PvP · ${brName(st.br)} · ${PVP_SMP.find(x => x[0] === st.smp)[1]} · 블리자드 공식 순위 기준 ${M ? M.date : ""}`;
    document.title = `${specName(s)} · PvP`;
    document.querySelectorAll("[data-pbr]").forEach(x => x.setAttribute("aria-pressed", x.dataset.pbr === st.br));
    document.querySelectorAll("[data-psmp]").forEach(x => x.setAttribute("aria-pressed", x.dataset.psmp === st.smp));
  };
  app().innerHTML = topbar(s, "pvp", hero) + `<div class="wrap">
    <p class="lede" id="lede"></p>
    <div class="ctrl"><div class="herorow"><span class="herogrp"><span class="tlabel">모드</span>${pvpSeg(st)}</span><span class="herogrp"><span class="tlabel">표본</span>${pvpSmpSeg(st)}</span></div></div>
    <main id="main" class="pvp"></main>
    <footer id="foot"><div>순위·특성·PvP 특성은 블리자드 Battle.net 공식 API(미국·유럽·한국·대만 순위표와 캐릭터 정보)에서 매일 받습니다. 1인 조합전·전장 대공세는 전문화별 순위표, 투기장·평점제 전장은 상위 캐릭터가 지금 켜 둔 전문화 기준입니다.</div></footer></div>`;
  bindTopbar(s);
  const sync = () => { const p = new URLSearchParams(); if (st.br !== "shuffle") p.set("br", st.br); if (st.smp !== "world") p.set("smp", st.smp); history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "")); };
  app().addEventListener("click", e => {
    const bb = e.target.closest("[data-pbr]"); if (bb) { st.br = bb.dataset.pbr; ls.set("wg:pvpbr", st.br); draw(); sync(); return; }
    const sb = e.target.closest("[data-psmp]"); if (sb) { st.smp = sb.dataset.psmp; ls.set("wg:pvpsmp", st.smp); draw(); sync(); return; }
    const cb = e.target.closest(".pcopy"); if (cb) { const inp = cb.previousElementSibling; const done = () => { cb.textContent = "복사됨"; setTimeout(() => cb.textContent = "복사", 1500); }; try { navigator.clipboard.writeText(inp.value).then(done, () => inp.select()); } catch (err) { inp.select(); } }
  });
  document.querySelectorAll("#tiplang button").forEach(bt => bt.onclick = () => { lang = bt.dataset.l; ls.set("wg:lang", lang); document.querySelectorAll("#tiplang button").forEach(x => x.setAttribute("aria-pressed", x.dataset.l === lang)); draw(); const n = document.querySelector(".lnav .n"); if (n) n.textContent = specName(s); const h = document.querySelector(".lnav .h"); if (h) h.textContent = "· " + heroName(heroOf(s, hero)); });
  draw(); sync();
}

// =====================================================================
// 쐐기 순위표 (/rank/): Raider.IO 쐐기 점수 상위 500명 — 역할별·직업별·전문화별
// 데이터는 data/rank/*.json (tools/research/top500.mjs 가 주간 갱신 때 씀)
// =====================================================================
async function rankPage() {
  const q = new URLSearchParams(location.search);
  const CLS = Object.fromEntries(ROSTER.classes.map(c => [c.slug, c]));
  const saved = BYID[ls.get("wg:spec")];
  const st = q.get("spec") && BYID[q.get("spec")] ? { by: "spec", id: q.get("spec") }
    : q.get("class") && CLS[q.get("class")] ? { by: "class", id: q.get("class") }
    : q.get("role") && ROSTER.roles[q.get("role")] ? { by: "role", id: q.get("role") }
    : { by: "all", id: "all" }; // 주소에 조건이 없으면(?all 포함) 전체 순위
  let T = M5(); const cache = {}; let filter = null, data = null;
  const KRS = () => SAMPLE === "kr" && hasKr();
  const XCN = () => SAMPLE === "xcn" && hasSub();
  const CNS = () => SAMPLE === "cn" && hasCn();
  const SEP = () => KRS() || XCN() || CNS(); // 따로 받은 목록 파일(data/rank/<표본>/)
  // 지역 거르기: 받은 상위 500명 안에서만 거른다(지역별 순위를 새로 받는 것이 아님)
  const REG = { us: "미국", eu: "유럽", kr: "한국", tw: "대만", cn: "중국" };
  // 지역 줄은 지금 표본의 500명 안에서만 거른다(다른 500명 목록으로 가는 건 위쪽 표본 버튼)
  let reg = REG[q.get("region")] || q.get("region") === "!cn" ? q.get("region") : "";
  // 옛 데이터(중국 = 세계 500명 중 중국 서버)일 때만 지역 거르기로
  const regOfSample = () => SAMPLE === "cn" && !hasCn() ? "cn" : "";
  if (!reg && regOfSample()) reg = regOfSample();
  const inReg = r => !reg || (reg === "!cn" ? r[4] !== "cn" : r[4] === reg);
  const regName = k => k === "!cn" ? "중국 제외" : REG[k];
  // 지역은 국기로(assets/flags/*.svg, flagcdn.com 원본). 이모지 국기는 윈도우에서 글자로 보여서 쓰지 않는다
  const flag = k => REG[k] ? `<img class="flag" src="${BASE}assets/flags/${k}.svg" alt="${REG[k]}" title="${REG[k]}" width="18" height="12">` : esc(String(k).toUpperCase());
  const PAL = ["#0A84FF", "#FF9F0A", "#30D158", "#BF5AF2", "#FF375F", "#64D2FF", "#FFD60A", "#AC8E68"];
  const fileOf = () => (SEP() ? SAMPLE + "/" : "") + (st.by === "all" ? "all" : st.by === "spec" ? "spec-" + st.id.replace("/", "-") : st.by + "-" + st.id);
  // 세계(중국 제외)는 Raider.IO에 따로 없어 세계 원문으로 잇는다
  const rioUrl = () => { const b = `https://raider.io/mythic-plus-character-rankings/${T.season || "season-mn-2"}/${KRS() ? "kr" : CNS() ? "cn" : "world"}/`; return st.by === "all" ? b + "all/all" : st.by === "spec" ? b + st.id : st.by === "class" ? b + st.id + "/all" : b + "all/" + st.id; };
  const clsName = c => c ? (lang === "ko" ? c.ko : c.en) : "";
  const title = () => st.by === "all" ? "전체" : st.by === "spec" ? specName(BYID[st.id]) : st.by === "class" ? clsName(CLS[st.id]) : ROSTER.roles[st.id].ko;
  // 분류 키 → [이름, 기타(회색)인지]
  const label = key => {
    if (st.by === "spec") { if (key === "~") return ["지금 다른 전문화 특성", 1]; if (key === "0") return ["특성 정보 없음", 1]; if (key === "?") return ["영웅 트리 미선택", 1]; const h = heroOf(BYID[st.id], key); return [h ? heroName(h) : key, 0]; }
    if (st.by === "class") { if (key === "?") return ["전문화 표시 없음", 1]; const s = BYID[st.id + "/" + key]; return [s ? (lang === "ko" ? s.ko : s.en) : key, 0]; }
    const s = BYID[key]; if (s) return [specName(s), 0]; if (key === "?") return [st.by === "all" ? "전문화 표시 없음" : "전문화를 가를 수 없음", 1]; return [clsName(CLS[key.split("/")[0]]) + " (전문화 가를 수 없음)", 1];
  };
  const pickHtml = () => {
    const seg = `<div class="seg rkseg" role="group" aria-label="순위표 종류">${[["all", "전체"], ["role", "역할별"], ["class", "직업별"], ["spec", "전문화별"]].map(([k, t]) => `<button type="button" data-by="${k}" aria-pressed="${st.by === k}">${t}</button>`).join("")}</div>`;
    let row = "";
    if (st.by === "all") row = "";
    else if (st.by === "role") row = `<div class="rkchips">${["tank", "healer", "dps"].map(r => `<button type="button" class="rkc" data-id="${r}" aria-pressed="${st.id === r}">${ROLE_ICON[r]} ${ROSTER.roles[r].ko}</button>`).join("")}</div>`;
    else {
      const cur = st.by === "class" ? st.id : BYID[st.id] ? BYID[st.id].cls.slug : "";
      row = `<div class="rkchips">${ROSTER.classes.map(c => `<button type="button" class="rkc" data-cls="${c.slug}" aria-pressed="${cur === c.slug}"><span class="dot" style="--cls:${c.color}"></span>${esc(clsName(c))}</button>`).join("")}</div>`;
      if (st.by === "spec" && cur) row += `<div class="rkchips">${CLS[cur].specs.map(x => BYID[cur + "/" + x.slug]).map(s => `<button type="button" class="rkc" data-id="${s.id}" aria-pressed="${st.id === s.id}">${icon(s, 20)}${esc(lang === "ko" ? s.ko : s.en)}</button>`).join("")}</div>`;
    }
    return seg + row;
  };
  const bodyHtml = () => {
    if (!data) return '<p class="muted">불러오는 중…</p>';
    const all = data.rows, rows = KRS() || CNS() ? all : all.filter(inReg);
    const sepIx = new Map(all.map((r, i) => [r, i + 1])); const kOf = r => (st.by === "role" || st.by === "all") && /\/\?$/.test(r[6]) ? "?" : r[6]; const cnt = {}; rows.forEach(r => { cnt[kOf(r)] = (cnt[kOf(r)] || 0) + 1; });
    const keys = Object.keys(cnt).sort((x, y) => (label(x)[1] - label(y)[1]) || cnt[y] - cnt[x]);
    const color = {}; let pi = 0; keys.forEach(k => { color[k] = label(k)[1] ? "#8E8E93" : (PAL[pi++] || "#C7C7CC"); });
    const bar = `<div class="rbar">${keys.map(k => `<i style="width:${cnt[k] / rows.length * 100}%;background:${color[k]}" title="${esc(label(k)[0])} ${cnt[k]}"></i>`).join("")}</div>`;
    // 순위 목록형 필터: 많은 순서로 순위 번호(1~3위 배지)·아이콘·막대·인원·비율, 누르면 그 항목만 표에 남는다. 기타(회색) 항목은 순위 없이 아래에
    const legSpec = k => st.by === "class" ? BYID[st.id + "/" + k] : st.by === "spec" ? null : BYID[k];
    const legMax = Math.max(1, ...keys.filter(k => !label(k)[1]).map(k => cnt[k]));
    let legRank = 0;
    const legRow = k => { const other = label(k)[1]; if (!other) legRank++; const sp = legSpec(k); const pc = Math.round(cnt[k] / rows.length * 1000) / 10;
      return `<li><button type="button" class="rkrow lg" data-f="${esc(k)}" aria-pressed="${filter === k}" style="--cls:${color[k]}"><span class="rkn${!other && legRank <= 3 ? " t" + legRank : ""}">${other ? "–" : legRank}</span>${sp ? icon(sp, 24) : `<span class="dot lgdot" style="--cls:${color[k]}"></span>`}<span class="rkname"><b>${esc(label(k)[0])}</b><small>${cnt[k]}명</small></span><span class="rkbar"><i style="width:${cnt[k] / legMax * 100}%"></i></span><span class="rkpct">${pctTxt(pc)}</span></button></li>`; };
    const leg = `<div class="rlegwrap"><div class="rleg"><button type="button" data-f="" aria-pressed="${!filter}">${reg ? regName(reg) + " 전체" : "전체"} <b>${rows.length}</b></button>${filter ? `<span class="muted lgnote">${esc(label(filter)[0])}만 보는 중 · 전체를 누르면 모두</span>` : `<span class="muted lgnote">항목을 누르면 표에서 그것만 봅니다</span>`}</div><ol class="rklist${keys.length > 10 ? " two" : ""}">${keys.map(legRow).join("")}</ol></div>`;
    // 구성 줄은 짧게: 전문화가 많으면(딜러) 상위 6개 + 나머지 묶음 + 빠진 사유
    const main = keys.filter(k => !label(k)[1]), rest = keys.filter(k => label(k)[1]);
    const head = main.length > 8 ? main.slice(0, 6) : main, tail = main.slice(head.length);
    const rc = {}; all.forEach(r => { rc[r[4]] = (rc[r[4]] || 0) + 1; });
    const regList = XCN() ? [["", "전체", all.length], ["kr", REG.kr, rc.kr || 0], ...["us", "eu", "tw"].map(k => [k, REG[k], rc[k] || 0])]
      : [["", "전체", all.length], ["!cn", "중국 제외", all.length - (rc.cn || 0)], ["kr", REG.kr, rc.kr || 0], ["cn", REG.cn, rc.cn || 0], ...["us", "eu", "tw"].map(k => [k, REG[k], rc[k] || 0])];
    const regRow = `<div class="rleg rreg"><span class="lb">지역 (이 ${all.length}명 안에서)</span>${regList.map(([k, t, n]) => `<button type="button" data-reg="${k}" aria-pressed="${reg === k}"${n ? "" : " disabled"}>${REG[k] ? flag(k) : GLOBE}${t} <b>${n}</b></button>`).join("")}</div>`;
    const lead = KRS() ? `한국 상위 ${all.length}명` : CNS() ? `중국 상위 ${all.length}명` : XCN() ? (reg ? `세계(중국 제외) 상위 ${all.length}명 중 ${regName(reg)} ${rows.length}명` : `세계(중국 제외) 상위 ${all.length}명`) : reg ? `상위 ${all.length}명 중 ${reg === "!cn" ? "중국을 뺀" : regName(reg)} ${rows.length}명` : "";
    const comp = KRS() || CNS() || (XCN() && !reg) ? (KRS() && all.length < (st.by === "spec" ? STOP() : T.top || 500) ? `<p class="comp sub">한국 순위에 점수가 있는 캐릭터가 ${all.length}명뿐입니다. 아래쪽은 점수가 낮은 캐릭터라 비율은 참고만 하세요.</p>` : "") + compLine(rows.length, [...head.map(k => [label(k)[0], cnt[k], 1]), ...(tail.length ? [[`그 밖의 ${tail.length}개 전문화`, tail.reduce((x, k) => x + cnt[k], 0), 1]] : []), ...rest.map(k => [label(k)[0], cnt[k], 1])], lead) : reg && !rows.length ? `<p class="comp">이 순위 상위 ${all.length}명 안에 ${regName(reg)} 캐릭터가 없습니다.</p>` : (reg && rows.length < 30 ? `<p class="comp sub">${reg === "!cn" ? "중국을 빼면" : regName(reg) + "은"} 상위 ${all.length}명 중 ${rows.length}명뿐이라 비율은 참고만 하세요.</p>` : "") + compLine(rows.length, [...head.map(k => [label(k)[0], cnt[k], 1]), ...(tail.length ? [[`그 밖의 ${tail.length}개 전문화`, tail.reduce((x, k) => x + cnt[k], 0), 1]] : []), ...rest.map(k => [label(k)[0], cnt[k], 1])], lead);
    const shown = filter ? rows.filter(r => kOf(r) === filter) : rows;
    const regIx = new Map(rows.map((r, i) => [r, i + 1]));
    const tr = r => `<tr><td class="rk">${Number(r[0])}${XCN() ? `<span class="rs">중국 제외 ${sepIx.get(r)}위</span>` : reg && !KRS() ? `<span class="rs">${esc(regName(reg))} ${regIx.get(r)}위</span>` : ""}</td><td><a href="https://raider.io${esc(r[5])}" target="_blank" rel="noopener" translate="no">${esc(r[2])}</a><span class="rs" translate="no">${flag(r[4])} ${esc(r[3])}</span></td><td><span class="dot" style="--cls:${color[kOf(r)]}"></span>${esc(label(r[6])[0])}</td><td class="num">${Number(r[1]).toFixed(1)}</td></tr>`;
    const colName = st.by === "spec" ? "영웅 특성" : "전문화";
    return `${KRS() || CNS() ? "" : regRow}${rows.length ? bar : ""}${comp}${leg}
      <table class="rtab"><thead><tr><th>${KRS() ? "한국 순위" : CNS() ? "중국 순위" : reg || XCN() ? "세계 순위" : "순위"}</th><th>캐릭터</th><th>${colName}</th><th class="num">점수</th></tr></thead><tbody>${shown.map(tr).join("")}</tbody></table>
      <p class="note">순위와 점수: ${esc(data.src || "Raider.IO")} 2시즌(이번 시즌) 쐐기 점수 순위(${KRS() ? "한국" : CNS() ? "중국" : XCN() ? "전 지역에서 중국 서버를 뺌" : "전 지역"}, ${st.by === "all" ? "역할·직업 구분 없는 전체" : st.by === "spec" ? "전문화" : st.by === "class" ? "직업" : "역할"} 기준) 상위 ${all.length}명, ${esc(data.date || T.date || "")} 확인. 순위는 ${KRS() ? "한국 안 순위" : CNS() ? "중국 안 순위" : "전 세계 순위"}이고, 점수가 0인 캐릭터는 뺐습니다. 캐릭터 이름을 누르면 Raider.IO 프로필이 열립니다.
      ${st.by === "spec" ? "영웅 특성은 그 캐릭터가 지금 켜 둔 특성 코드에서 읽었습니다. 따로 세는 셋: 지금 다른 전문화 특성(코드가 다른 전문화 것), 특성 정보 없음(Raider.IO에 특성 코드가 없음), 영웅 트리 미선택(이 전문화 코드인데 영웅 트리를 고른 칸이 비어 있음)." : "전문화는 그 캐릭터가 지금 켜 둔 전문화입니다."}${st.by === "role" ? " 직업에 이 역할 전문화가 둘 이상인데 지금 다른 역할 전문화를 켜 둔 캐릭터는 '전문화 가를 수 없음'으로 셉니다." : ""}
      <a href="${rioUrl()}" target="_blank" rel="noopener">Raider.IO 원문 ↗</a></p>`;
  };
  const draw = () => {
    app().innerHTML = `<div class="wrap rank">
      <section class="s1-hero"><h1>쐐기 순위표</h1><p>2시즌(이번 시즌) ${KRS() ? "한국" : CNS() ? "중국" : XCN() ? "세계(중국 제외)" : "세계"} 쐐기 점수 상위 ${T.top || 500}명${STOP() !== (T.top || 500) ? `, 전문화별은 상위 ${STOP()}명` : ""} (${esc(T.src || "Raider.IO")}, ${esc(T.date || "")})</p></section>
      ${hasKr() || hasSub() ? `<div class="rkchips"><span class="tlabel">표본</span>${sampleSeg()}</div>` : ""}${pickHtml()}
      <h2 class="rkh">${KRS() ? "한국 " : CNS() ? "중국 " : XCN() ? "세계(중국 제외) " : ""}${esc(title())} 상위 ${data && data.rows ? data.rows.length : T.top || 500}명</h2>
      <div id="rkbody">${bodyHtml()}</div></div>`;
    document.title = `${title()} 쐐기 순위표 · 쐐기 공략`;
  };
  const syncRankUrl = () => history.replaceState(null, "", location.pathname + "?" + (st.by === "all" ? "all" : (st.by === "spec" ? "spec=" : st.by === "class" ? "class=" : "role=") + st.id) + (SEP() ? "&sample=" + SAMPLE : "") + (reg ? "&region=" + encodeURIComponent(reg) : ""));
  const load = async () => {
    const f = fileOf(); data = null; filter = null; draw();
    syncRankUrl();
    try { data = cache[f] || (cache[f] = await J(`data/rank/${f}.json`)); } catch (e) { data = { rows: [] }; }
    if (fileOf() === f) draw();
  };
  reSample = () => { T = M5(); reg = regOfSample(); filter = null; load(); };
  reLang = () => draw();
  app().addEventListener("click", e => {
    const b = e.target.closest("[data-by]"); if (b) { const by = b.dataset.by; if (by === st.by) return; const cs = st.by === "spec" ? BYID[st.id].cls.slug : st.by === "class" ? st.id : (saved ? saved.cls.slug : ROSTER.classes[0].slug);
      if (by === "all") { st.by = "all"; st.id = "all"; }
      else if (by === "role") { st.id = st.by === "spec" && BYID[st.id] ? BYID[st.id].role : (saved ? saved.role : "tank"); st.by = "role"; }
      else if (by === "class") { st.by = "class"; st.id = cs; }
      else { st.by = "spec"; st.id = saved && saved.cls.slug === cs ? saved.id : cs + "/" + CLS[cs].specs[0].slug; }
      return load(); }
    const c = e.target.closest("[data-cls]"); if (c) { const cs = c.dataset.cls; st.id = st.by === "class" ? cs : (saved && saved.cls.slug === cs ? saved.id : cs + "/" + CLS[cs].specs[0].slug); return load(); }
    const i = e.target.closest("[data-id]"); if (i) { st.id = i.dataset.id; return load(); }
    const g = e.target.closest("[data-reg]"); if (g) { reg = g.dataset.reg; filter = null; syncRankUrl(); document.getElementById("rkbody").innerHTML = bodyHtml(); return; }
    const f = e.target.closest("[data-f]"); if (f) { filter = f.dataset.f || null; document.getElementById("rkbody").innerHTML = bodyHtml(); }
  });
  load();
}

// =====================================================================
// 첫 화면 (S1): 역할 → 전문화 → 영웅. 저장된 전문화가 있으면 바로 공략으로
// =====================================================================
const OLD_TABS = ["general", "altar", "vale", "nalorakk", "murder", "voidscar", "kings", "ruby", "temple"];
// 첫 화면: 역할별로 쐐기 상위권이 많이 고른 전문화 3개와 순위표 입구
function homeRankHtml(saved) {
  if (!SPECS.some(roleShareOf)) return "";
  const card = r => { const top = SPECS.filter(s => s.role === r && roleShareOf(s)).sort((x, y) => roleShareOf(y).share - roleShareOf(x).share).slice(0, 3);
    return `<a class="hr-card" href="${rankUrl("role=" + r + SQ())}"><span class="hr-t">${ROLE_ICON[r]} ${ROSTER.roles[r].ko} 순위</span><ol>${top.map(s => `<li>${icon(s, 20)}<span class="n">${esc(specName(s))}</span><b>${pctTxt(roleShareOf(s).share)}</b></li>`).join("")}</ol><span class="more">순위표 보기 ›</span></a>`; };
  const cls = saved ? saved.cls.slug : ROSTER.classes[0].slug;
  return `<section class="home-rank"><div class="hr-head"><h2>쐐기 순위 <span>${SL()}쐐기 점수 상위 ${M5().top || 500}명${SX() ? SX() + " 캐릭터가" : "이"} 고른 전문화</span></h2>${sampleSeg()}</div>
    <div class="hr-grid">${["tank", "healer", "dps"].map(card).join("")}</div>
    <p class="hr-links"><a href="${rankUrl("all" + SQ())}">전체 순위</a> · <a href="${rankUrl("class=" + cls + SQ())}">직업별 순위</a> · <a href="${rankUrl("spec=" + (saved ? saved.id : cls + "/" + ROSTER.classes[0].specs[0].slug) + SQ())}">전문화별 순위</a> · ${esc(M5().src || "Raider.IO")}, ${esc(M5().date || "")}</p></section>`;
}
function selectPage() {
  const q = new URLSearchParams(location.search);
  const saved = BYID[ls.get("wg:spec")];
  const h = location.hash;
  // 첫 화면은 늘 보인다(예전에는 저장된 전문화가 있으면 바로 그 공략으로 넘겼음).
  // 옛 보호 성기사 주소(/#altar 등)로 들어온 경우만 공략으로 넘긴다
  if (!q.has("pick") && OLD_TABS.includes(h.slice(1))) { location.replace(sheetUrl(saved ? saved.id : "paladin/protection", h)); return; }
  // 1단계는 두 갈래: 직업으로 찾기(기본, 게임 캐릭터 선택과 같은 순서) 또는 역할로 찾기
  const CLS = Object.fromEntries(ROSTER.classes.map(c => [c.slug, c]));
  const pick = { by: q.get("by") === "role" ? "role" : "class", role: q.get("role"), cls: q.get("class"), spec: BYID[q.get("spec")] ? q.get("spec") : null };
  if (pick.spec) { const sp = BYID[pick.spec]; pick.role = sp.role; pick.cls = sp.cls.slug; }
  if (!ROSTER.roles[pick.role]) pick.role = null;
  if (!CLS[pick.cls]) pick.cls = null;
  const first = () => pick.by === "class" ? pick.cls : pick.role;
  const roleDesc = { tank: "적을 붙잡고 큰 공격을 받아 냅니다", healer: "파티 체력을 지키고 해제를 맡습니다", dps: "딜과 차단, 우선 처치를 맡습니다" };
  const classSpecs = c => `${c.specs.some(x => specShare(BYID[`${c.slug}/${x.slug}`])) ? smpRow() : ""}<div class="stiles">${c.specs.map(x => BYID[`${c.slug}/${x.slug}`]).map(x => `<a class="stile" href="${sheetUrl(x.id)}" data-spec="${x.id}"${x.id === pick.spec ? ' aria-current="page"' : ""}>${icon(x, 36)}<span><span class="sn">${esc(x.ko)}</span><span class="rl">${ROLE_ICON[x.role]} ${ROSTER.roles[x.role].ko}</span>${specShare(x) ? `<span class="shr"><span class="sbar"><i style="width:${specShare(x).share}%"></i></span><b>${specShare(x).share}%</b> ${specShare(x).n}명</span>` : ""}${x.status === "ready" ? "" : '<span class="badge">준비 중</span>'}</span></a>`).join("")}</div>${c.specs.some(x => BYID[`${c.slug}/${x.slug}`].mplus) ? `<div class="sharenote">${classComp(c)}<p class="note">비율: 2시즌(이번 시즌) ${SL()}${esc(c.ko)} 쐐기 점수 상위 ${M5().top || 500}명${SX() ? SX() + " 캐릭터" : ""}(${esc(M5().src || "Raider.IO")}, ${esc(M5().date || "")})${SX() ? "가" : "이"} 지금 켜 둔 전문화. 전문화를 고르면 아래에서 영웅 특성도 같은 방식(전문화별 상위 ${STOP()}명${SX()})으로 비교합니다. <a href="${rankUrl("class=" + c.slug + SQ())}">${esc(c.ko)} 순위표 ›</a></p></div>` : ""}`;
  const draw = () => {
    const sp = BYID[pick.spec];
    if (sp) setClassColor(sp.cls);
    const c = CLS[pick.cls];
    const chip1 = pick.by === "class"
      ? (c ? `<span class="dot" style="--cls:${c.color}"></span>${esc(c.ko)}` : "직업")
      : (pick.role ? ROLE_ICON[pick.role] + " " + ROSTER.roles[pick.role].ko : "역할");
    const step1 = pick.by === "class"
      ? `<div class="ctiles">${ROSTER.classes.map(x => `<button class="ctile" type="button" data-cls="${x.slug}" aria-pressed="${pick.cls === x.slug}" style="--cls-ink:${x.ink[0]};--cls-ink-d:${x.ink[1]}">${classIcon(x, 34)}<span><span class="cn2">${esc(x.ko)}</span><span class="ce">${esc(x.en)}</span></span></button>`).join("")}</div>`
      : `<div class="tiles">${["tank", "healer", "dps"].map(r => `<button class="tile" type="button" data-role="${r}" aria-pressed="${pick.role === r}"><span class="ro">${ROLE_ICON[r]}</span><span><span class="tt">${ROSTER.roles[r].ko}</span><span class="ts">${roleDesc[r]} · 전문화 ${SPECS.filter(x => x.role === r).length}개</span></span></button>`).join("")}</div>`;
    const step2 = !first() ? "" : pick.by === "class" ? classSpecs(c) : specListHtml(pick.role, pick.spec);
    app().innerHTML = `<div class="summary"><div class="in wrap">
        <span class="sumchip${first() ? "" : " empty"}" data-to="first">${chip1}</span>›
        <span class="sumchip${sp ? "" : " empty"}" data-to="spec">${sp ? `<span class="dot" style="--cls:${sp.cls.color}"></span>${esc(sp.koFull)}` : "전문화"}</span>›
        <span class="sumchip empty">영웅 특성</span>
      </div></div>
      <div class="wrap">
      <section class="s1-hero"><h1>쐐기 공략</h1><p>한밤 2시즌 쐐기 던전 8개를 내 전문화에 맞춰 봅니다. 세 번만 고르면 됩니다. 레이드 공략과 순위는 위쪽 <a href="${raidHubUrl()}"><b>레이드</b></a>에 있습니다.</p></section>
      ${favList().length ? `<section class="favhome"><h2>★ 즐겨찾기</h2><div class="favrow">${favChips("sheet")}</div></section>` : ""}
      ${homeRankHtml(saved)}
      <section class="step" id="st-first"><h2>${pick.by === "class" ? "직업." : "역할."} <span>${pick.by === "class" ? "어떤 직업을 플레이하나요?" : "어떤 역할로 쐐기에 가나요?"}</span></h2>
        <div class="seg byseg" role="group" aria-label="찾는 방법"><button type="button" data-by="class" aria-pressed="${pick.by === "class"}">직업으로 찾기</button><button type="button" data-by="role" aria-pressed="${pick.by === "role"}">역할로 찾기</button></div>
        ${step1}</section>
      <section class="step${first() ? "" : " locked"}" id="st-spec" ${first() ? "" : 'aria-disabled="true"'}><h2>전문화. <span>${pick.by === "class" ? "어떤 전문화인가요?" : "무엇을 플레이하나요?"}</span></h2>${anySoon() ? '<p class="hint">준비 중인 전문화도 고를 수 있습니다. 던전 공략은 바로 볼 수 있습니다.</p>' : ""}
        ${step2}</section>
      <section class="step${sp ? "" : " locked"}" id="st-hero" ${sp ? "" : 'aria-disabled="true"'}><h2>영웅 특성. <span>나중에 바꿔도 됩니다</span></h2><p class="hint">공략의 영웅 카드와 스킬 탭이 이 선택을 따릅니다.</p>
        ${sp ? `${sp.hero500 ? smpRow() : ""}<div class="tiles">${sp.heroes.map(hh => `<button class="tile" type="button" data-hero="${hh.slug}"><span><span class="tt">${esc(hh.ko)}</span><span class="ts">${UI === "en" ? (hh.slug === defaultHero(sp) && sp.defaultHero ? "쐐기 추천" : "") : esc(hh.en) + (hh.slug === defaultHero(sp) && sp.defaultHero ? " · 쐐기 추천" : "")}${heroTop(sp, hh.slug) ? `<br>${SL()}쐐기 상위 ${STOP()}명${SX()} 기준 <b>${heroTop(sp, hh.slug).pct}%</b> (${heroTop(sp, hh.slug).c}명)` : ""}</span></span></button>`).join("")}</div>${sp.hero500 ? `<div class="sharenote">${heroComp(sp)}</div>` : ""}<p class="later">${sp.status === "ready" ? `<a class="cmplink" href="${compareUrl(sp.id)}">두 영웅 특성 비교 ›</a> ` : ""}${sp.hero500 ? `<a class="cmplink" href="${rankUrl("spec=" + sp.id + SQ())}">순위표 ›</a> ` : ""}<a class="cmplink" href="${raidUrl(sp.id)}" data-raid="1">레이드 공략 ›</a> <button class="pill gray" type="button" data-hero="${defaultHero(sp)}">나중에 고를게요 (${esc(ro(heroOf(sp, defaultHero(sp)).ko))} 시작)</button></p>` : ""}</section>
      <p class="s1-foot">고른 전문화는 이 기기에만 저장됩니다. 나중에 공략 위쪽 <b>전문화 변경</b>으로 바꿀 수 있습니다. 전체 목록은 <a href="${BASE}specs/">전문화 목록</a>, 상위 500명은 <a href="${BASE}rank/">쐐기 순위표</a>에 있습니다.<br>전문화 목록과 한글 이름은 게임 데이터(${esc(ROSTER.meta.gameBuild)}) 기준입니다.<br>${UI === "en" ? '<a href="?ui=ko" data-ui="ko" translate="no" lang="ko">한국어</a>' : '<a href="?ui=en" data-ui="en" lang="en">English version</a>'} · 이 사이트는 비공식 팬 제작 공략 사이트이며 Blizzard Entertainment와 관련이 없거나 후원받지 않았습니다. World of Warcraft, Warcraft, Blizzard Entertainment는 미국 및/또는 다른 국가에서 Blizzard Entertainment, Inc.의 상표 또는 등록상표입니다.</p>
      </div>`;
  };
  const syncUrl = () => {
    const parts = ["pick", "by=" + pick.by];
    if (pick.by === "class" && pick.cls) parts.push("class=" + pick.cls);
    if (pick.by === "role" && pick.role) parts.push("role=" + pick.role);
    if (pick.spec) parts.push("spec=" + pick.spec);
    history.replaceState(null, "", location.pathname + "?" + parts.join("&"));
  };
  reSample = () => draw(); reLang = () => draw();
  // 레이드 순위(comp.json)는 따로 받아 오면 다시 그린다(첫 화면이 기다리지 않게)
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const go = id => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); };
  draw();
  app().addEventListener("click", e => {
    const by = e.target.closest("[data-by]");
    if (by) { if (pick.by !== by.dataset.by) { pick.by = by.dataset.by; pick.spec = null; syncUrl(); draw(); } return; }
    const cb = e.target.closest("[data-cls]");
    if (cb) { pick.cls = cb.dataset.cls; if (pick.spec && BYID[pick.spec].cls.slug !== pick.cls) pick.spec = null; syncUrl(); draw(); go("st-spec"); return; }
    const r = e.target.closest("[data-role]");
    if (r) { pick.role = r.dataset.role; if (pick.spec && BYID[pick.spec].role !== pick.role) pick.spec = null; syncUrl(); draw(); go("st-spec"); return; }
    const a = e.target.closest("a[data-spec]");
    if (a) { e.preventDefault(); e.stopPropagation(); pick.spec = a.dataset.spec; syncUrl(); draw(); go("st-hero"); return; }
    const hh = e.target.closest("[data-hero]");
    if (hh) {
      ls.set("wg:spec", pick.spec); ls.set("wg:hero:" + pick.spec, hh.dataset.hero);
      syncUrl();
      location.href = sheetUrl(pick.spec, ls.get("wg:tab") ? "#" + ls.get("wg:tab") : "");
      return;
    }
    const c = e.target.closest("[data-to]");
    if (c) go("st-" + c.dataset.to);
  });
}

// =====================================================================
// 전문화 목록 (/specs/) — 정적 링크는 build.mjs가 만들고, 여기서는 현재 전문화 표시만
// =====================================================================
function specsPage() {
  const saved = ls.get("wg:spec");
  if (saved) document.querySelectorAll(`a[data-spec="${saved}"]`).forEach(a => a.setAttribute("aria-current", "page"));
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
}

// =====================================================================
// 404 (S9): 주소를 로스터와 맞춰 가장 가까운 페이지로
// =====================================================================
function notFoundPage() {
  const dist = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const best = (x, list) => { let b = null, bd = 3; list.forEach(v => { const dd = dist(x, v); if (dd < bd) { bd = dd; b = v; } }); return b; };
  const segs = location.pathname.slice(BASE.length).split("/").filter(Boolean).map(x => decodeURIComponent(x).toLowerCase());
  let target = null;
  const c = segs[0] && best(segs[0], ROSTER.classes.map(x => x.slug));
  if (c) {
    const cls = ROSTER.classes.find(x => x.slug === c);
    const sp = segs[1] && best(segs[1], cls.specs.map(x => x.slug));
    if (sp) {
      const spec = BYID[`${c}/${sp}`];
      const hs = segs[2] && segs[2] !== "compare" ? best(segs[2], spec.heroes.map(h => h.slug)) : null;
      target = hs && spec.status === "ready" ? guideUrl(spec.id, hs) : sheetUrl(spec.id, location.hash);
    }
  }
  app().innerHTML = `<div class="center"><h1>페이지를 찾지 못했습니다</h1><p>${target ? "가장 가까운 페이지로 이동합니다." : "전문화를 다시 골라 주세요."}</p><p><a class="pill" href="${target || BASE + "?pick"}">${target ? "바로 이동" : "전문화 고르기"}</a></p></div>`;
  setTimeout(() => location.replace(target || BASE + "?pick"), target ? 600 : 1500);
}

// ---------- 시작 ----------
Promise.all([J("data/roster.json"), UI === "en" && ls.get("wg:i18nraw") !== "1" ? J0("assets/i18n.en.json").then(startI18n).catch(() => {}) : null]).then(([r]) => {
  indexRoster(r);
  rosterI18n(r);
  favImport();
  paintHeader();
  const run = { sheet: sheetPage, guide: guidePage, compare: comparePage, raid: raidPage, raidhub: raidHubPage, pvp: pvpSpecPage, pvphub: pvpHubPage, pvpmap: pvpMapPage, rank: rankPage, select: selectPage, specs: specsPage, notfound: notFoundPage }[CFG.page];
  return run && run();
}).catch(fail);
})();
