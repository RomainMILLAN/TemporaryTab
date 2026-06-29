# Temporary Tab

Extension de navigateur (**Manifest V3**, compatible **Google Chrome** et **Firefox**)
qui ajoute la notion d'**onglet temporaire**.

Un raccourci clavier ouvre un nouvel onglet en mémorisant l'onglet courant comme
**parent**. Vous naviguez librement dans cet onglet temporaire aussi longtemps que vous
le souhaitez (changements d'URL, allers-retours entre onglets…). Dès que vous le
**fermez**, le focus revient automatiquement sur l'onglet parent — peu importe quel
onglet était actif juste avant, et indépendamment de l'ordre MRU du navigateur.

## Fonctionnalités

- Retour automatique au parent à la fermeture de l'onglet temporaire.
- Fonctionne même après de nombreux changements d'URL ou d'onglets.
- **Onglets temporaires imbriqués** : depuis un onglet temporaire, un nouveau raccourci
  crée un second temporaire dont le parent est le premier (`A → Temp1 → Temp2` ; fermer
  `Temp2` ⇒ `Temp1`, fermer `Temp1` ⇒ `A`).
- **Multi-fenêtres** : si le parent est dans une autre fenêtre, celle-ci repasse au
  premier plan.
- **Robuste** : si le parent a été fermé entre-temps, l'extension remonte la chaîne
  jusqu'au premier ancêtre encore vivant ; si aucun n'existe, elle laisse le navigateur
  décider.
- **Popup** dans la barre d'outils et **page de réglages** complète.
- **Faire ressortir l'onglet** (cumulable) : groupe coloré (Chrome), conteneur (Firefox),
  bandeau in-page + favicon ⏳ ; couleur du repère personnalisable.
- **Fermer avec Échap**, page d'atterrissage configurable, raccourci personnalisable.

## Installation

> 📦 **Installation manuelle (sans store)** : voir **[INSTALL.md](INSTALL.md)** — charger
> le dossier `src/` dans Chrome, ou `src/manifest.json` dans Firefox. C'est la méthode
> recommandée si tu ne publies pas sur les stores.

Les méthodes ci-dessous (Releases / store) ne s'appliquent que si l'extension est
distribuée publiquement.

### Firefox — installation en un clic

1. Ouvrez la page [**Releases**](../../releases) et téléchargez le fichier **`.xpi`** le
   plus récent.
2. **Glissez-déposez** le `.xpi` dans une fenêtre Firefox.
3. Confirmez (**« Ajouter »**) dans la fenêtre qui s'affiche.

Le `.xpi` est **signé par Mozilla** : l'installation est permanente, aucun mode
développeur n'est requis.

### Google Chrome (et Edge, Brave, Opera…)

**Option A — Chrome Web Store** *(une fois l'extension publiée)* : cliquez sur
**« Ajouter à Chrome »** depuis la fiche du store.

**Option B — depuis une Release** : téléchargez le `.zip` depuis la page
[Releases](../../releases), décompressez-le, puis :

1. Ouvrez `chrome://extensions`.
2. Activez le **Mode développeur** (en haut à droite).
3. **« Charger l'extension non empaquetée »** → sélectionnez le dossier décompressé.

> ℹ️ Chrome ne permet pas d'installer un `.crx` hors du Web Store : l'option B reste donc
> le seul moyen gratuit et immédiat tant que l'extension n'est pas publiée sur le store.

## Utilisation

1. Placez-vous sur l'onglet auquel vous voulez revenir (l'onglet **parent**).
2. Appuyez sur le raccourci : **`Ctrl + Shift + Espace`** (**`Cmd + Shift + Espace`** sur
   macOS). Un onglet temporaire s'ouvre.
3. Naviguez librement dans cet onglet temporaire.
4. Fermez-le (`Ctrl + W` ou la croix) ⇒ le focus revient automatiquement sur le parent.

### Personnaliser le raccourci

- Depuis la **page de réglages** (bouton « Modifier ») — capture directe sous Firefox.
- Ou : **Chrome** `chrome://extensions/shortcuts` ; **Firefox** `about:addons` → roue ⚙️
  → **« Gérer les raccourcis d'extensions »**.

## Interface

- **Popup** (clic sur l'icône) : ouvrir un onglet temporaire, activer/désactiver le
  retour au parent, accès rapide aux réglages.
- **Page de réglages** (`options_ui`) :
  - **Comportement** : retour au parent, fermeture avec Échap ;
  - **Page d'atterrissage** : page « Temporary Tab » dédiée (bandeau + Échap intégrés) ou
    page « nouvel onglet » du navigateur ;
  - **Faire ressortir l'onglet** (cumulable) : repère natif (groupe coloré sous Chrome /
    conteneur sous Firefox) + bandeau in-page ; **couleur** du repère ;
  - le bandeau in-page demande l'autorisation d'accès aux sites à sa première activation
    (sous Firefox notamment).

## Fonctionnement technique

Code dans `src/` (sans étape de build pour le dev, dépendance `web-ext` pour le packaging) :

- **`manifest.json`** — superset cross-browser. `background` porte `service_worker`
  (Chrome) et `scripts` (Firefox) ; les scripts de build produisent un manifest nettoyé
  par navigateur (cf. `scripts/build-{chrome,firefox}-src.mjs`).
- **`background.js`** — orchestrateur. Alias `api = browser ?? chrome` ; objet
  `TabLineage` (parenté, domaine pur) ; logique d'ouverture unique (raccourci + popup).
- **`settings.js`** — source unique des réglages (`storage.sync`, repli `local`).
- **`highlighters.js`** — pattern Stratégie (`decorateCreate`/`apply`) :
  groupe / conteneur / bandeau, cumulables.
- **`popup.*`, `options.*`, `temp.*`, `content/banner.js`, `privacy.html`** — l'UI.
- **`ui/tokens.css` + `ui/fonts/`** — jetons de design et fontes bundlées (offline/CSP).

Les associations *onglet temporaire → parent* sont stockées dans
`chrome.storage.session`. Ce choix est volontaire : en MV3, le contexte d'arrière-plan
(service worker / event page) est arrêté après quelques secondes d'inactivité, ce qui
effacerait une simple variable en mémoire avant que vous ne fermiez l'onglet temporaire.
`storage.session` survit à ces arrêts tout en étant vidé à la fermeture du navigateur —
exactement la durée de vie attendue.

## Développement (depuis les sources)

```bash
npm install          # installe web-ext (outillage Mozilla)
npm run start:firefox    # lance Firefox avec l'extension rechargée à chaud
npm run start:chromium   # idem sous Chromium
npm run lint             # valide le manifest (addons-linter)
```

Pour charger manuellement la version de dev : sélectionnez le dossier **`src/`**
(`chrome://extensions` → « non empaquetée ») ou **`src/manifest.json`**
(`about:debugging` sous Firefox — installation temporaire jusqu'à la fermeture).

## Publication d'une nouvelle version

```bash
npm run build:chrome     # → web-ext-artifacts/temporary-tab-chrome-<version>.zip
npm run build:firefox    # → zip Firefox (manifest nettoyé pour AMO)
npm run sign:firefox     # → .xpi signé (nécessite les clés API AMO)
```

En pratique, tout est automatisé : **pousser un tag `vX.Y.Z`** déclenche la GitHub
Action [`release.yml`](.github/workflows/release.yml) qui construit le zip Chrome, signe
le `.xpi` Firefox et les attache à une *GitHub Release*.

### Secrets requis (dépôt GitHub → Settings → Secrets and variables → Actions)

| Secret | Usage |
| --- | --- |
| `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` | Signature Firefox via AMO (gratuit — [créer une clé](https://addons.mozilla.org/developers/addon/api/key/)). Sans elles, seul un zip non signé est publié. |
| `CWS_*` (4 secrets) + variable `PUBLISH_CHROME_WEB_STORE=true` | *(optionnel)* Publication automatique sur le Chrome Web Store. Voir [`STORE_LISTING.md`](STORE_LISTING.md). |

La soumission initiale au Chrome Web Store (compte, frais de 5 $, captures d'écran) est
détaillée dans [`STORE_LISTING.md`](STORE_LISTING.md).

## Limitations

- Le navigateur empêche les extensions d'agir sur certaines pages internes
  (`chrome://`, `about:`, page « nouvel onglet », Chrome Web Store…). Un raccourci
  déclenché depuis ces pages peut ne pas mémoriser de parent.
- Chrome n'autorise pas l'installation d'un `.crx` hors du Web Store ; d'où la
  distribution via zip (mode développeur) en attendant la publication sur le store.
