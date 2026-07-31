// Generate PWA PNG icons with no dependencies (raw RGBA -> zlib -> PNG chunks).
// Run: node tools/gen-icons.mjs   (writes icon-192.png, icon-512.png, apple-touch-icon-180.png)
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// CRC32 (PNG)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// draw color at (x,y) -> [r,g,b,a]
function pixel(x, y, S) {
  const cx = S / 2, cy = S / 2;
  // diamond: |dx|/rx + |dy|/ry <= 1
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  const rOuter = S * 0.34, rInner = S * 0.17;
  const dOuter = dx / rOuter + dy / rOuter;
  const dInner = dx / rInner + dy / rInner;
  if (dOuter <= 1 && dInner > 1) {
    // gradient indigo -> cyan across the diamond
    const tg = (x + y) / (2 * S);
    const r = Math.round(0x63 + (0x22 - 0x63) * tg);
    const g = Math.round(0x66 + 0xd3 - 0x66 + (0 * tg)); // approx
    const gg = Math.round(0x66 + (0xd3 - 0x66) * tg);
    const b = Math.round(0xf1 + (0xee - 0xf1) * tg);
    return [r, gg, b, 255];
  }
  // background
  return [0x0b, 0x10, 0x20, 255];
}

function makePNG(S) {
  const stride = S * 4 + 1;
  const raw = Buffer.alloc(stride * S);
  for (let y = 0; y < S; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < S; x++) {
      const [r, g, b, a] = pixel(x, y, S);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon-180.png', 180]]) {
  fs.writeFileSync(path.join(ROOT, name), makePNG(size));
  console.log('wrote', name, size + 'x' + size);
}
