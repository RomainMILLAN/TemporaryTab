/* temp.js — page d'atterrissage de l'onglet temporaire (notre propre page, donc
   bandeau/Échap natifs, sans injection ni host permission). */
(function () {
  const api = globalThis.browser ?? globalThis.chrome;
  let closeOnEsc = false;

  // Met le curseur dans le champ dès l'ouverture pour taper une URL / recherche
  // immédiatement (l'attribut `autofocus` n'est pas toujours honoré sur une page
  // d'extension : on force le focus, y compris après le premier rendu).
  const input = document.getElementById("q");
  const focusInput = () => {
    input.focus();
    input.select();
  };
  focusInput();
  window.addEventListener("DOMContentLoaded", focusInput);
  window.addEventListener("load", focusInput);

  // Demande au background : nom du parent + faut-il câbler Échap ?
  api.runtime
    .sendMessage({ type: "temp-info" })
    .then((info) => {
      if (!info) return;
      const pill = document.getElementById("return-pill");
      if (info.parentTitle) {
        document.getElementById("parent-name").textContent = info.parentTitle;
      }
      pill.hidden = false;
      if (info.closeOnEsc) {
        closeOnEsc = true;
        document.getElementById("esc-key").hidden = false;
      }
    })
    .catch(() => {});

  // Recherche / navigation : transforme l'onglet temporaire en vrai site.
  document.getElementById("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("q").value.trim();
    if (!q) return;
    const looksLikeUrl = /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(q);
    location.href = looksLikeUrl
      ? /^https?:\/\//i.test(q)
        ? q
        : "https://" + q
      : "https://www.google.com/search?q=" + encodeURIComponent(q);
  });

  // Échap ferme l'onglet (le background gère le retour au parent).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && closeOnEsc) {
      api.runtime.sendMessage({ type: "close-temp" });
    }
  });
})();
