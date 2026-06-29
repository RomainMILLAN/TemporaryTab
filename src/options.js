/* options.js — page de réglages. Toutes les valeurs transitent par le module Settings
   (source unique). Repère natif adapté au navigateur ; bandeau Firefox demande la
   permission d'hôte à l'activation. */
(function () {
  const api = globalThis.browser ?? globalThis.chrome;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const PALETTE = [
    { hex: "#5B4DF5", name: "Indigo" },
    { hex: "#16C2A3", name: "Mint" },
    { hex: "#FF6B5E", name: "Coral" },
    { hex: "#F5A623", name: "Amber" },
    { hex: "#0F1016", name: "Ink" },
  ];

  const nativeSupported = !!(api.tabGroups || api.contextualIdentities);

  // ---- Rendu ----
  function renderNativeLabels() {
    const title = api.tabGroups ? "Groupe coloré" : api.contextualIdentities ? "Conteneur" : "Repère natif";
    const sub = api.tabGroups
      ? "Onglet placé dans un groupe « Temp » coloré (Chrome / Edge)."
      : api.contextualIdentities
        ? "Onglet ouvert dans le conteneur « Temporary Tab » (Firefox)."
        : "Non disponible sur ce navigateur.";
    $("#native-title").textContent = title;
    $("#native-sub").textContent = sub;
    const sw = $('.switch[data-key="nativeHighlight"]');
    if (!nativeSupported) sw.disabled = true;
  }

  function renderColors(current) {
    const box = $("#colors");
    box.innerHTML = "";
    for (const c of PALETTE) {
      const b = document.createElement("button");
      b.className = "swatch";
      b.style.background = c.hex;
      b.style.color = c.hex; // pour l'anneau de sélection (currentColor)
      b.title = c.name;
      b.setAttribute("aria-label", c.name);
      b.setAttribute("aria-pressed", String(c.hex.toLowerCase() === current.toLowerCase()));
      b.addEventListener("click", async () => {
        await Settings.set("highlightColor", c.hex);
      });
      box.appendChild(b);
    }
  }

  function renderShortcut() {
    api.commands.getAll().then((cmds) => {
      const cmd = (cmds || []).find((c) => c.name === "open-temporary-tab");
      const box = $("#shortcut-chips");
      box.innerHTML = "";
      const sc = cmd && cmd.shortcut ? cmd.shortcut : "";
      if (!sc) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = "non défini";
        box.appendChild(chip);
        return;
      }
      sc.split("+").forEach((part, i) => {
        if (i > 0) {
          const plus = document.createElement("span");
          plus.className = "chip plus";
          plus.textContent = "+";
          box.appendChild(plus);
        }
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = part;
        box.appendChild(chip);
      });
    });
  }

  async function render() {
    const s = await Settings.get();
    $$(".switch[data-key]").forEach((sw) => {
      sw.setAttribute("aria-checked", String(!!s[sw.dataset.key]));
    });
    $$("#landing .seg").forEach((seg) => {
      seg.setAttribute("aria-checked", String(seg.dataset.value === s.landingPage));
    });
    renderColors(s.highlightColor);
  }

  // ---- Permission d'hôte (bandeau) ----
  async function ensureHostPermission() {
    try {
      return await api.permissions.request({ origins: ["<all_urls>"] });
    } catch {
      return false;
    }
  }

  // ---- Câblage ----
  $$(".switch[data-key]").forEach((sw) => {
    sw.addEventListener("click", async () => {
      if (sw.disabled) return;
      const key = sw.dataset.key;
      const next = sw.getAttribute("aria-checked") !== "true";

      // Activer le bandeau peut nécessiter la permission d'hôte (Firefox surtout).
      if (key === "banner" && next) {
        const granted = await ensureHostPermission();
        if (!granted) {
          $("#banner-hint").hidden = false;
          $("#banner-hint").textContent =
            "Le bandeau in-page nécessite l'autorisation d'accès aux sites. Activation annulée.";
          return;
        }
        $("#banner-hint").hidden = true;
      }

      sw.setAttribute("aria-checked", String(next));
      await Settings.set(key, next);
    });
  });

  $$("#landing .seg").forEach((seg) => {
    seg.addEventListener("click", async () => {
      await Settings.set("landingPage", seg.dataset.value);
    });
  });

  // Modifier le raccourci : Firefox via commands.update (capture clavier) ;
  // Chrome via la page dédiée chrome://extensions/shortcuts.
  $("#edit-shortcut").addEventListener("click", () => {
    if (api.commands.update) {
      startCapture();
    } else {
      api.tabs.create({ url: "chrome://extensions/shortcuts" });
    }
  });

  function keyName(e) {
    if (e.key === " " || e.code === "Space") return "Space";
    if (e.key.startsWith("Arrow")) return e.key.slice(5); // Up/Down/Left/Right
    if (e.key.length === 1) return e.key.toUpperCase();
    return null; // touche non gérée pour un raccourci
  }

  function startCapture() {
    const btn = $("#edit-shortcut");
    const hint = $("#shortcut-hint");
    hint.hidden = false;
    hint.textContent = "Appuyez sur la combinaison souhaitée… (Échap pour annuler)";
    btn.textContent = "…";

    const cleanup = () => {
      document.removeEventListener("keydown", onKey, true);
      btn.textContent = "Modifier";
      hint.hidden = true;
    };
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        cleanup();
        return;
      }
      const mods = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      const key = keyName(e);
      if (!key || mods.length === 0) {
        hint.textContent = "Il faut au moins un modificateur (Ctrl/Alt/Shift) + une touche.";
        return;
      }
      const shortcut = [...mods, key].join("+");
      api.commands
        .update({ name: "open-temporary-tab", shortcut })
        .then(() => {
          cleanup();
          renderShortcut();
        })
        .catch(() => {
          hint.textContent = "Combinaison refusée par le navigateur, essayez-en une autre.";
        });
    };
    document.addEventListener("keydown", onKey, true);
  }

  // Lien d'aide → README du dépôt.
  $("#help").setAttribute("href", api.runtime.getManifest().homepage_url || "https://github.com/");

  api.storage.onChanged.addListener(render);
  $("#version").textContent = "v" + api.runtime.getManifest().version;

  renderNativeLabels();
  render();
  renderShortcut();
})();
