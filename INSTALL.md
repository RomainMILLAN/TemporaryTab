# Installer Temporary Tab (sans store)

Ce guide explique comment installer l'extension **manuellement**, sans passer par le
Chrome Web Store ni Firefox Add-ons. Aucune compilation n'est obligatoire : le dossier
`src/` est directement chargeable.

> **En résumé**
> - **Chrome / Edge / Brave / Opera** : `chrome://extensions` → mode développeur →
>   « Charger l'extension non empaquetée » → choisir le dossier **`src/`**.
> - **Firefox** : `about:debugging` → « Charger un module temporaire » → choisir
>   **`src/manifest.json`** (réinstallation à chaque démarrage, voir plus bas).

---

## Google Chrome (et Edge, Brave, Opera, Vivaldi…)

1. Récupérer le projet sur la machine (clone Git ou dossier téléchargé).
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur** (interrupteur en haut à droite).
4. Cliquer sur **« Charger l'extension non empaquetée »**.
5. Sélectionner le dossier **`src/`** du projet (celui qui contient `manifest.json`).

L'icône Ghost Tab apparaît dans la barre d'outils. L'extension **reste installée** après
redémarrage du navigateur (tant que le dossier `src/` n'est pas déplacé/supprimé et que
le mode développeur reste activé).

> ℹ️ Au chargement, Chrome peut afficher un avertissement « autorisation non reconnue »
> pour `contextualIdentities`/`cookies` (ce sont des API Firefox, sans effet sous Chrome).
> Sans gravité. Pour un dossier 100 % propre, voir [Variante « build »](#variante-build-dossier-nettoyé).

---

## Mozilla Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur **« Charger un module complémentaire temporaire… »**.
3. Sélectionner le fichier **`src/manifest.json`**.

> ⚠️ **Installation temporaire** : Firefox retire les extensions chargées ainsi **à la
> fermeture du navigateur**. Il faut donc recharger `src/manifest.json` à chaque session.
> C'est une limite de Firefox : une installation **permanente** exige une extension
> **signée** par Mozilla (compte AMO requis) — hors périmètre de ce guide.
>
> **Astuce pour rester installé en dev** : avec **Firefox Developer Edition** ou
> **Nightly**, ouvrir `about:config`, passer `xpinstall.signatures.required` à `false`,
> puis installer le `.zip` produit par `npm run build:firefox` (renommé en `.xpi`) via
> `about:addons` → roue ⚙️ → « Installer un module depuis un fichier ». (Ne fonctionne
> pas sur Firefox standard, qui impose la signature.)

---

## Définir / changer le raccourci

Raccourci par défaut : **`Ctrl + Shift + Espace`** (**`Cmd + Shift + Espace`** sur macOS).

- Depuis la **page de réglages** de l'extension (bouton « Modifier »).
- Ou : **Chrome** `chrome://extensions/shortcuts` ; **Firefox** `about:addons` → roue ⚙️
  → « Gérer les raccourcis d'extensions ».

---

## Mettre à jour après une modification du code

- **Chrome** : `chrome://extensions` → bouton **↻** sur la carte de l'extension.
- **Firefox** : `about:debugging` → bouton **« Actualiser »** sur l'extension.

---

## Variante « build » (dossier nettoyé)

Pour charger un dossier sans aucun avertissement de permission (manifest spécifique au
navigateur), il faut Node.js et `web-ext` :

```bash
npm install            # une seule fois
npm run build:chrome   # génère build/chrome/  (+ un .zip dans web-ext-artifacts/)
npm run build:firefox  # génère build/firefox/ (+ un .zip)
```

Puis charger **`build/chrome`** (Chrome) ou **`build/firefox/manifest.json`** (Firefox)
de la même façon que ci-dessus. Pour un usage simple, ce n'est pas nécessaire : charger
`src/` suffit.

---

## Désinstaller

- **Chrome** : `chrome://extensions` → **Supprimer** sur la carte.
- **Firefox** : `about:addons` → **Supprimer** (ou redémarrer, l'install temporaire
  disparaît d'elle-même).
