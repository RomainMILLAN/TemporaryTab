# Chrome Web Store — fiche de soumission

Données prêtes à copier-coller dans la console développeur du Chrome Web Store.
Le zip de production est produit par `npm run build:chrome`
(→ `web-ext-artifacts/temporary-tab-chrome-<version>.zip`).

## Métadonnées

- **Nom** : Temporary Tab
- **Résumé (court, ≤ 132 caractères)** :
  Ouvre un onglet temporaire d'un raccourci ; à sa fermeture, le focus revient
  automatiquement sur l'onglet d'origine.
- **Catégorie** : Productivité
- **Langue par défaut** : Français

### Description (longue)

```
Temporary Tab ajoute la notion d'« onglet temporaire » à votre navigateur.

Appuyez sur un raccourci (Ctrl+Shift+Espace par défaut) : l'onglet courant est
mémorisé comme parent et un nouvel onglet temporaire s'ouvre. Naviguez librement —
changez d'URL, ouvrez plusieurs pages, passez d'un onglet à l'autre. Dès que vous
fermez l'onglet temporaire, le focus revient automatiquement sur l'onglet de départ,
quel que soit l'onglet actif au moment de la fermeture.

Pratique pour une recherche rapide, vérifier un lien ou faire un aller-retour sans
perdre le fil de votre travail.

Fonctionnalités :
• Retour automatique à l'onglet parent à la fermeture
• Onglets temporaires imbriqués (chaque temporaire connaît son propre parent)
• Prise en charge multi-fenêtres
• Aucune collecte de données, aucune interface superflue
• Raccourci entièrement personnalisable

Le raccourci se configure dans chrome://extensions/shortcuts.
```

## Justification des permissions (demandée lors de la revue)

- **`tabs`** : identifier l'onglet actif (futur parent), ouvrir l'onglet temporaire,
  détecter sa fermeture et réactiver l'onglet parent. Aucune URL transmise où que ce soit.
- **`storage`** : `storage.session` pour l'association onglet temporaire → parent (vidée
  à la fermeture du navigateur) ; `storage.sync`/`local` pour les préférences.
- **`scripting`** : injecter le bandeau in-page **uniquement** dans l'onglet temporaire
  (jamais ailleurs). Aucune lecture du contenu des pages.
- **`tabGroups`** (Chrome) : placer l'onglet temporaire dans un groupe coloré « Temp ».
- **`host_permissions: <all_urls>`** : permettre l'insertion du bandeau visuel sur le
  site visité par l'onglet temporaire. L'extension **ne lit pas** le contenu des pages,
  ne suit pas la navigation et n'envoie rien à un tiers. Sous Firefox cette autorisation
  est **optionnelle** et demandée à la première activation du bandeau.
- **Confidentialité** : aucune donnée collectée — voir `privacy.html` (inclus dans le zip).

## Éléments graphiques à fournir (non inclus — à créer)

- **Icône de la fiche** : 128×128 (déjà dans le zip : `icons/icon-128.png`).
- **Capture(s) d'écran** : au moins une, en 1280×800 ou 640×400 (obligatoire).
- *(Optionnel)* Petite vignette promotionnelle 440×280.

## Checklist de soumission

1. [ ] Créer un compte développeur Chrome Web Store (frais uniques de 5 $).
2. [ ] « Nouvel élément » → uploader `temporary-tab-chrome-<version>.zip`.
3. [ ] Renseigner nom, résumé, description, catégorie, langue (ci-dessus).
4. [ ] Ajouter l'icône 128×128 et au moins une capture d'écran.
5. [ ] Remplir la déclaration de confidentialité : « aucune donnée utilisateur
       collectée ». Justifier `tabs` et `storage` (textes ci-dessus).
6. [ ] Soumettre pour revue.
7. [ ] *(Optionnel)* Pour la publication automatique par la CI : récupérer
       `EXTENSION_ID` + identifiants OAuth, et définir les secrets `CWS_CLIENT_ID`,
       `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID` + la variable de
       dépôt `PUBLISH_CHROME_WEB_STORE = true`.
