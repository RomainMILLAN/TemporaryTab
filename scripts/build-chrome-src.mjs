/**
 * Dérive le dossier source Chrome depuis `src/` (source de vérité unique).
 *
 * Le manifest canonique est un superset cross-browser. Pour Chrome on retire ce qui lui
 * est inconnu (permissions Firefox + réglages Gecko), afin d'éviter les avertissements
 * « unrecognized permission » et de présenter un manifest propre à la revue Web Store.
 *
 * Usage : node scripts/build-chrome-src.mjs
 */

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "build", "chrome");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true });

const manifestPath = join(OUT, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// 1) Background : service worker uniquement (Chrome ignore `scripts`, on nettoie).
if (manifest.background) {
  delete manifest.background.scripts;
}

// 2) Permissions : retirer les API propres à Firefox.
const FIREFOX_ONLY = new Set(["contextualIdentities", "cookies"]);
if (Array.isArray(manifest.permissions)) {
  manifest.permissions = manifest.permissions.filter((p) => !FIREFOX_ONLY.has(p));
}

// 3) Réglages Gecko : inutiles sous Chrome.
delete manifest.browser_specific_settings;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Source Chrome généré dans", OUT, "(scripts/contextualIdentities/cookies/gecko retirés)");
