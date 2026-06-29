/**
 * Dérive le dossier source Firefox depuis `src/` (source de vérité unique).
 *
 * Le manifest canonique (`src/manifest.json`) porte une clé `background` à double
 * entrée (`service_worker` pour Chrome + `scripts` pour Firefox) : pratique pour
 * charger l'extension non empaquetée dans les deux navigateurs. Mais l'addons-linter
 * de Mozilla (exécuté lors de `web-ext lint` / `web-ext sign`) signale
 * `background.service_worker` comme non supporté. On produit donc une copie « propre »
 * dans `build/firefox/` où ce champ est retiré.
 *
 * Usage : node scripts/build-firefox-src.mjs
 */

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "build", "firefox");

// Repartir d'un dossier propre.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Copier tout le source (background.js, icons/, …).
cpSync(SRC, OUT, { recursive: true });

// Réécrire le manifest sans la clé service_worker.
const manifestPath = join(OUT, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.background?.service_worker) {
  delete manifest.background.service_worker;
}
// Sécurité : Firefox a besoin de `scripts`.
if (!manifest.background?.scripts) {
  throw new Error("Le manifest Firefox doit définir background.scripts");
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Source Firefox généré dans", OUT, "(service_worker retiré)");
