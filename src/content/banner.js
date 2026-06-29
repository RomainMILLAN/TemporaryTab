/* content/banner.js — bandeau in-page d'un onglet temporaire, injecté par le background
   via scripting.executeScript (uniquement dans les onglets temporaires, hors pages
   privilégiées). Idempotent : ne s'installe qu'une fois par document. */
(function () {
  const api = globalThis.browser ?? globalThis.chrome;

  // Sentinelle : éviter l'empilement si réinjecté sur le même document.
  if (window.__ttBannerInstalled) return;
  window.__ttBannerInstalled = true;

  api.runtime
    .sendMessage({ type: "temp-info" })
    .then((info) => {
      if (!info || !info.isTemp) return;

      if (info.showBanner) {
        installBanner(info.parentTitle, info.color);
        prefixTitle();
        swapFavicon();
      }
      if (info.closeOnEsc) {
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") api.runtime.sendMessage({ type: "close-temp" });
        });
      }
    })
    .catch(() => {});

  function installBanner(parentTitle, color) {
    const bar = document.createElement("div");
    bar.id = "__tt-banner";
    const dest = parentTitle ? "revient à « " + parentTitle + " »" : "revient à l'onglet précédent";
    bar.textContent = "Onglet temporaire — se ferme et " + dest;
    Object.assign(bar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "2147483647",
      background: color || "#5B4DF5",
      color: "#fff",
      font: "600 12px/1.4 system-ui, sans-serif",
      padding: "7px 14px",
      textAlign: "center",
      boxShadow: "0 1px 6px rgba(0,0,0,.25)",
    });
    const apply = () => {
      if (!document.body) return;
      document.body.appendChild(bar);
      // Décale la page pour ne pas masquer son contenu.
      document.documentElement.style.scrollPaddingTop = "30px";
      document.body.style.marginTop = "30px";
    };
    if (document.body) apply();
    else document.addEventListener("DOMContentLoaded", apply, { once: true });
  }

  function prefixTitle() {
    if (!document.title.startsWith("⏳")) {
      document.title = "⏳ " + document.title;
    }
  }

  function swapFavicon() {
    try {
      const href = api.runtime.getURL("icons/icon-32.png");
      document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = href;
      document.head && document.head.appendChild(link);
    } catch {
      /* head indisponible : on ignore */
    }
  }
})();
