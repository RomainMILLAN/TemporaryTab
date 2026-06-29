/**
 * Génère les icônes PNG de l'extension sans aucune dépendance externe.
 *
 * On encode le PNG à la main (en-tête + chunks IHDR/IDAT/IEND, compression via
 * le module `zlib` natif de Node). Le motif : un carré au coin arrondi sur fond
 * dégradé bleu, avec une petite "flèche retour" évoquant le retour au parent.
 *
 * Usage : node scripts/make-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "icons");
const SIZES = [16, 48, 128];

// --- Encodage PNG minimal (couleur RGBA, 8 bits) ---

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10-12 : compression/filter/interlace = 0

  // Chaque ligne est préfixée d'un octet de filtre (0 = aucun).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Dessin du motif ---

function makePixels(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.18; // rayon des coins arrondis
  const cx = size / 2;
  const cy = size / 2;

  const set = (x, y, [red, green, blue, alpha]) => {
    const i = (y * size + x) * 4;
    px[i] = red;
    px[i + 1] = green;
    px[i + 2] = blue;
    px[i + 3] = alpha;
  };

  const inRoundedRect = (x, y) => {
    const minX = r, maxX = size - r, minY = r, maxY = size - r;
    const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
    const dy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
    return dx * dx + dy * dy <= r * r;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y)) {
        set(x, y, [0, 0, 0, 0]); // transparent hors du badge
        continue;
      }
      // Dégradé bleu vertical (#3b82f6 -> #1d4ed8).
      const t = y / size;
      const red = Math.round(59 + (29 - 59) * t);
      const green = Math.round(130 + (78 - 130) * t);
      const blue = Math.round(246 + (216 - 246) * t);
      set(x, y, [red, green, blue, 255]);

      // Flèche "retour" blanche (chevron <-) centrée.
      const nx = (x - cx) / size; // -0.5..0.5
      const ny = (y - cy) / size;
      const onChevron =
        Math.abs(Math.abs(ny) + nx + 0.06) < 0.07 && nx > -0.22 && nx < 0.14 && Math.abs(ny) < 0.2;
      const onShaft = ny > -0.05 && ny < 0.05 && nx > -0.06 && nx < 0.2;
      if (onChevron || onShaft) {
        set(x, y, [255, 255, 255, 255]);
      }
    }
  }
  return px;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(size, makePixels(size));
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), png);
  console.log(`icon-${size}.png (${png.length} octets)`);
}
console.log("Icônes générées dans", OUT_DIR);
