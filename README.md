# Gaz 2D — Laboratoire de thermodynamique

Ce démonstrateur relie le mouvement des particules aux mesures de pression, d’aire et d’énergie cinétique. Un piston permet de comparer des détentes, des compressions et une détente libre. Les parois peuvent être isolantes ou en contact avec un thermostat. Le choix entre particules ponctuelles et disques durs à collisions élastiques permet de comparer deux modèles. Les distributions, les diagrammes et les bilans par période permettent d’explorer le lien entre l’état microscopique, le travail et la chaleur.

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

1. Dans **Expérimenter**, choisir **Joule–Gay–Lussac**, **Détente adiabatique**, **Compression adiabatique** ou **Cycles du piston**. Un preset prépare un nouvel état isolé et efface les mesures ; **Laboratoire libre** conserve l’état et ouvre les commandes personnalisées.
2. Faire une prédiction. Régler le volume cible et, sauf en détente libre, la durée du trajet. Lancer l’expérience et observer le piston ainsi que P, V et T. Joule–Gay–Lussac part d’une largeur 9 et ouvre instantanément jusqu’à 18 : le volume double, W = Q = 0 et T reste constante.
3. Dans **Diagrammes**, comparer P–V, P–T et V–T. Le bilan W, Q, ΔE apparaît à côté du graphique. Déplier les réglages pour changer le capteur de pression, la superposition ou le nombre de cycles ; déplier l’analyse du parcours pour les aires, reconstructions et bilans détaillés. Les six graphiques et les deux exports CSV restent disponibles.
4. Dans **Particules**, regarder les distributions de vitesse et d’énergie. Régler de 10 à 1 000 particules et la température initiale. Choisir les collisions mutuelles, puis **Appliquer et recommencer**. Changer ce choix seul ne modifie pas le gaz en cours. Le modèle actif, les chocs mutuels, la fraction de surface occupée et Tx/Ty sont affichés.
5. Comparer une détente adiabatique avec et sans collisions : les disques durs peuvent redistribuer l’énergie entre les directions. Leur taille finie apporte aussi un volume exclu ; il ne s’agit pas simplement du même gaz parfait muni de collisions.
6. Revenir à **Expérimenter**, sélectionner le thermostat et régler sa température au curseur ou au clavier. À volume fixe, W = 0 et ΔE = Q. Reprendre les cycles pour comparer W, Q et ΔE par période. La température du gaz n’est pas imposée instantanément, même au contact du thermostat.
7. Ouvrir **Comprendre** pour les explications et limites : unités réduites, température cinétique, gaz hors équilibre, pression lissée, aire d’un cycle, modèle de paroi et hypothèses adiabatiques.

Changer d’onglet conserve les particules, la pause et les mesures. Pause/reprise, réinitialisation et vitesse de lecture restent accessibles en haut de chaque onglet. Les touches fléchées, Début et Fin permettent de parcourir les onglets au clavier. Le réglage ×1 à ×8 accélère le temps simulé sans changer le mouvement prescrit. Lorsque le calcul devient coûteux, la lecture ralentit pour préserver la réactivité de l’interface ; aucun pas physique n’est sauté.

## Modèle scientifique

Par défaut, les particules sont ponctuelles, de masse identique, sans interaction entre elles. Elles se déplacent en ligne droite entre les collisions avec les parois. Les petits disques dessinés sont des repères visuels : ils n’ont pas de volume exclu et peuvent se superposer. Ce choix représente la limite d’un gaz parfait sans collisions moléculaires.

Le modèle optionnel de **disques durs** donne à chaque particule un rayon physique de 0,04 u.r. Les centres restent à cette distance des parois et deux particules se heurtent lorsque leurs centres sont séparés de 0,08. Le placement initial est reproductible, sans recouvrement, et les vitesses initiales sont identiques à celles du mode ponctuel pour le même N, T et germe.

Les chocs mutuels sont parfaitement élastiques, sans frottement ni rotation : la composante relative normale à la ligne des centres est inversée. La quantité de mouvement de la paire et son énergie cinétique sont conservées. Ces échanges internes n’ajoutent rien aux compteurs W ou Q. La surface occupée vaut `N π r² / V` ; elle permet d’évaluer la densité du modèle. Les disques sont dessinés à leur taille physique, les points du modèle idéal avec un rayon purement visuel.

Le moteur résout les dates de contact dans chaque segment linéaire du piston. Une file de priorité traite les événements dans l’ordre et invalide les prédictions après chaque choc. Une grille spatiale filtre les paires initiales ; les prédictions des particules dont la vitesse change sont recalculées. Cette approche suit le principe de la [simulation événementielle de disques durs présenté par Princeton](https://algs4.cs.princeton.edu/61event/index.php). Aucun déplacement correctif de recouvrement ni rééchelonnement d’énergie n’est appliqué.

La taille finie est un premier écart au modèle idéal : à densité élevée, `PV = NT` n’est plus une équation d’état exacte, même à l’équilibre. Il n’y a pas d’attraction ni d’énergie potentielle à distance. La détente libre isolée conserve donc l’énergie cinétique et T dans les deux modèles ; ces disques ne reproduisent pas le refroidissement ou l’échauffement de tous les gaz réels.

En mode isolé, les collisions avec les parois sont élastiques. Une paroi fixe conserve l’énergie cinétique. Pour un piston isolé de vitesse horizontale `u`, la vitesse horizontale devient `vx′ = 2u − vx` et la composante verticale est conservée. Le choc conserve l’énergie cinétique dans le référentiel du piston, mais échange du travail avec le gaz dans le référentiel de l’enceinte.

Le modèle emploie des unités réduites avec `m = 1` et `kB = 1`. Les longueurs, temps, énergies, températures et pressions affichés sont donc des unités de simulation ; ils ne correspondent pas directement à des mètres, secondes, kelvins ou pascals.

### Aire et pression en 2D

La grandeur appelée volume est ici l’aire `V = L × H`. La pression en deux dimensions est une force par unité de longueur de paroi. Il faudrait définir une épaisseur et une conversion d’unités pour en tirer une pression tridimensionnelle.

La pression affichée est calculée à partir des collisions : l’impulsion normale transférée aux parois est divisée par la longueur de paroi et le temps de mesure. Une fenêtre glissante d’environ deux unités de temps réduit les fluctuations sans les supprimer. Le calcul tient compte de la longueur des parois pendant le déplacement du piston. Une lecture avant accumulation d’un temps de mesure suffisant est moins représentative.

La pression utilisée dans la carte et les graphiques peut être la moyenne sur les quatre parois, pondérée par leur longueur, ou celle du piston. Les pressions des parois peuvent être différentes pendant une transformation. La relation `P = N T / V` est une référence idéale d’équilibre isotrope ; elle ne sert pas à fabriquer la mesure de pression.

La pression est une moyenne sur les instants précédents, tandis que le volume et la température sont instantanés. Pendant un déplacement rapide, cette fenêtre de mesure introduit donc un retard dans les graphiques. Un écart à une relation théorique peut venir de ce retard, des fluctuations ou de l’état hors équilibre du gaz.

### Énergie et température cinétique

L’énergie cinétique est `E = Σ (vx² + vy²) / 2`. L’indicateur de température cinétique est `Tcin = E / N`, relation correspondant à deux degrés de liberté avec `kB = 1`.

Les composantes directionnelles sont `Tx = moyenne(vx²)` et `Ty = moyenne(vy²)`, avec `Tcin = (Tx + Ty) / 2`. Elles permettent de voir l’anisotropie créée par le piston. En mode isolé et sans collisions entre particules, cette anisotropie ne se résorbe pas spontanément. Les chocs diffus sur des parois thermalisées peuvent en revanche modifier les deux composantes et contribuer à leur relaxation. Pendant un état hors équilibre, `Tcin` est un indicateur d’énergie et ne garantit pas l’existence d’une température thermodynamique unique. Le mouvement collectif éventuel est inclus dans cet indicateur.

Cette version permet d’explorer une loi adiabatique d’équilibre telle que `PV^γ = constante`, mais ne garantit pas ses conditions de validité. Les collisions mutuelles fournissent un mécanisme de rééquilibration, mais il faut encore un mouvement suffisamment lent et un gaz suffisamment dilué pour comparer à la référence idéale γ = 2. La distinction entre détente libre et détente adiabatique quasi statique est présentée dans [OpenStax, Adiabatic Processes for an Ideal Gas](https://openstax.org/books/university-physics-volume-2/pages/3-6-adiabatic-processes-for-an-ideal-gas).

### Distributions microscopiques

Les histogrammes affichent la norme de la vitesse `|v| = √(vx² + vy²)` et l’énergie cinétique individuelle `Ec = (vx² + vy²) / 2`. Il ne s’agit pas de la distribution d’une composante signée de la vitesse. Ils comparent l’état actuel à l’état initial sur les mêmes classes.

Les ordonnées sont des densités normalisées : l’aire totale des barres vaut 1 pour chaque distribution. Leur hauteur dépend de la largeur des classes ; elle n’est pas directement un nombre de particules. Les histogrammes correspondent aux particules présentes à l’instant affiché, sans moyenne temporelle ni ajustement automatique à une distribution théorique. Ils ne supposent pas une loi de Maxwell à trois dimensions.

### Parois isolantes ou en contact avec un thermostat

En mode isolé, les parois ne transmettent pas de chaleur : `Q = 0`. En mode thermostat, elles représentent une surface à température `Tb` imposée par un réservoir d’énergie. Le piston peut être inclus dans ce contact thermique ou conserver une réflexion isolante.

Le paramètre d’accommodation `α`, compris entre 0 et 1, est la probabilité qu’un choc soit diffus et thermalisé ; les autres chocs sont spéculaires. `α = 0` retrouve la réflexion isolante, et `α = 1` thermalise les chocs sur les parois concernées, sous la réserve de contacts multiples décrite ci-dessous pour les disques durs. C’est le principe du modèle de réflexion de Maxwell décrit dans la [documentation LAMMPS des parois stochastiques](https://docs.lammps.org/fix_wall_reflect_stochastic.html).

Pour un choc thermalisé, les vitesses sont tirées dans le référentiel de la paroi. La composante tangentielle est gaussienne, de variance `Tb`. La composante normale est dirigée vers l’intérieur et suit la distribution de flux : `|cn′| = √(−2 Tb ln U)`, avec `U` uniforme entre 0 et 1. Ce tirage normal tient compte du fait que les particules rapides rencontrent plus souvent les parois ; une simple demi-gaussienne ne donne pas le même thermostat.

La température du thermostat, le mode thermique et l’accommodation peuvent changer pendant la simulation. Ces changements ne rééchelonnent pas les vitesses et n’ajoutent pas de chaleur instantanément : les échanges se produisent lors des collisions suivantes. Repasser en mode isolé n’efface pas la chaleur cumulée ; seuls les nouveaux échanges thermiques cessent. Il n’est donc pas garanti que `Tgaz = Tb` pendant un mouvement rapide. Le réservoir est idéal, sa température ne varie pas quand il échange de l’énergie, et sa capacité thermique n’est pas simulée.

**Convention numérique pour les contacts multiples de disques durs.** Une compression très rapide peut amener des disques simultanément contre une paroi thermique et d’autres disques. Réémettre plusieurs fois à la même date peut alors créer une boucle sans vol libre. Une seule émission thermique est autorisée par particule à un même instant numérique (tolérance `10⁻¹⁰ u.t.`) ; les réflexions supplémentaires à cet instant sont spéculaires. Cette convention particulière conserve `ΔE = W + Q`, mais elle limite l’interprétation du thermostat dans les contacts multiples. Le compteur correspondant est accessible dans **Comprendre → Le modèle de disques durs** et dans le CSV.

### Travail, chaleur et bilan énergétique

La convention est celle des échanges **reçus par le gaz** : `W > 0` quand le piston lui fournit de l’énergie et `Q > 0` quand les parois lui fournissent de la chaleur. Les valeurs cumulées repartent de zéro lors de la création d’un nouvel état. Le bilan attendu est `E − E0 = W + Q`. Cette convention est l’opposée du signe du travail fourni par le gaz utilisé dans la présentation [OpenStax du premier principe](https://openstax.org/books/university-physics-volume-2/pages/3-3-first-law-of-thermodynamics).

Le travail de pression reçu s’écrit `Wpression = −∫ Ppiston dV`. La force du moteur est une succession d’impulsions. Pour un choc transmettant une impulsion normale `J` au piston de vitesse `u`, sa contribution mécanique est `δWpression = −uJ`. Le moteur additionne ces contributions ; il n’intègre pas une pression lissée après coup pour calculer ce travail.

Lors d’un choc avec une paroi mobile, la chaleur est la variation d’énergie cinétique dans son référentiel : `δQ = (|c′|² − |c|²) / 2`, où `c` et `c′` sont les vitesses avant et après le choc relatives à la paroi. La variation dans le référentiel de l’enceinte vérifie alors `δE = δW + δQ`. Pour une paroi fixe, `δW = 0` et `δQ = δE`. Un choc spéculaire ne transmet pas de chaleur. Cette séparation évite de compter l’échange mécanique du piston comme de la chaleur.

Le moteur calcule également le travail à partir de `δE − δQ` pour contrôler le calcul par impulsions. Il affiche la chaleur nette, la somme des contributions reçues positives et des contributions cédées négatives, ainsi que le bilan. Les puissances thermique et mécanique sont les sommes des échanges dans la fenêtre de mesure, divisées par sa durée. Le produit d’une pression moyennée et de la vitesse instantanée n’est pas nécessairement la moyenne de la puissance.

Une détente libre agrandit instantanément l’espace accessible sans collision avec une paroi en déplacement : l’ouverture a un travail et une chaleur nuls et laisse les vitesses inchangées. Ensuite, en mode isolé, l’énergie reste constante ; en mode thermostat, elle peut évoluer par les chocs thermiques. Une compression instantanée n’est pas proposée, car elle placerait une paroi à travers des particules sans préciser le processus physique.

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

La suite vérifie le moteur physique, les analyses numériques et des scénarios de commandes exécutés avec le moteur réel et un DOM simulé. Elle couvre notamment les bornes du nombre de particules, les butées du piston, la pause, les mouvements successifs, la réinitialisation, les distributions, les échanges thermiques, les bilans par période et le téléchargement des mesures.

## Graphiques et exploitation des mesures

Le graphique d’évolution utilise `V0` et `T0` de l’état initial ; `P0 = N T0 / V0` est sa pression théorique isotrope. Les diagrammes P–V et P–T tracent la pression mesurée ; le diagramme V–T relie l’aire de la cavité et la température cinétique. Les tracés conservent plusieurs périodes du piston avec des couleurs successives et des indications du sens du parcours.

### Périodes du piston et aire dans le diagramme P–V

Un aller-retour périodique complet du piston est une **période mécanique** : le volume revient à sa valeur de départ. Le gaz peut cependant présenter une pression ou une température différente à la fin, notamment pendant son échauffement ou sa relaxation. Il ne s’agit d’un cycle thermodynamique fermé que si son état revient également au départ, comme le rappelle [OpenStax sur les processus cycliques](https://openstax.org/books/university-physics-volume-2/pages/3-4-thermodynamic-processes). Il faut donc conserver `ΔE` dans le bilan d’une période ; on ne suppose pas automatiquement `W + Q = 0`. L’interface indique les écarts de pression et de température. Son critère de proximité à 5 % reste descriptif et ne prouve pas un retour exact au même état.

Pour un parcours fermé du diagramme P–V, l’intégrale orientée `∮ P dV` est le travail **fourni** par le gaz ; le travail **reçu** est son opposé. Un parcours horaire a un travail fourni positif et un travail reçu négatif. La différence entre les deux branches contribue à l’aire algébrique ; des lobes de sens opposés peuvent se compenser. La relation entre travail et aire est illustrée dans [OpenStax, PV Diagrams and their Relationship to Work](https://openstax.org/books/college-physics-ap-courses/pages/15-2-the-first-law-of-thermodynamics-and-some-simple-processes).

L’application rapproche deux quantités différentes : le travail exact enregistré aux chocs du piston et `−∫ Ppiston dV` estimé par trapèzes sur les points du tracé. L’estimation utilise toujours la pression **au piston**, qui intervient dans le travail, et non la moyenne des quatre parois. La pression du tracé est une moyenne glissante passée alors que `V` est instantané : son retard, les fluctuations et l’échantillonnage peuvent produire une aire et un travail estimé différents du travail exact, surtout lors des déplacements rapides. Un accord ne doit pas être imposé en reconstruisant artificiellement la pression à partir du travail.

Une option distincte reconstruit une pression mécanique effective par intervalle : `Peff = −δW/δV`. Les retournements du piston sont conservés dans les relevés afin de séparer les déplacements opposés. L’aire de ce tracé retrouve le travail par construction ; elle illustre sa définition et ne valide pas indépendamment la pression mesurée.

Un parcours tronqué n’est pas fermé artificiellement pour lui attribuer une aire de cycle. Le tableau conserve, pour chaque période, le travail reçu, la chaleur, `ΔE` et leur écart au bilan, indépendamment de l’estimation graphique. Les aires des diagrammes P–T et V–T n’ont pas directement l’unité d’une énergie et ne sont pas des mesures du travail.

### Autres comparaisons thermodynamiques

Le graphique `PV = f(T)` utilise le produit de la pression mesurée et du volume. La droite `PV = NT` est une référence d’équilibre, distincte des points calculés à partir des chocs.

Pour un gaz ponctuel à deux degrés de liberté de translation, on déduit de l’équipartition et de la relation entre capacités thermiques la référence isotrope `Cv = N kB`, `Cp = 2 N kB` et `γ = Cp/Cv = 2`. C’est l’application à deux dimensions des relations exposées dans [OpenStax, Heat Capacities of an Ideal Gas](https://openstax.org/books/university-physics-volume-2/pages/3-5-heat-capacities-of-an-ideal-gas). Si une transformation satisfait `PV^γ = C`, alors `ln(P) = ln(C) − γ ln(V)` : la pente est donc `−γ`. Écrire les logarithmes de rapports à un état de référence change seulement l’origine des axes, sans modifier la pente.

L’ajustement logarithmique porte sur le dernier trajet du piston, ou sa dernière demi-période en oscillation. Il exclut les phases de repos et la détente libre. La pression doit être strictement positive et sa fenêtre de deux unités de temps doit être entièrement comprise dans ce même trajet. Les points retenus pour l’ajustement sont espacés d’au moins deux unités de temps afin que leurs fenêtres ne se recouvrent pas. Il faut au moins trois points et une variation suffisante du logarithme du volume ; sinon, l’application demande de ralentir ou d’allonger le déplacement.

Le γ de référence est réglable pour comparer une hypothèse à la pente observée et à la variation de `PV^γ`. La valeur initiale 2 correspond à la référence isotrope 2D ; changer ce réglage ne modifie pas la dynamique du gaz.

Le résultat de l’ajustement est un **γ apparent** et un coefficient `R²` descriptif. Il ne constitue pas une validation automatique de la loi adiabatique : les limites du modèle, les fluctuations et le retard de mesure restent à examiner. Mélanger les deux branches d’une oscillation ou de longues phases à volume fixe fausserait cette interprétation.

L’export CSV contient au plus les 6 000 derniers relevés, pris environ tous les 0,1 u.t. (plus les événements de commande). Il permet d’exploiter les pressions des parois, `PV`, les logarithmes lorsque la pression est positive, les températures directionnelles, le travail, la chaleur, leurs puissances, ainsi que les identifiants du trajet. Un export distinct regroupe les bilans des parcours conservés. L’affichage peut montrer les 5, 10 ou 20 derniers parcours, achevés ou en cours, parmi les 100 conservés ; cette mémoire est distincte de la limite des relevés temporels. Les parcours longs peuvent être décimés pour limiter la mémoire, en conservant leurs extrémités et les retournements du piston. Leurs bilans exacts reposent sur les compteurs aux extrémités, tandis que l’intégrale graphique reste une estimation à partir des points conservés. Les mesures ne sont pas enregistrées après fermeture ou réinitialisation.

Les critères scientifiques sont la conservation de l’énergie à piston fixe, le confinement des particules, le bilan `E − E0 − Wreçu − Qreçue` pendant les mouvements et les échanges thermiques, la conservation d’énergie lors d’une détente libre isolée et la convergence statistique de la pression vers `NT/V` pour un gaz initial isotrope dans une enceinte fixe. Les mesures de pression nécessitent un temps d’observation suffisamment long.

Les principales limites sont le petit nombre de particules, les fluctuations statistiques, l’absence d’attractions moléculaires, l’absence de rééquilibration entre directions dans le mode ponctuel, la convention de contacts multiples des disques durs, le modèle idéalisé de thermostat aux parois, les unités réduites et la géométrie bidimensionnelle. Le démonstrateur vise l’exploration des mécanismes microscopiques, sans prédire quantitativement le comportement d’un gaz réel.

## Vérifier les modifications

```sh
node --test tests/*.test.mjs
```

Les tests couvrent les conservations physiques, les collisions obliques et rapides, les disques sans recouvrement jusqu’à 1 000 particules, le thermostat, les mouvements de piston, les cycles et les exports. Les scénarios d’interface exécutent le vrai moteur et les gestionnaires de commandes avec un DOM et un Canvas simulés ; l’apparence et les interactions sont également vérifiées dans un navigateur.
