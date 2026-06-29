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

// --- Listeners (chefs d'orchestre maigres) ---

// Raccourci : memorise l'onglet courant comme parent, ouvre un onglet temporaire.
api.commands.onCommand.addListener((command) => {
  if (command !== "open-temporary-tab") {
    return;
  }

  serialize(async () => {
    const [parent] = await api.tabs.query({ active: true, currentWindow: true });
    if (!parent) {
      return;
    }

    // Sans `url`, le navigateur ouvre sa page "nouvel onglet" par defaut.
    const temporaryTab = await api.tabs.create({});

    const lineage = await TabLineage.load();
    lineage.remember(temporaryTab.id, parent.id);
    await lineage.save();
  }).catch((error) => console.error("[Temporary Tab] open failed", error));
});

// Fermeture d'un onglet : si c'est un onglet temporaire connu, rendre le focus
// a son premier parent vivant.
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

    lineage.forget(tabId);
    await lineage.pruneOrphans(isAlive);
    await lineage.save();
  }).catch((error) => console.error("[Temporary Tab] close handling failed", error));
});
