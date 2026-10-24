# Démonstrateur de gaz parfait en deux dimensions

Cette première version relie le mouvement des particules aux mesures de pression, d’aire et d’énergie cinétique. Un piston permet de comparer des détentes, des compressions et une détente libre dans une enceinte isolée.

## Ouvrir le démonstrateur

Ouvrir `dist/index.html` dans un navigateur récent par un double clic. Le calcul et l’affichage s’exécutent dans le navigateur, sans installation ni connexion réseau.

Pour utiliser un serveur local depuis ce dossier :

```sh
python3 -m http.server 8080 --directory dist
```

Puis ouvrir <http://localhost:8080>.

## Explorer en quelques minutes

1. Laisser le piston immobile et observer les collisions et les fluctuations de pression. L’énergie doit rester constante.
2. Choisir un volume cible plus grand que le volume actuel et lancer une détente lente. Les particules qui rattrapent le piston lui cèdent de l’énergie.
3. Réinitialiser, puis effectuer la même détente plus rapidement. La vitesse du piston modifie la fréquence et l’intensité des échanges.
4. Réinitialiser, puis effectuer une détente libre. L’espace accessible augmente instantanément, sans déplacement de paroi traversant le gaz : l’énergie cinétique reste constante.
5. Choisir un volume cible plus petit pour comprimer le gaz. Le travail reçu et l’énergie cinétique augmentent.
6. Essayer le mouvement progressif et l’oscillation pour comparer plusieurs trajectoires du piston. La pause arrête le temps de simulation.

## Modèle scientifique

Les particules sont ponctuelles, de masse identique, sans interaction entre elles. Elles se déplacent en ligne droite entre les collisions avec les parois. Les petits disques dessinés sont des repères visuels : ils n’ont pas de volume exclu et peuvent se superposer. Ce choix représente la limite d’un gaz parfait sans collisions moléculaires.

Les quatre parois sont isolantes. Une collision avec une paroi fixe conserve l’énergie cinétique. Pour un piston de vitesse horizontale `u`, la vitesse horizontale d’une particule devient `vx′ = 2u − vx`. La composante verticale est conservée. La collision est élastique dans le référentiel du piston, mais elle échange du travail avec le gaz dans le référentiel de l’enceinte.

Le modèle emploie des unités réduites avec `m = 1` et `kB = 1`. Les longueurs, temps, énergies, températures et pressions affichés sont donc des unités de simulation ; ils ne correspondent pas directement à des mètres, secondes, kelvins ou pascals.

### Aire et pression en 2D

La grandeur appelée volume est ici l’aire `V = L × H`. La pression en deux dimensions est une force par unité de longueur de paroi. Il faudrait définir une épaisseur et une conversion d’unités pour en tirer une pression tridimensionnelle.

La pression affichée est calculée à partir des collisions : l’impulsion normale transférée aux parois est divisée par la longueur de paroi et le temps de mesure. Une fenêtre glissante d’environ deux unités de temps réduit les fluctuations sans les supprimer. Le calcul tient compte de la longueur des parois pendant le déplacement du piston. Une lecture avant accumulation d’un temps de mesure suffisant est moins représentative.

La moyenne sur les quatre parois est pondérée par leur longueur. Les pressions des parois peuvent être différentes pendant une transformation. La relation `P = N T / V` est une référence d’équilibre isotrope ; elle ne sert pas à fabriquer la mesure de pression.

### Énergie et température cinétique

L’énergie cinétique est `E = Σ (vx² + vy²) / 2`. L’indicateur de température cinétique est `Tcin = E / N`, relation correspondant à deux degrés de liberté avec `kB = 1`.

Les composantes directionnelles sont `Tx = moyenne(vx²)` et `Ty = moyenne(vy²)`, avec `Tcin = (Tx + Ty) / 2`. Elles permettent de voir l’anisotropie créée par le piston. En l’absence de collisions entre particules, cette anisotropie ne se résorbe pas spontanément. Pendant un état hors équilibre, `Tcin` est un indicateur d’énergie et ne garantit pas l’existence d’une température thermodynamique unique. Le mouvement collectif éventuel est inclus dans cet indicateur.

Cette version ne doit donc pas être utilisée pour vérifier directement une loi adiabatique d’équilibre telle que `PV^γ = constante`. Il faudrait ajouter un mécanisme de rééquilibration et vérifier son domaine de validité.

### Travail et bilan énergétique

Le travail reçu par le gaz est la somme des variations d’énergie cinétique produites par les collisions avec le piston. Il est positif lors d’une compression et négatif lors d’une détente avec travail. Les parois étant isolantes, `Q = 0` et le bilan attendu est `E − E0 = Wreçu`.

Une détente libre agrandit instantanément l’espace accessible sans collision avec une paroi en déplacement : le travail est nul et l’énergie reste constante. Une compression instantanée n’est pas proposée, car elle placerait une paroi à travers des particules sans préciser le processus physique.

## Mouvements du piston

- Vitesse constante : déplacement linéaire vers la cible pendant la durée choisie.
- Mouvement progressif : demi-cosinus, avec départ et arrivée à vitesse nulle.
- Oscillation : allers-retours progressifs entre la position de départ et la cible ; la durée règle un trajet simple.
- Détente libre : augmentation immédiate de la largeur accessible, sans travail.

Les collisions utilisent les vitesses du piston. Pour une trajectoire courbe, de petits pas de temps approchent sa trajectoire par des segments linéaires.

## Vérifications

Les tests du moteur s’exécutent avec Node.js :

```sh
node --test tests/*.test.mjs
```

La suite comprend 25 tests : 18 tests physiques et 7 scénarios de commandes exécutés avec le moteur réel et un DOM simulé. Elle couvre aussi les butées du piston, la pause, les mouvements successifs, la réinitialisation et le téléchargement des mesures.

Le graphique d’évolution utilise `V0` et `T0` de l’état initial ; `P0 = N T0 / V0` est sa pression théorique isotrope. Le diagramme P–V trace les pressions mesurées. L’export CSV contient au plus les 6 000 derniers relevés, pris environ tous les 0,1 u.t. (plus les événements de commande). Les mesures ne sont pas enregistrées après fermeture ou réinitialisation.

Les critères scientifiques sont la conservation de l’énergie à piston fixe, le confinement des particules, le bilan `E − E0 − Wreçu` pendant les mouvements, la conservation d’énergie lors d’une détente libre et la convergence statistique de la pression vers `NT/V` pour un gaz initial isotrope dans une enceinte fixe. Les mesures de pression nécessitent un temps d’observation suffisamment long.

Les principales limites sont le petit nombre de particules, les fluctuations statistiques, l’absence d’interactions moléculaires, l’absence de rééquilibration entre les directions, les unités réduites et la géométrie bidimensionnelle. Le démonstrateur vise l’exploration des mécanismes microscopiques, sans prédire quantitativement le comportement d’un gaz réel.
