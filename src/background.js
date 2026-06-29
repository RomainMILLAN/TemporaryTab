/**
 * Temporary Tab — service worker (Chrome) / event page (Firefox).
 *
 * Concept : un raccourci clavier ouvre un onglet "temporaire" et memorise
 * l'onglet courant comme "parent". Quand l'onglet temporaire est ferme, le
 * focus revient automatiquement au parent — independamment du MRU du navigateur.
 *
 * Conception : la parente entre onglets est le coeur de domaine. Elle est
 * reifiee dans `TabLineage`, qui possede les regles (memoriser, resoudre
 * l'ancetre vivant, oublier). Les listeners ne font que coordonner. La saleté
 * de plateforme (`api.*`) est confinee aux fonctions `isAlive` / `focusTab` et
 * aux listeners : le domaine, lui, ignore dans quel navigateur il tourne.
 */

// Firefox expose `browser` (promesses) ; Chrome expose `chrome` (promesses en MV3).
// Un seul point de reconciliation des deux dialectes WebExtensions.
const api = globalThis.browser ?? globalThis.chrome;

// Chargement des modules partages.
//  - Chrome (service worker) : `importScripts` existe -> on charge ici.
//  - Firefox (event page) : `importScripts` n'existe PAS ; les fichiers sont deja
//    charges via `background.scripts` du manifest. On saute donc l'appel.
// Apres ce bloc, `Settings` et `Highlighters` sont disponibles dans le scope global.
if (typeof importScripts === "function") {
  importScripts("settings.js", "highlighters.js");
}

// Cle unique sous laquelle la table des liens est persistee dans storage.session.
// storage.session survit a l'arret du worker / de l'event page (contrairement a
// une Map en memoire) mais est videe a la fermeture du navigateur : exactement
// la duree de vie voulue pour des onglets temporaires.
const STORAGE_KEY = "parentMap";

/**
 * Connait les liens temporaire -> parent et sait les resoudre.
 * Source de verite : storage.session. Personne ne touche au map brut en dehors
 * de cette classe.
 */
class TabLineage {
  /** Charge la table depuis storage.session et construit une instance. */
  static async load() {
    const stored = await api.storage.session.get(STORAGE_KEY);
    return new TabLineage(stored[STORAGE_KEY] ?? {});
  }

  /** @param {Record<number, number>} map  { [temporaryTabId]: parentTabId } */
  constructor(map) {
    this.map = map;
  }

  /** Memorise qu'un onglet temporaire est ne d'un parent. */
  remember(temporaryTabId, parentTabId) {
    this.map[temporaryTabId] = parentTabId;
  }

  /**
   * Remonte la chaine des parents tant que l'ancetre est mort, et retourne le
   * premier parent encore vivant (ou null). Gere le cas de la chaine brisee :
   * A -> Temp1 -> Temp2, si Temp1 a ete ferme avant Temp2, on remonte jusqu'a A.
   *
   * `isAlive` est injecte (et non appele en dur) : la resolution est ainsi
   * testable sans navigateur, et le domaine reste decouple de `api.tabs`.
   *
   * @param {number} tabId
   * @param {(tabId: number) => Promise<boolean>} isAlive
   * @returns {Promise<number | null>}
   */
  async livingParentOf(tabId, isAlive) {
    let candidate = this.map[tabId];
    while (candidate != null && !(await isAlive(candidate))) {
      candidate = this.map[candidate];
    }
    return candidate ?? null;
  }

  /** Oublie le lien d'un onglet (temporaire ferme). */
  forget(tabId) {
    delete this.map[tabId];
  }

  /**
   * Purge les liens devenus orphelins (parent disparu). Evite que la table
   * accumule des references vers des onglets morts au fil des sessions.
   * @param {(tabId: number) => Promise<boolean>} isAlive
   */
  async pruneOrphans(isAlive) {
    for (const [temporaryTabId, parentTabId] of Object.entries(this.map)) {
      if (!(await isAlive(parentTabId))) {
        delete this.map[temporaryTabId];
      }
    }
  }

  /** Persiste la table dans storage.session. */
  async save() {
    await api.storage.session.set({ [STORAGE_KEY]: this.map });
  }
}

// --- Adaptateurs de plateforme (le "sas" entre le domaine et WebExtensions) ---

/**
 * Indique si un onglet existe encore. `api.tabs.get` rejette si l'onglet a
 * disparu : on traduit ce rejet en un simple booleen.
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function isAlive(tabId) {
  try {
    await api.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Redonne le focus a un onglet, en ramenant aussi sa fenetre au premier plan
 * (le parent peut vivre dans une autre fenetre que l'onglet temporaire).
 * @param {number} tabId
 */
async function focusTab(tabId) {
  const tab = await api.tabs.get(tabId);
  await api.tabs.update(tabId, { active: true });
  await api.windows.update(tab.windowId, { focused: true });
}

// --- Serialisation des ecritures ---

// Les handlers font un read-modify-write sur storage.session. Sur des fermetures
// rapprochees, deux onRemoved pourraient s'entrelacer et l'un ecraser l'autre.
// On chaine donc chaque section critique sur la precedente : une seule s'execute
// a la fois, ce qui rend chaque load -> modify -> save coherent.
let writeQueue = Promise.resolve();

/**
 * Execute `task` apres la derniere ecriture en cours. Retourne une promesse qui
 * se resout quand `task` est terminee.
 * @param {() => Promise<void>} task
 */
function serialize(task) {
  const run = writeQueue.then(task, task);
  // La file ne doit jamais se rompre sur une erreur de tache.
  writeQueue = run.catch(() => {});
  return run;
}

// --- Ouverture d'un onglet temporaire (logique unique, raccourci + popup) ---

/**
 * Memorise l'onglet actif comme parent, ouvre un onglet temporaire et lui applique
 * les reperes actifs. Deux temps, sans aucun `if` par navigateur : `decorateCreate`
 * (pre-creation, ex. conteneur) puis `apply` (post-creation, ex. groupe / banniere).
 */
async function openTemporaryTab() {
  const settings = await Settings.get();

  // Capturer le parent AVANT la creation (create change l'onglet actif).
  const [parent] = await api.tabs.query({ active: true, currentWindow: true });
  if (!parent) {
    return;
  }

  const active = Highlighters.list.filter((h) => settings.enables(h.key) && h.supported());

  const createOpts = {};
  if (settings.landingPage === "temp") {
    // Notre page d'atterrissage (banniere + Echap natifs, sans injection).
    createOpts.url = api.runtime.getURL("temp.html");
  }
  // Phase 1 : pre-creation (le conteneur Firefox se fixe via cookieStoreId).
  for (const h of active) {
    await h.decorateCreate(createOpts, settings.highlightColor);
  }

  const temp = await api.tabs.create(createOpts);

  // Enregistrer le lien parent (ecriture serialisee -> coherence storage.session).
  await serialize(async () => {
    const lineage = await TabLineage.load();
    lineage.remember(temp.id, parent.id);
    await lineage.save();
  });

  // Phase 2 : post-creation (groupe Chrome, banniere). La banniere ne s'applique pas
  // sur notre page temp.html (deja munie de son bandeau natif) ni sur les pages
  // privilegiees : `BannerHighlighter.inject` filtre par URL.
  for (const h of active) {
    if (h === Highlighters.banner && settings.landingPage === "temp") {
      continue;
    }
    try {
      await h.apply(temp, settings.highlightColor);
    } catch (error) {
      console.warn("[Temporary Tab] highlighter apply failed", error);
    }
  }
}

// --- Listeners (chefs d'orchestre maigres) ---

// Raccourci clavier.
api.commands.onCommand.addListener((command) => {
  if (command !== "open-temporary-tab") {
    return;
  }
  openTemporaryTab().catch((error) => console.error("[Temporary Tab] open failed", error));
});

// Messages depuis la popup, la page temp.html et le bandeau in-page.
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  // Popup : ouvrir un onglet temporaire.
  if (message.type === "open-temp") {
    openTemporaryTab().catch((error) => console.error("[Temporary Tab] open failed", error));
    return; // pas de reponse attendue
  }

  // temp.html / bandeau : suis-je un onglet temporaire ? quels reperes afficher ?
  if (message.type === "temp-info") {
    (async () => {
      const tabId = sender.tab && sender.tab.id;
      const lineage = await TabLineage.load();
      const settings = await Settings.get();
      const isTemp = tabId != null && tabId in lineage.map;
      let parentTitle = "";
      if (isTemp) {
        try {
          const parentTab = await api.tabs.get(lineage.map[tabId]);
          parentTitle = parentTab.title || "";
        } catch {
          /* parent disparu : titre vide */
        }
      }
      sendResponse({
        isTemp,
        showBanner: isTemp && settings.banner,
        closeOnEsc: isTemp && settings.closeWithEsc,
        color: settings.highlightColor,
        parentTitle,
      });
    })();
    return true; // garde le canal ouvert pour la reponse asynchrone (Chrome)
  }

  // Échap dans un onglet temporaire : le fermer (le retour au parent suit via onRemoved).
  if (message.type === "close-temp") {
    (async () => {
      const settings = await Settings.get();
      const tabId = sender.tab && sender.tab.id;
      if (settings.closeWithEsc && tabId != null) {
        try {
          await api.tabs.remove(tabId);
        } catch {
          /* deja ferme */
        }
      }
    })();
    return; // pas de reponse attendue
  }
});

// Réinjection du bandeau quand un onglet temporaire change d'URL.
api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  // Cas courant (onglet non temporaire) : sortie rapide.
  const lineage = await TabLineage.load();
  if (!(tabId in lineage.map)) {
    return;
  }
  const settings = await Settings.get();
  if (settings.banner && Highlighters.banner.supported()) {
    await Highlighters.banner.inject(tabId, tab.url); // filtre par URL (pages privilegiees)
  }
});

// Fermeture d'un onglet : si c'est un onglet temporaire connu et que le retour au
// parent est active, rendre le focus a son premier parent vivant.
api.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Quand toute une fenetre se ferme, onRemoved se declenche pour chacun de ses
  // onglets : on ne tente alors aucun retour de focus.
  if (removeInfo.isWindowClosing) {
    return;
  }

  serialize(async () => {
    const lineage = await TabLineage.load();

    // Rien a faire si l'onglet ferme n'etait pas un onglet temporaire suivi.
    if (!(tabId in lineage.map)) {
      return;
    }

    const settings = await Settings.get();
    if (settings.returnToParent) {
      const parentId = await lineage.livingParentOf(tabId, isAlive);
      if (parentId != null) {
        try {
          await focusTab(parentId);
        } catch (error) {
          // Le parent a pu disparaitre entre la verification et le focus : on
          // laisse simplement le navigateur choisir l'onglet suivant.
          console.warn("[Temporary Tab] focus parent failed", error);
        }
      }
    }

    lineage.forget(tabId);
    await lineage.pruneOrphans(isAlive);
    await lineage.save();
  }).catch((error) => console.error("[Temporary Tab] close handling failed", error));
});
