// 쐐기 상위 500명 수치를 roster 와 분리해 data 브랜치에 둔다.
//   node tools/ci/stats.mjs extract <out.json>   roster.json 의 수치만 뽑아 stats.json 으로
//   node tools/ci/stats.mjs merge <stats.json>   stats.json 을 roster.json 에 다시 넣는다(코드 쪽 roster 변경은 그대로 둠)
// 수치: 전문화마다 mplus·hero500·roleShare(세계)와 kr·xcn·cn(표본별 같은 구조), meta.mplus500·mplus500kr·mplus500xcn·mplus500cn
import fs from 'node:fs';
const ROOT = new URL('../../', import.meta.url).pathname; const RP = ROOT + 'data/roster.json';
const SPEC_KEYS = ['mplus', 'hero500', 'roleShare', 'kr', 'xcn', 'cn'];
const META_KEYS = ['mplus500', 'mplus500kr', 'mplus500xcn', 'mplus500cn'];
const [cmd, file] = process.argv.slice(2);
const R = JSON.parse(fs.readFileSync(RP, 'utf8'));
if (cmd === 'extract') {
  const out = { meta: {}, specs: {} };
  for (const k of META_KEYS) if (R.meta[k]) out.meta[k] = R.meta[k];
  for (const c of R.classes) for (const s of c.specs) { const o = {}; for (const k of SPEC_KEYS) if (s[k] !== undefined) o[k] = s[k]; out.specs[`${c.slug}/${s.slug}`] = o; }
  fs.writeFileSync(file, JSON.stringify(out) + '\n'); console.log('stats', Object.keys(out.specs).length, 'specs,', Object.keys(out.meta).join(' '));
} else if (cmd === 'merge') {
  const S = JSON.parse(fs.readFileSync(file, 'utf8')); let n = 0;
  for (const k of META_KEYS) if (S.meta[k]) R.meta[k] = S.meta[k];
  for (const c of R.classes) for (const s of c.specs) { const o = S.specs[`${c.slug}/${s.slug}`]; if (!o) continue; for (const k of SPEC_KEYS) if (o[k] !== undefined) s[k] = o[k]; n++; }
  fs.writeFileSync(RP, JSON.stringify(R) + '\n'); console.log('merged', n, 'specs, date', (S.meta.mplus500 || {}).date);
} else { console.error('usage: stats.mjs extract|merge <file>'); process.exit(1); }
