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
- Aucune interface, aucun popup, aucune icône : tout passe par le raccourci clavier.

## Installation

L'extension n'a **aucune dépendance** et ne nécessite **aucune étape de build** : il
suffit de charger le dossier tel quel.

### Google Chrome (ou Edge, Brave, et autres navigateurs Chromium)

1. Ouvrez `chrome://extensions`.
2. Activez le **Mode développeur** (interrupteur en haut à droite).
3. Cliquez sur **« Charger l'extension non empaquetée »**.
4. Sélectionnez le dossier de ce projet (celui qui contient `manifest.json`).

### Firefox

1. Ouvrez `about:debugging#/runtime/this-firefox`.
2. Cliquez sur **« Charger un module complémentaire temporaire… »**.
3. Sélectionnez le fichier `manifest.json` du projet.

> ℹ️ Sous Firefox, une extension chargée de cette manière est **temporaire** : elle est
> retirée à la fermeture du navigateur. Rechargez-la de la même façon à la prochaine
> session (ou empaquetez-la pour une installation permanente).

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

Deux fichiers, sans build :

- **`manifest.json`** — un manifest unique pour les deux navigateurs. La clé `background`
  contient à la fois `service_worker` (lu par Chrome) et `scripts` (lu par Firefox) ;
  chaque navigateur ignore la clé qui ne le concerne pas.
- **`background.js`** — la logique. Un alias `const api = globalThis.browser ?? globalThis.chrome`
  réconcilie les namespaces WebExtensions des deux navigateurs.

Les associations *onglet temporaire → parent* sont stockées dans
`chrome.storage.session`. Ce choix est volontaire : en MV3, le contexte d'arrière-plan
(service worker / event page) est arrêté après quelques secondes d'inactivité, ce qui
effacerait une simple variable en mémoire avant que vous ne fermiez l'onglet temporaire.
`storage.session` survit à ces arrêts tout en étant vidé à la fermeture du navigateur —
exactement la durée de vie attendue.

## Limitations

- Le navigateur empêche les extensions d'agir sur certaines pages internes
  (`chrome://`, `about:`, page « nouvel onglet », Chrome Web Store…). Un raccourci
  déclenché depuis ces pages peut ne pas mémoriser de parent.
- Sous Firefox, l'installation via `about:debugging` est temporaire (voir ci-dessus).
