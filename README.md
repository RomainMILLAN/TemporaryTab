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
- Aucune interface ni popup : tout passe par le raccourci clavier.

## Installation

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

- **Chrome** : `chrome://extensions/shortcuts`
- **Firefox** : `about:addons` → roue ⚙️ → **« Gérer les raccourcis d'extensions »**

## Fonctionnement technique

Le code de l'extension (sans build, sans dépendance) tient dans `src/` :

- **`src/manifest.json`** — un manifest unique pour les deux navigateurs. La clé
  `background` contient à la fois `service_worker` (lu par Chrome) et `scripts` (lu par
  Firefox) ; chaque navigateur ignore la clé qui ne le concerne pas.
- **`src/background.js`** — la logique. Un alias
  `const api = globalThis.browser ?? globalThis.chrome` réconcilie les namespaces
  WebExtensions des deux navigateurs.

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
