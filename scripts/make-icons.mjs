// Genera le icone PNG della PWA senza dipendenze esterne (encoder PNG minimale con zlib).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const S = 4; // supersampling
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = (a / (S * S)) * 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const BG = [22, 24, 28], ACC = [63, 140, 255], FG = [240, 243, 247];
const inRR = (u, v, x0, y0, x1, y1, r) => {
  const cx = Math.max(x0 + r, Math.min(u, x1 - r)), cy = Math.max(y0 + r, Math.min(v, y1 - r));
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r && u >= x0 && u <= x1 && v >= y0 && v <= y1;
};
// Manubrio stilizzato: barra + due coppie di dischi, scala k (zona sicura maskable).
const glyph = (u, v, k) => {
  const t = (p) => 0.5 + (p - 0.5) * k;
  if (inRR(u, v, t(0.22), t(0.47), t(0.78), t(0.53), 0.01)) return true;
  for (const [x0, x1, y0, y1] of [[0.2, 0.28, 0.3, 0.7], [0.72, 0.8, 0.3, 0.7], [0.12, 0.19, 0.37, 0.63], [0.81, 0.88, 0.37, 0.63]])
    if (inRR(u, v, t(x0), t(y0), t(x1), t(y1), 0.025 * k)) return true;
  return false;
};
const normal = (u, v) => {
  if (!inRR(u, v, 0.04, 0.04, 0.96, 0.96, 0.22)) return [0, 0, 0, 0];
  if (glyph(u, v, 1)) return [...FG, 1];
  return inRR(u, v, 0.1, 0.1, 0.9, 0.9, 0.17) ? [...ACC, 1] : [...BG, 1];
};
const maskable = (u, v) => (glyph(u, v, 0.72) ? [...FG, 1] : [...ACC, 1]);
mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, normal));
writeFileSync('public/icons/icon-512.png', png(512, normal));
writeFileSync('public/icons/icon-maskable-512.png', png(512, maskable));
writeFileSync('public/icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="22" fill="#3f8cff"/><rect x="22" y="47" width="56" height="6" rx="1" fill="#f0f3f7"/><rect x="20" y="30" width="8" height="40" rx="2.5" fill="#f0f3f7"/><rect x="72" y="30" width="8" height="40" rx="2.5" fill="#f0f3f7"/><rect x="12" y="37" width="7" height="26" rx="2.5" fill="#f0f3f7"/><rect x="81" y="37" width="7" height="26" rx="2.5" fill="#f0f3f7"/></svg>`);
console.log('icone generate');
