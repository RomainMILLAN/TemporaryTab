/**
 * Génère les icônes PNG de l'extension (motif « Ghost Tab ») sans dépendance externe.
 *
 * Tuile indigo arrondie + symbole « onglet » blanc centré. Le haut de l'onglet est :
 *   - en CONTOUR POINTILLÉ pour 48 et 128 px (Ghost : l'éphémère),
 *   - PLEIN pour 16 et 32 px (le pointillé n'est plus lisible à cette échelle).
 *
 * Le rendu se fait par champ de distance signé (SDF) d'un rectangle arrondi, ce qui
 * donne des bords nets et un léger anticrénelage. Encodage PNG maison via `zlib`.
 *
 * Usage : node scripts/make-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "icons");
// 16/32 → version pleine ; 48/128 → version pointillée.
const SIZES = [
  { size: 16, dashed: false },
  { size: 32, dashed: false },
  { size: 48, dashed: true },
  { size: 128, dashed: true },
];

const INDIGO = [91, 77, 245];
const WHITE = [255, 255, 255];

// ---------- Encodage PNG (RGBA 8 bits) ----------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Géométrie : SDF d'un rectangle arrondi ----------

// Distance signée d'un point (px,py) au rectangle arrondi centré (cx,cy), demi-tailles
// (hw,hh) et rayon r. Négative à l'intérieur.
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// Couverture 0..1 avec ~1px d'anticrénelage (intérieur = sd <= 0).
const coverage = (sd) => Math.min(Math.max(0.5 - sd, 0), 1);

function makePixels(size, dashed) {
  const px = Buffer.alloc(size * size * 4);

  // Repère du symbole : viewBox 0..32 mappé sur ~58% de la tuile, centré.
  const markSpan = size * 0.58;
  const scale = markSpan / 32;
  const off = (size - markSpan) / 2;
  const U = (u) => off + u * scale; // unité SVG -> pixel

  // Corps de l'onglet : rect x3 y12.5 w26 h16.5 rx4.6
  const body = { cx: U(16), cy: U(20.75), hw: (13) * scale, hh: (8.25) * scale, r: 4.6 * scale };
  // Languette : dashed → x3.1 y4.2 w13.4 h11 rx3.4 ; solid → x3 y4.6 w12.6 h10.4 rx3
  const top = dashed
    ? { cx: U(9.8), cy: U(9.7), hw: 6.7 * scale, hh: 5.5 * scale, r: 3.4 * scale }
    : { cx: U(9.3), cy: U(9.8), hw: 6.3 * scale, hh: 5.2 * scale, r: 3 * scale };
  const strokeW = 2.1 * scale;
  const dashPeriod = 2.65 * scale; // dasharray 2.6/2.7

  const tile = { cx: size / 2, cy: size / 2, hw: size / 2, hh: size / 2, r: size * 0.23 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tileCov = coverage(sdRoundRect(x, y, tile.cx, tile.cy, tile.hw, tile.hh, tile.r));
      const i = (y * size + x) * 4;
      if (tileCov <= 0) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
        continue;
      }

      // Couverture du symbole blanc.
      let markCov = coverage(sdRoundRect(x, y, body.cx, body.cy, body.hw, body.hh, body.r));

      const sdTop = sdRoundRect(x, y, top.cx, top.cy, top.hw, top.hh, top.r);
      if (dashed) {
        // Anneau (contour) de la languette, en tirets.
        const onRing = Math.abs(sdTop) <= strokeW / 2 ? 1 : 0;
        if (onRing) {
          // Bord dominant : horizontal (haut/bas) → tirets selon x ; sinon selon y.
          const remX = top.hw - Math.abs(x - top.cx);
          const remY = top.hh - Math.abs(y - top.cy);
          const t = remY < remX ? x : y; // bord horizontal si on est près du haut/bas
          const on = Math.floor(t / dashPeriod) % 2 === 0 ? 1 : 0;
          markCov = Math.max(markCov, on);
        }
      } else {
        markCov = Math.max(markCov, coverage(sdTop));
      }

      // Mélange blanc sur indigo, le tout masqué par la tuile.
      const m = Math.min(markCov, 1);
      px[i] = Math.round(INDIGO[0] + (WHITE[0] - INDIGO[0]) * m);
      px[i + 1] = Math.round(INDIGO[1] + (WHITE[1] - INDIGO[1]) * m);
      px[i + 2] = Math.round(INDIGO[2] + (WHITE[2] - INDIGO[2]) * m);
      px[i + 3] = Math.round(tileCov * 255);
    }
  }
  return px;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { size, dashed } of SIZES) {
  const png = encodePng(size, makePixels(size, dashed));
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), png);
  console.log(`icon-${size}.png (${png.length} octets, ${dashed ? "pointillé" : "plein"})`);
}
console.log("Icônes générées dans", OUT_DIR);
