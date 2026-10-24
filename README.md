# Démonstrateur de gaz parfait en deux dimensions

Ce démonstrateur relie le mouvement des particules aux mesures de pression, d’aire et d’énergie cinétique. Un piston permet de comparer des détentes, des compressions et une détente libre dans une enceinte isolée. Les distributions et les graphiques permettent d’explorer le lien entre l’état microscopique et les relations thermodynamiques.

## Ouvrir le démonstrateur

Ouvrir `dist/index.html` dans un navigateur récent par un double clic. Le calcul et l’affichage s’exécutent dans le navigateur, sans installation ni connexion réseau.

Pour utiliser un serveur local depuis ce dossier :

```sh
python3 -m http.server 8080 --directory dist
```

Puis ouvrir <http://localhost:8080>.

## Version en ligne et dépôt GitHub

- Démonstrateur public : <https://fmath92.github.io/gaz-2d/>.
- Code source et historique : <https://github.com/fmath92/gaz-2d>.

GitHub Pages publie automatiquement la branche `main`, à partir de la racine du dépôt. Le fichier `index.html` à la racine redirige vers `dist/`, qui contient l’application autonome. Le fichier `.nojekyll` indique de servir les fichiers statiques sans transformation par Jekyll.

Le dépôt est public. La publication est configurée dans **Settings → Pages → Deploy from a branch → main → / (root)** et utilise HTTPS.

Pour mettre le site à jour, modifier les fichiers dans `dist/`, lancer `node --test tests/*.test.mjs`, puis enregistrer et pousser les changements sur `main`. La publication apparaît dans l’onglet **Actions** du dépôt et sa configuration dans **Settings → Pages**. Aucun serveur applicatif, secret de déploiement ou installation de dépendances n’est nécessaire.

Pour récupérer le projet :

```sh
git clone https://github.com/fmath92/gaz-2d.git
cd gaz-2d
```

## Explorer en quelques minutes

1. Choisir entre 10 et 1 000 particules avec le curseur ou le champ numérique, régler la température initiale, puis créer cet état. L’application réinitialise le piston, le temps, le travail et les mesures.
2. Laisser le piston immobile et observer les collisions, les fluctuations de pression et les histogrammes. L’énergie doit rester constante ; avec peu de particules, les distributions sont moins régulières.
3. Choisir un volume cible plus grand que le volume actuel et lancer une détente lente. Les particules qui rattrapent le piston lui cèdent de l’énergie. Comparer le travail de pression à la variation d’énergie.
4. Réinitialiser, puis effectuer la même détente plus rapidement. La vitesse du piston modifie la fréquence et l’intensité des échanges.
5. Réinitialiser, puis effectuer une détente libre. L’espace accessible augmente instantanément, sans déplacement de paroi traversant le gaz : l’énergie cinétique reste constante.
6. Choisir un volume cible plus petit pour comprimer le gaz. Le travail reçu et l’énergie cinétique augmentent. Essayer aussi le mouvement progressif et l’oscillation ; la pause arrête le temps de simulation.
7. Examiner `PV = f(T)` et comparer les mesures à la droite `PV = NT`. Essayer les deux sources de pression pour voir les différences entre les parois.
8. Pour explorer `PV^γ`, lancer un trajet assez lent pour accumuler plusieurs fenêtres de pression complètes. Examiner `ln(P) = f(ln(V))`, la pente ajustée et le γ apparent. Une pente proche de −2 est une comparaison avec la référence isotrope 2D, pas une propriété imposée à la simulation.

## Modèle scientifique

Les particules sont ponctuelles, de masse identique, sans interaction entre elles. Elles se déplacent en ligne droite entre les collisions avec les parois. Les petits disques dessinés sont des repères visuels : ils n’ont pas de volume exclu et peuvent se superposer. Ce choix représente la limite d’un gaz parfait sans collisions moléculaires.

Les quatre parois sont isolantes. Une collision avec une paroi fixe conserve l’énergie cinétique. Pour un piston de vitesse horizontale `u`, la vitesse horizontale d’une particule devient `vx′ = 2u − vx`. La composante verticale est conservée. La collision est élastique dans le référentiel du piston, mais elle échange du travail avec le gaz dans le référentiel de l’enceinte.

Le modèle emploie des unités réduites avec `m = 1` et `kB = 1`. Les longueurs, temps, énergies, températures et pressions affichés sont donc des unités de simulation ; ils ne correspondent pas directement à des mètres, secondes, kelvins ou pascals.

### Aire et pression en 2D

La grandeur appelée volume est ici l’aire `V = L × H`. La pression en deux dimensions est une force par unité de longueur de paroi. Il faudrait définir une épaisseur et une conversion d’unités pour en tirer une pression tridimensionnelle.

La pression affichée est calculée à partir des collisions : l’impulsion normale transférée aux parois est divisée par la longueur de paroi et le temps de mesure. Une fenêtre glissante d’environ deux unités de temps réduit les fluctuations sans les supprimer. Le calcul tient compte de la longueur des parois pendant le déplacement du piston. Une lecture avant accumulation d’un temps de mesure suffisant est moins représentative.

La pression utilisée dans la carte et les graphiques peut être la moyenne sur les quatre parois, pondérée par leur longueur, ou celle du piston. Les pressions des parois peuvent être différentes pendant une transformation. La relation `P = N T / V` est une référence d’équilibre isotrope ; elle ne sert pas à fabriquer la mesure de pression.

La pression est une moyenne sur les instants précédents, tandis que le volume et la température sont instantanés. Pendant un déplacement rapide, cette fenêtre de mesure introduit donc un retard dans les graphiques. Un écart à une relation théorique peut venir de ce retard, des fluctuations ou de l’état hors équilibre du gaz.

### Énergie et température cinétique

L’énergie cinétique est `E = Σ (vx² + vy²) / 2`. L’indicateur de température cinétique est `Tcin = E / N`, relation correspondant à deux degrés de liberté avec `kB = 1`.

Les composantes directionnelles sont `Tx = moyenne(vx²)` et `Ty = moyenne(vy²)`, avec `Tcin = (Tx + Ty) / 2`. Elles permettent de voir l’anisotropie créée par le piston. En l’absence de collisions entre particules, cette anisotropie ne se résorbe pas spontanément. Pendant un état hors équilibre, `Tcin` est un indicateur d’énergie et ne garantit pas l’existence d’une température thermodynamique unique. Le mouvement collectif éventuel est inclus dans cet indicateur.

Cette version permet d’explorer une loi adiabatique d’équilibre telle que `PV^γ = constante`, mais ne garantit pas ses conditions de validité. Il faudrait un mécanisme de rééquilibration et une transformation quasi statique pour confronter quantitativement le modèle à cette loi. La distinction entre détente libre et détente adiabatique quasi statique est présentée dans [OpenStax, Adiabatic Processes for an Ideal Gas](https://openstax.org/books/university-physics-volume-2/pages/3-6-adiabatic-processes-for-an-ideal-gas).

### Distributions microscopiques

Les histogrammes affichent la norme de la vitesse `|v| = √(vx² + vy²)` et l’énergie cinétique individuelle `Ec = (vx² + vy²) / 2`. Il ne s’agit pas de la distribution d’une composante signée de la vitesse. Ils comparent l’état actuel à l’état initial sur les mêmes classes.

Les ordonnées sont des densités normalisées : l’aire totale des barres vaut 1 pour chaque distribution. Leur hauteur dépend de la largeur des classes ; elle n’est pas directement un nombre de particules. Les histogrammes correspondent aux particules présentes à l’instant affiché, sans moyenne temporelle ni ajustement automatique à une distribution théorique. Ils ne supposent pas une loi de Maxwell à trois dimensions.

### Travail et bilan énergétique

Le travail de pression reçu par le gaz s’écrit `Wpression = −∫ Ppiston dV`. Ici, la force est une succession d’impulsions. Pour un choc transmettant une impulsion normale `J` au piston de vitesse `u`, la contribution est `δWpression = −uJ`. Le moteur additionne ces contributions, sans intégrer une pression lissée après coup.

Le moteur calcule séparément le travail à partir des variations d’énergie cinétique produites par les collisions avec le piston. Les deux calculs sont équivalents pour ces chocs élastiques et permettent de contrôler le bilan. Le travail reçu est positif lors d’une compression et négatif lors d’une détente avec travail. Les parois étant isolantes, `Q = 0` et le bilan attendu est `E − E0 = Wreçu`.

La puissance de pression affichée est la somme des travaux sur la fenêtre de mesure, divisée par sa durée. Le produit d’une pression moyennée par la vitesse instantanée du piston ne donne pas nécessairement cette moyenne, notamment lors d’un changement de vitesse ou d’une inversion.

Une détente libre agrandit instantanément l’espace accessible sans collision avec une paroi en déplacement : le travail est nul et l’énergie reste constante. Une compression instantanée n’est pas proposée, car elle placerait une paroi à travers des particules sans préciser le processus physique.

## Mouvements du piston

- Vitesse constante : déplacement linéaire vers la cible pendant la durée choisie.
- Mouvement progressif : demi-cosinus, avec départ et arrivée à vitesse nulle.
- Oscillation : allers-retours progressifs entre la position de départ et la cible ; la durée règle un trajet simple.
- Détente libre : augmentation immédiate de la largeur accessible, sans travail.

Les collisions utilisent les vitesses du piston. Pour une trajectoire courbe, de petits pas de temps approchent sa trajectoire par des segments linéaires.

## Vérifications

Les tests s’exécutent avec Node.js :

```sh
node --test tests/*.test.mjs
```

La suite vérifie le moteur physique, les analyses numériques et des scénarios de commandes exécutés avec le moteur réel et un DOM simulé. Elle couvre notamment les bornes du nombre de particules, les butées du piston, la pause, les mouvements successifs, la réinitialisation, les distributions et le téléchargement des mesures.

## Graphiques et exploitation des mesures

Le graphique d’évolution utilise `V0` et `T0` de l’état initial ; `P0 = N T0 / V0` est sa pression théorique isotrope. Le diagramme P–V trace les pressions mesurées.

Le graphique `PV = f(T)` utilise le produit de la pression mesurée et du volume. La droite `PV = NT` est une référence d’équilibre, distincte des points calculés à partir des chocs.

Pour un gaz ponctuel à deux degrés de liberté de translation, on déduit de l’équipartition et de la relation entre capacités thermiques la référence isotrope `Cv = N kB`, `Cp = 2 N kB` et `γ = Cp/Cv = 2`. C’est l’application à deux dimensions des relations exposées dans [OpenStax, Heat Capacities of an Ideal Gas](https://openstax.org/books/university-physics-volume-2/pages/3-5-heat-capacities-of-an-ideal-gas). Si une transformation satisfait `PV^γ = C`, alors `ln(P) = ln(C) − γ ln(V)` : la pente est donc `−γ`. Écrire les logarithmes de rapports à un état de référence change seulement l’origine des axes, sans modifier la pente.

L’ajustement logarithmique porte sur le dernier trajet du piston, ou sa dernière demi-période en oscillation. Il exclut les phases de repos et la détente libre. La pression doit être strictement positive et sa fenêtre de deux unités de temps doit être entièrement comprise dans ce même trajet. Les points retenus pour l’ajustement sont espacés d’au moins deux unités de temps afin que leurs fenêtres ne se recouvrent pas. Il faut au moins trois points et une variation suffisante du logarithme du volume ; sinon, l’application demande de ralentir ou d’allonger le déplacement.

Le γ de référence est réglable pour comparer une hypothèse à la pente observée et à la variation de `PV^γ`. La valeur initiale 2 correspond à la référence isotrope 2D ; changer ce réglage ne modifie pas la dynamique du gaz.

Le résultat de l’ajustement est un **γ apparent** et un coefficient `R²` descriptif. Il ne constitue pas une validation automatique de la loi adiabatique : les limites du modèle, les fluctuations et le retard de mesure restent à examiner. Mélanger les deux branches d’une oscillation ou de longues phases à volume fixe fausserait cette interprétation.

L’export CSV contient au plus les 6 000 derniers relevés, pris environ tous les 0,1 u.t. (plus les événements de commande). Il permet d’exploiter les pressions des parois, `PV`, les logarithmes lorsque la pression est positive, les températures directionnelles, le travail et la puissance de pression, ainsi que les identifiants du trajet. Les mesures ne sont pas enregistrées après fermeture ou réinitialisation.

Les critères scientifiques sont la conservation de l’énergie à piston fixe, le confinement des particules, le bilan `E − E0 − Wreçu` pendant les mouvements, la conservation d’énergie lors d’une détente libre et la convergence statistique de la pression vers `NT/V` pour un gaz initial isotrope dans une enceinte fixe. Les mesures de pression nécessitent un temps d’observation suffisamment long.

Les principales limites sont le petit nombre de particules, les fluctuations statistiques, l’absence d’interactions moléculaires, l’absence de rééquilibration entre les directions, les unités réduites et la géométrie bidimensionnelle. Le démonstrateur vise l’exploration des mécanismes microscopiques, sans prédire quantitativement le comportement d’un gaz réel.
