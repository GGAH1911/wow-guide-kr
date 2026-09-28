// 페이지 셸 생성기. data/roster.json 과 data/spec/*.json 을 읽어 정적 HTML 을 만든다.
// 사용법: node tools/build.mjs   (Node 내장 모듈만 사용, 결과물은 커밋해서 GitHub Pages 가 그대로 서빙)
// 만드는 것: index.html(S1), specs/index.html(S5 단독), <직업>/<전문화>/index.html ×40(S2·S7),
//           <직업>/<전문화>/<영웅>/index.html(S3, 준비된 전문화만), 404.html(S9), guides/*.html(S8 옛 주소)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const wr = (p, s) => { const f = path.join(ROOT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); written.push(p); };
const written = [];
const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const R = rd('data/roster.json');
const SPECS = R.classes.flatMap(c => c.specs.map(s => ({ ...s, id: `${c.slug}/${s.slug}`, cls: c })));
const FONT = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const up = depth => depth ? '../'.repeat(depth) : './';

function head({ title, base, wg, desc, extra = '' }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">\n` : ''}<meta name="color-scheme" content="light dark">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="${FONT}">
<link rel="stylesheet" href="${base}assets/app.css">
<script>window.WG=${JSON.stringify({ ...wg, base })}</script>
<script src="${base}assets/app.js" defer></script>
${extra}</head>`;
}
const loading = `<div id="app"><div class="wrap loading">불러오는 중…</div></div>`;
const noscript = base => `<noscript><div class="wrap"><p>이 페이지는 JavaScript가 필요합니다. <a href="${base}specs/">전문화 목록</a>에서 정적 링크로 이동할 수 있습니다.</p></div></noscript>`;

// ---- S1 첫 화면 ----
wr('index.html', `${head({ title: '쐐기 공략 · 한밤 2시즌', base: './', wg: { page: 'select' }, desc: '한밤 2시즌 쐐기 던전 8개를 역할과 전문화에 맞춰 보는 공략' })}
<body>${loading}${noscript('./')}</body>
</html>
`);

// ---- 전문화 목록 (JS 없이도 40개 링크) ----
const ROLE = { tank: '탱커', healer: '힐러', dps: '딜러' };
const icon = s => `<span class="ico${s.cls.token === 'PRIEST' || s.cls.token === 'ROGUE' ? ' light' : ''}" style="--c:${s.cls.color}" aria-hidden="true"><img src="https://wow.zamimg.com/images/wow/icons/large/${s.icon}.jpg" alt="" loading="lazy"></span>`;
const badge = s => s.status === 'ready' ? '' : '<span class="badge">준비 중</span>';
const specsBody = ['tank', 'healer', 'dps'].map(r => {
  const list = SPECS.filter(s => s.role === r);
  const inner = r !== 'dps'
    ? `<div class="stiles">${list.map(s => `<a class="stile" href="../${s.id}/" data-spec="${s.id}">${icon(s)}<span><span class="sn">${esc(s.koFull)}</span>${badge(s)}</span></a>`).join('')}</div>`
    : R.classes.map(c => [c, list.filter(s => s.cls === c)]).filter(([, l]) => l.length).map(([c, l]) => `<div class="clsrow" style="--cls-ink:${c.ink[0]};--cls-ink-d:${c.ink[1]}"><div class="cn"><span class="dot" style="--cls:${c.color}"></span>${esc(c.ko)}</div><div class="chips">${l.map(s => `<a class="chip${s.status === 'ready' ? '' : ' soon'}" href="../${s.id}/" data-spec="${s.id}">${icon(s)}${esc(s.ko)}${badge(s)}</a>`).join('')}</div></div>`).join('');
  return `<section id="${r}"><h2>${ROLE[r]} ${list.length}</h2>${inner}</section>`;
}).join('\n');
wr('specs/index.html', `${head({ title: '전문화 목록 · 쐐기 공략', base: '../', wg: { page: 'specs' } })}
<body class="specs-page"><div class="wrap">
<section class="s1-hero"><h1>전문화 목록</h1><p>13개 직업, 40개 전문화입니다. 고르면 그 전문화의 공략이 열리고, 이 기기에 내 전문화로 저장됩니다.</p></section>
${specsBody}
<p class="s1-foot">목록과 한글 이름은 게임 데이터(${esc(R.meta.gameBuild)}) 기준입니다. <a href="../?pick">역할부터 차례로 고르기</a></p>
</div></body>
</html>
`);

// ---- 전문화 공략 셸 ×40 ----
for (const s of SPECS) {
  wr(`${s.id}/index.html`, `${head({ title: `${s.koFull} · 쐐기 공략`, base: up(2), wg: { page: 'sheet', spec: s.id }, desc: `${s.koFull}(${s.enFull}) 한밤 2시즌 쐐기 던전 공략` })}
<body>${loading}${noscript(up(2))}</body>
</html>
`);
}

// ---- 레이드 공략 셸 ×40 (/<직업>/<전문화>/raid/, data/raid/*) ----
for (const s of SPECS) {
  wr(`${s.id}/raid/index.html`, `${head({ title: `${s.koFull} · 레이드 공략`, base: up(3), wg: { page: 'raid', spec: s.id }, desc: `${s.koFull}(${s.enFull}) 한밤 2시즌 레이드 맹독 심연 보스 공략(일반·영웅·신화)` })}
<body>${loading}${noscript(up(3))}</body>
</html>
`);
}

// ---- 쐐기 순위표 (/rank/, data/rank/*.json) ----
wr('rank/index.html', `${head({ title: '쐐기 순위표 · 쐐기 공략', base: '../', wg: { page: 'rank' }, desc: '한밤 2시즌 쐐기 점수 상위 500명(Raider.IO)을 역할별·직업별·전문화별로 보고 전문화·영웅 특성 구성을 확인' })}
<body>${loading}${noscript('../')}</body>
</html>
`);

// ---- PvP 셸 ×40 (/<직업>/<전문화>/pvp/, data/pvp/*) ----
for (const s of SPECS) {
  wr(`${s.id}/pvp/index.html`, `${head({ title: `${s.koFull} · PvP`, base: up(3), wg: { page: 'pvp', spec: s.id }, desc: `${s.koFull}(${s.enFull}) 한밤 2시즌 PvP: 1인 조합전·전장 대공세·투기장 상위권의 추천 빌드, 영웅 특성, PvP 특성, 순위` })}
<body>${loading}${noscript(up(3))}</body>
</html>
`);
}

// ---- 쐐기 순위표 (/rank/, data/rank/*.json) ----
wr('rank/index.html', `${head({ title: '쐐기 순위표 · 쐐기 공략', base: '../', wg: { page: 'rank' }, desc: '한밤 2시즌 쐐기 점수 상위 500명(Raider.IO)을 역할별·직업별·전문화별로 보고 전문화·영웅 특성 구성을 확인' })}
<body>${loading}${noscript('../')}</body>
</html>
`);

// ---- PvP 전장·투기장 공략 (/pvp/map/?m=<장소>, data/pvp/maps.json) ----
wr('pvp/map/index.html', `${head({ title: 'PvP 전장·투기장 공략', base: '../../', wg: { page: 'pvpmap' }, desc: '한밤 2시즌 전장(전장 대공세·평점제 전장)과 투기장 장소별 공략: 목표, 배치, 역할별 할 일' })}
<body>${loading}${noscript('../../')}</body>
</html>
`);
// ---- PvP 홈 (/pvp/, data/pvp/*) ----
wr('pvp/index.html', `${head({ title: 'PvP · 순위와 빌드', base: '../', wg: { page: 'pvphub' }, desc: '한밤 2시즌 평점제 PvP(1인 조합전·전장 대공세·3v3·2v2 투기장·평점제 전장) 블리자드 공식 순위 기준 전문화 비율, 추천 빌드, 순위표' })}
<body>${loading}${noscript('../')}</body>
</html>
`);

// ---- 레이드 순위 (/raid/, data/raid/comp.json) ----
wr('raid/index.html', `${head({ title: '레이드 · 공략과 순위', base: '../', wg: { page: 'raidhub' }, desc: '한밤 레이드 공략(2시즌·이번 시즌 맹독 심연, 1시즌 레이드 4개)과 신화 상위 공격대(Raider.IO)의 전문화 채용, 쐐기·레이드 영웅 특성 비교, 진행 현황, 주간 초기화' })}
<body>${loading}${noscript('../')}</body>
</html>
`);

// ---- 영웅 특성 비교 (S4, 준비된 전문화) ----
for (const s of SPECS.filter(x => x.status === 'ready')) {
  wr(`${s.id}/compare/index.html`, `${head({ title: `${s.koFull} 영웅 특성 비교 · 쐐기 공략`, base: up(3), wg: { page: 'compare', spec: s.id }, desc: `${s.koFull} 두 영웅 특성을 쐐기 상위 500명 사용 비율과 운영 요점으로 비교` })}
<body>${loading}${noscript(up(3))}</body>
</html>
`);
}

// ---- 스킬 가이드 (준비된 전문화) ----
const coreEn = rd('data/core/spells.en.json');
for (const s of SPECS.filter(x => x.status === 'ready')) {
  const sp = rd(`data/spec/${s.id.replace('/', '-')}.json`);
  const gf = `data/spec/${s.id.replace('/', '-')}.guide.json`;
  if (!fs.existsSync(path.join(ROOT, gf))) continue;
  sp.guide = rd(gf);
  const enGf = `data/spec/en/${s.id.replace('/', '-')}.guide.json`;
  const enGuide = fs.existsSync(path.join(ROOT, enGf)) ? rd(enGf) : null;
  const enSp = fs.existsSync(path.join(ROOT, `data/spec/en/${s.id.replace('/', '-')}.json`)) ? rd(`data/spec/en/${s.id.replace('/', '-')}.json`) : sp;
  const EN = { ...coreEn, ...sp.spells, ...sp.guide.en };
  for (const h of s.heroes) {
    const g = sp.guide.heroes[h.slug]; if (!g) continue;
    const base = up(3);
    const ids = new Set();
    const body = GD => { const g = GD.heroes[h.slug];
    const card = i => {
      const c = GD.cards[i]; ids.add(String(c.id));
      const e = EN[c.id];
      return `<div class="skill-card" data-sid="${c.id}"><div class="icon-slot">${e ? `<img src="https://wow.zamimg.com/images/wow/icons/large/${e.i}.jpg" alt="" loading="lazy">` : ''}</div><div class="info"><div class="name">${c.name}${c.badges.map(b => `<span class="badge ${b.cls}">${b.text}</span>`).join('')}</div><div class="kname"></div><div class="desc">${c.desc}</div></div></div>`;
    };
    const grid = list => `<div class="skill-grid">${list.map(card).join('')}</div>`;
    const sections = g.sections.map(x => `<section class="tier"${x.id ? ` id="${x.id}"` : ''}><h2 class="tier-header">${x.title}${x.note ? ` <span class="count">${x.note}</span>` : ''}</h2>
${x.groups ? x.groups.map(gr => `<div class="subcat"><div class="subcat-title">${gr.title}</div>${grid(gr.cards)}</div>`).join('\n') : x.cards ? grid(x.cards) : ''}
${x.html || ''}</section>`).join('\n');
    return `<section class="ghero wrap"><p class="eb">${esc(s.koFull)} 스킬</p><h1>${esc(h.en)}</h1>
<p class="lead">${esc(g.subtitle)} 기준으로, 누르는 기술을 사용 시점별로 모았습니다. 기술 카드를 누르면 게임 툴팁이 나옵니다.</p>
<div class="seg" role="group" aria-label="영웅 특성">${heroSeg}</div>
${s.hero500 && s.hero500.n && s.hero500.counts[h.slug] != null ? `<p class="gtop">쐐기 상위 500명 기준 <b>${Math.round(s.hero500.counts[h.slug] / s.hero500.n * 100)}%</b>(${s.hero500.counts[h.slug]}명)가 이 영웅 특성을 골랐습니다${(() => { const p = (o, t) => o && o.hero500 && o.hero500.n ? `${t} <b>${Math.round((o.hero500.counts[h.slug] || 0) / o.hero500.n * 100)}%</b>(${o.hero500.counts[h.slug] || 0}명)` : ''; const l = [p(s.xcn, '세계(중국 제외)'), p(s.kr, `한국 상위 ${(R.meta.mplus500kr || {}).specTop || 500}명`), p(s.cn, '중국')].filter(Boolean); return l.length ? ` <span class="gsub">(${l.join(' · ')})</span>` : ''; })()} <span class="muted">(${esc(R.meta.mplus500.src)}, ${esc(R.meta.mplus500.date)})</span> · <a class="cmplink" href="../compare/">두 영웅 특성 비교 ›</a> · <a class="cmplink" href="${base}rank/?spec=${s.id}">순위표 ›</a></p>` : ''}
<div class="lk"><a href="#builds">특성 빌드 코드 (레이드·쐐기·구렁) ↓</a>${sp.guide.pdf && sp.guide.pdf[h.slug] ? `<a href="${base}${sp.guide.pdf[h.slug]}" download>A4 PDF</a>` : ''}<a href="#" id="print" onclick="return false">인쇄</a><span id="langslot"></span></div>
</section>
<div class="wrap">
${sections}
<p class="gfoot">기술 설명과 툴팁은 Wowhead 공식 데이터(${esc(sp.patch)})를 따릅니다. 갱신 ${esc(sp.updated)}.</p>
</div>
`; };
    const heroSeg = s.heroes.map(x => `<a href="../${x.slug}/" data-hero-go${x.slug === h.slug ? ' aria-current="page"' : ''}>${esc(x.en)}</a>`).join('');
    const koBody = body(sp.guide), enBody = enGuide ? body(enGuide) : '';
    const G = { en: {}, ko: {}, koExtra: g.koExtra };
    ids.forEach(id => { if (EN[id]) G.en[id] = EN[id]; if (sp.guide.ko[id]) G.ko[id] = sp.guide.ko[id]; });
    wr(`${s.id}/${h.slug}/index.html`, `${head({ title: `${s.koFull} ${h.ko} 스킬`, base, wg: { page: 'guide', spec: s.id, hero: h.slug }, desc: `${s.koFull} ${h.ko}(${h.en}) 빌드 기술을 사용 시점별로 정리` })}
<body>
<div id="top"><header class="lnav"><div class="in wrap"><a href="../">← ${esc(s.koFull)} 공략</a></div></header></div>
<main id="gbody">
${koBody}</main>${enBody ? `\n<template id="gbody-en">${enBody}</template>` : ''}
<script>window.GUIDE=${JSON.stringify(G)}</script>
</body>
</html>
`);
  }
}

// ---- 404 (주소 앞부분을 모르므로 스크립트로 기준 경로를 정한다) ----
wr('404.html', `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>페이지를 찾지 못했습니다 · 쐐기 공략</title>
<link rel="stylesheet" href="${FONT}">
<script>(function(){var m=location.pathname.match(/^\\/[^\\/]+\\//);var b=(/\\.github\\.io$|^localhost$|^127\\./.test(location.hostname)&&m)?m[0]:"/";window.WG={page:"notfound",base:b};document.write('<link rel="stylesheet" href="'+b+'assets/app.css"><script src="'+b+'assets/app.js" defer><\\/script>');})();</script>
</head>
<body>${loading}</body>
</html>
`);

// ---- 옛 가이드 주소 (S8) ----
for (const h of ['templar', 'lightsmith']) {
  const to = `../paladin/protection/${h}/`;
  wr(`guides/${h}.html`, `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>새 주소로 이동합니다</title>
<meta http-equiv="refresh" content="0; url=${to}">
<link rel="canonical" href="${to}">
<script>location.replace("${to}"+location.hash)</script>
</head>
<body><p>스킬 화면 주소가 바뀌었습니다. <a href="${to}">새 주소로 이동</a></p></body>
</html>
`);
}
console.log(`${written.length} files`);
