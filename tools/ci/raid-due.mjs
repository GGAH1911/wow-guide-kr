// 이번 수집에서 레이드 순위(raid-comp.mjs)를 새로 받을지 정한다. 출력: 1(받음) | 0(지난 파일 유지)
// RAID=yes|no 로 강제(수동 실행 입력). auto(기본): 한국 시각 목요일(한국·대만·중국 주간 초기화 08:00 직전) 이거나,
// 지난 파일이 없거나 8일 넘게 묵었으면(지난 목요일 수집이 실패한 경우) 받는다.
import fs from 'node:fs';
const mode = (process.env.RAID || 'auto').toLowerCase();
if (mode === 'yes' || mode === '1' || mode === 'true') { console.log(1); process.exit(0); }
if (mode === 'no' || mode === '0' || mode === 'false') { console.log(0); process.exit(0); }
const f = process.argv[2] || 'data/raid/comp.json';
let age = Infinity; try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); if (c.progress && c.bosses) age = (Date.now() - Date.parse(c.fetched)) / 864e5; } catch (e) {}
const kstDay = new Date(Date.now() + 9 * 3600e3).getUTCDay(); // 4 = 목요일
console.error(`raid-due: KST 요일 ${kstDay}, 지난 파일 ${Number.isFinite(age) ? age.toFixed(1) + '일 전' : '없음/옛 형식'}`);
console.log(kstDay === 4 || age > 8 ? 1 : 0);
