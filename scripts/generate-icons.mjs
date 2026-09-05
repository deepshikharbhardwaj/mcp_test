// One-off PNG icon generator for the PWA manifest. No image libraries
// available/needed — writes raw PNG bytes directly (solid background +
// a centered circle "compass dot" in the app's accent color).
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { crc32 } from "node:zlib";

const BG = [0x1c, 0x1a, 0x17]; // ink
const FG = [0xa8, 0x56, 0x2f]; // accent

function makePng(size, opts = {}) {
  const { padding = 0 } = opts;
  const width = size;
  const height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const usable = (width - padding * 2) / 2;
  const r = usable * 0.55;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isDot = dist < r;
      const [r8, g8, b8] = isDot ? FG : BG;
      const off = rowStart + 1 + x * 4;
      raw[off] = r8;
      raw[off + 1] = g8;
      raw[off + 2] = b8;
      raw[off + 3] = 255;
    }
  }

  const idatData = deflateSync(raw);

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", makePng(192, { padding: 0 }));
writeFileSync("public/icons/icon-512.png", makePng(512, { padding: 0 }));
writeFileSync("public/icons/maskable-512.png", makePng(512, { padding: 64 }));
writeFileSync("public/icons/apple-touch-icon.png", makePng(180, { padding: 0 }));
console.log("Icons generated in public/icons/");
