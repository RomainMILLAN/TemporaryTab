/**
 * settings.js — SOURCE UNIQUE DE VÉRITÉ des réglages.
 *
 * Script classique (pas un module ES) : il s'expose via `globalThis.Settings`, de sorte
 * qu'il fonctionne aussi bien chargé par `<script src>` (popup/options) que par
 * `importScripts` (service worker Chrome) ou la liste `background.scripts` (event page
 * Firefox). C'est le SEUL endroit qui connaît les clés et leurs valeurs par défaut —
 * aucune autre surface ne doit réécrire un défaut dans son coin.
 */
(function (global) {
  const api = global.browser ?? global.chrome;

  const DEFAULTS = {
    returnToParent: true, // à la fermeture, réactiver l'onglet parent
    closeWithEsc: true, // Échap ferme l'onglet temporaire
    nativeHighlight: true, // groupe coloré (Chrome) / conteneur (Firefox)
    banner: true, // bandeau in-page + favicon ⏳
    highlightColor: "#5B4DF5", // couleur du repère (5 teintes de la palette)
    // 'newtab' = vraie page « nouvel onglet » du navigateur → curseur dans la barre
    // d'URL (omnibox) avec historique/autocomplétion. 'temp' = page Temporary Tab dédiée
    // (bandeau + Échap intégrés, mais pas d'accès à l'omnibox).
    landingPage: "newtab",
  };

  // storage.sync de préférence ; repli silencieux sur storage.local si indisponible.
  function preferredArea() {
    return api.storage && api.storage.sync ? api.storage.sync : api.storage.local;
  }

  async function get() {
    let stored;
    try {
      stored = await preferredArea().get(DEFAULTS);
    } catch {
      stored = await api.storage.local.get(DEFAULTS);
    }
    const s = { ...DEFAULTS, ...stored };
    // Petit helper relié aux clés de highlighters ('native' | 'banner').
    s.enables = (key) =>
      key === "native" ? !!s.nativeHighlight : key === "banner" ? !!s.banner : false;
    return s;
  }

  async function set(key, value) {
    const patch = { [key]: value };
    try {
      await preferredArea().set(patch);
    } catch {
      await api.storage.local.set(patch);
    }
  }

  global.Settings = { DEFAULTS, get, set };
})(globalThis);
