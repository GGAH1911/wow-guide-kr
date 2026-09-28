// WoW 특성 가져오기 코드(loadout) 해독: 헤더(버전 8비트, 전문화 ID 16비트, 트리 해시 128비트) 뒤로
// 노드마다 [선택 1][구매 1][부분 순위 1 (+순위 6)][선택형 1 (+선택지 2)] 가 이어진다(비트는 6비트 글자 안에서 낮은 쪽부터).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function decode(code) {
  const vals = [...code].map(c => B64.indexOf(c)); if (vals.some(v => v < 0)) return null;
  let pos = 0; const total = vals.length * 6;
  const read = n => { let v = 0; for (let i = 0; i < n; i++) { const p = pos + i; const bit = (vals[p / 6 | 0] >> (p % 6)) & 1; v |= bit << i; } pos += n; return v; };
  const version = read(8), specId = read(16); for (let i = 0; i < 16; i++) read(8);
  const nodes = [];
  while (pos < total - 1) {
    const sel = read(1); if (!sel) { nodes.push(0); continue; }
    const purchased = read(1); let v = 1; // 1 = 무료로 켜짐(granted)
    if (purchased) { v = 2; if (read(1)) v += read(6) * 0; if (read(1)) v = 10 + read(2); }
    nodes.push(v);
  }
  return { version, specId, nodes, code };
}
