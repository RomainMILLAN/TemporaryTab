/**
 * highlighters.js — comment « faire ressortir » un onglet temporaire.
 *
 * Pattern Stratégie à DEUX TEMPS : `decorateCreate(opts)` agit AVANT la création de
 * l'onglet (le conteneur Firefox se fixe via `cookieStoreId`), `apply(tab, color)` agit
 * APRÈS (groupe Chrome, bandeau in-page). L'orchestrateur (`background.js`) compose la
 * liste des stratégies actives + supportées, sans aucun `if` par navigateur.
 *
 * Script classique exposant `globalThis.Highlighters`.
 */
(function (global) {
  const api = global.browser ?? global.chrome;

  // ---- Correspondances couleur (palette → enums natifs) ----
  const GROUP_COLORS = {
    "#5B4DF5": "purple",
    "#16C2A3": "green",
    "#FF6B5E": "red",
    "#F5A623": "yellow",
    "#0F1016": "grey",
  };
  const CONTAINER_COLORS = {
    "#5B4DF5": "purple",
    "#16C2A3": "turquoise",
    "#FF6B5E": "red",
    "#F5A623": "yellow",
    "#0F1016": "toolbar",
  };
  const toGroupColor = (hex) => GROUP_COLORS[hex] || "purple";
  const toContainerColor = (hex) => CONTAINER_COLORS[hex] || "purple";

  // Pages où l'on ne peut/doit pas injecter (privilégiées + nos propres pages d'extension).
  function injectable(url) {
    return (
      !!url &&
      !/^(about:|chrome:|edge:|brave:|opera:|vivaldi:|view-source:|chrome-extension:|moz-extension:|chrome:\/\/newtab)/i.test(
        url,
      ) &&
      !/^https?:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|addons\.mozilla\.org)/i.test(url)
    );
  }

  class TabHighlighter {
    get key() {
      return "native";
    }
    supported() {
      return true;
    }
    async decorateCreate(_opts, _color) {} // pré-création
    async apply(_tab, _color) {} // post-création
  }

  // Chrome / Edge : groupe d'onglets coloré et nommé « Temp ».
  class GroupHighlighter extends TabHighlighter {
    supported() {
      return !!(api.tabGroups && api.tabs && api.tabs.group);
    }
    async apply(tab, color) {
      const groupId = await api.tabs.group({ tabIds: [tab.id] });
      await api.tabGroups.update(groupId, { title: "Temp", color: toGroupColor(color) });
    }
  }

  // Firefox : onglet ouvert dans le conteneur « Temporary Tab ».
  class ContainerHighlighter extends TabHighlighter {
    supported() {
      return !!api.contextualIdentities;
    }
    async decorateCreate(opts, color) {
      const name = "Temporary Tab";
      let [identity] = await api.contextualIdentities.query({ name });
      if (!identity) {
        identity = await api.contextualIdentities.create({
          name,
          color: toContainerColor(color || "#5B4DF5"),
          icon: "fingerprint",
        });
      }
      opts.cookieStoreId = identity.cookieStoreId;
    }
  }

  // Universel : bandeau in-page injecté dans l'onglet (sauf pages privilégiées).
  class BannerHighlighter extends TabHighlighter {
    get key() {
      return "banner";
    }
    supported() {
      return !!api.scripting;
    }
    async apply(tab) {
      await this.inject(tab.id, tab.url);
    }
    // Injecte banner.js si l'URL le permet. Idempotence gérée côté banner.js.
    async inject(tabId, url) {
      if (!injectable(url)) return;
      try {
        await api.scripting.executeScript({ target: { tabId }, files: ["content/banner.js"] });
      } catch {
        // Host permission non accordée (Firefox) ou page interdite : on ignore.
      }
    }
  }

  const banner = new BannerHighlighter();
  global.Highlighters = {
    list: [new GroupHighlighter(), new ContainerHighlighter(), banner],
    banner, // exposé pour la réinjection sur navigation (background.onUpdated)
    injectable,
    toContainerColor,
  };
})(globalThis);
