# Celestial Lions – Fiche de jeu

App Warhammer 40K (V11) installable sur téléphone, utilisable hors ligne.
Site : https://deguingois.github.io/celestial_lion_app/

## Organisation

```
index.html            l'app (coquille)
css/app.css           le style
js/app.js             affichage des pages, menus, mises à jour
js/bsdata.js          extraction des fiches depuis BSData (app + outil)
data/rules.json       commun : mots-clés (FR), stratagèmes de base, Doctrines
data/detachments.json détachements : règle, améliorations, stratagèmes
data/units.json       fiches d'unités générées depuis BSData/wh40k-11e
data/official-rules.json  textes officiels des mots-clés (anglais, BSData)
data/lists/           une liste d'armée par fichier + index.json
tools/build-units.js  régénère units.json depuis un clone de BSData
sw.js                 mode hors ligne
```

## Ajouter une liste

1. Créer `data/lists/<id>.json` (unités, équipement, améliorations, plan, scénarios).
2. L'ajouter dans `data/lists/index.json` et dans la liste `FILES` de `sw.js`.
3. `node tools/build-units.js /chemin/vers/wh40k-11e` pour générer les nouvelles fiches.

## Mettre à jour les profils

Dans l'app : Menu → Mises à jour → Vérifier. Les changements sont affichés avant d'être appliqués.
