/* popup.js — interactions de la popup. Lit/écrit les réglages via le module Settings
   (source unique) et délègue l'ouverture au background. */
(function () {
  const api = globalThis.browser ?? globalThis.chrome;

  const $ = (id) => document.getElementById(id);
  const openOptions = () => {
    api.runtime.openOptionsPage();
    window.close();
  };

  // Résumé des repères actifs, adapté au navigateur.
  function highlightSummary(s) {
    const parts = [];
    if (s.nativeHighlight) parts.push(api.tabGroups ? "Groupe coloré" : "Conteneur");
    if (s.banner) parts.push("bandeau");
    return parts.length ? parts.join(" + ") : "Aucun";
  }

  async function render() {
    const s = await Settings.get();
    const ret = $("t-return");
    ret.setAttribute("aria-checked", String(!!s.returnToParent));
    $("highlight-summary").textContent = highlightSummary(s);
  }

  async function renderShortcut() {
    try {
      const cmds = await api.commands.getAll();
      const cmd = cmds.find((c) => c.name === "open-temporary-tab");
      $("shortcut").textContent = cmd && cmd.shortcut ? cmd.shortcut : "non défini";
    } catch {
      $("shortcut").textContent = "non défini";
    }
  }

  // --- Câblage ---
  $("open-temp").addEventListener("click", () => {
    api.runtime.sendMessage({ type: "open-temp" });
    window.close();
  });
  $("open-options").addEventListener("click", openOptions);
  $("open-options-2").addEventListener("click", openOptions);
  $("open-highlight").addEventListener("click", openOptions);

  $("t-return").addEventListener("click", async () => {
    const next = $("t-return").getAttribute("aria-checked") !== "true";
    $("t-return").setAttribute("aria-checked", String(next));
    await Settings.set("returnToParent", next);
  });

  // Reflète en direct un réglage modifié ailleurs (réglages / autre fenêtre).
  api.storage.onChanged.addListener(render);

  $("version").textContent = "v" + api.runtime.getManifest().version;
  render();
  renderShortcut();
})();
