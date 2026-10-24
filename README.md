# Gaz 2D — Visite guidée du laboratoire

**[Ouvrir le démonstrateur](https://fmath92.github.io/gaz-2d/)** · [Code source](https://github.com/fmath92/gaz-2d)

Un laboratoire de thermodynamique pour relier les collisions microscopiques à la pression, au travail et à la chaleur. La version 0.5 réunit la simulation et les courbes sur le même écran de travail et organise la navigation par expériences.

## La visite

| Étape | Expérience | À observer |
| --- | --- | --- |
| 01 | Pression et travail | Impulsion d’un choc, somme des impulsions, jauge de pression ; piston immobile puis mobile. |
| 02 | Échanges thermiques | Choc sur la paroi gauche, énergie avant/après, chaleur signée et flux moyen ; thermostat ou isolation. |
| 03 | Joule–Gay–Lussac | Ouverture vers le vide (doublement du volume par défaut), énergie et température conservées en mode isolé. |
| 04 | Détente adiabatique | Travail fourni par le gaz, refroidissement et influence de la durée du mouvement. |
| 05 | Compression adiabatique | Travail reçu, échauffement et influence de la durée du mouvement. |
| 06 | Comparer les modèles | Deux simulations simultanées : points sans interaction et disques durs, chacune avec 1 000 particules. |

Toutes les expériences utilisent **1 000 particules** : aucun sélecteur de nombre n’est présent. Les points et les disques sont dessinés avec le même rayon 0,04. Ce rayon est seulement graphique pour les points ; il est physique pour les disques durs.

Chaque onglet garde son état, ses réglages, sa pause et ses mesures jusqu’au rechargement de la page. Seule l’expérience affichée évolue. « Recommencer » efface les données de l’expérience courante. L’expérience de cycles périodiques a été retirée de l’interface ; les déplacements proposés sont des trajets simples, à vitesse constante ou progressifs.

## Observer et mesurer

La cavité et les tracés restent côte à côte sur ordinateur. Sur écran étroit, les panneaux s’empilent. Le commutateur principal passe entre :

- **Évolution P, V, T** : rapports P/P₀, V/V₀ et T/T₀, sur une même échelle. P₀ = NT₀/V₀ est la référence idéale initiale, indépendante de la pression mesurée. V est tracé en pointillés pour rester identifiable lorsque V/V₀ et T/T₀ se superposent.
- **PV/T au cours du temps** : pression réellement mesurée × volume / température, avec la référence idéale NkB = 1 000. Dans la comparaison, les deux gaz ont chacun leur courbe.

Les cartes au-dessus donnent les valeurs instantanées. La pression est calculée sur une fenêtre glissante de deux unités de temps. La première fenêtre est partielle ; pendant une transformation, la pression garde aussi la mémoire des instants précédents. Un écart à PV/T = 1 000 peut donc venir des fluctuations, du retard de mesure, de l’anisotropie ou, pour les disques durs, de leur taille finie.

Les autres diagrammes (P–V, P–T, V–T, PV = f(T), ln(P) = f(ln(V))), les histogrammes, le choix du capteur de pression, la température initiale et les explications sont regroupés dans **Approfondir**. Le graphique choisi y remplace le tracé principal, sans faire disparaître la cavité. Le saut de volume d’une détente libre n’est pas relié par un segment dans P–V : il ne définit pas un travail de pression.

La lecture peut être ralentie jusqu’à ×0,05, accélérée jusqu’à ×4, mise en pause ou avancée par pas de 0,02 u.t. Le ralentissement change le temps simulé écoulé par seconde réelle ; il ne modifie ni les collisions ni les paramètres physiques. Pour garder une interface réactive, le calcul peut ralentir sous charge, sans sauter de pas physique. Les deux gaz de comparaison restent synchronisés.

## Les collisions à la loupe

**Isoler un choc** fait avancer le calcul jusqu’à un nouvel événement enregistré, puis met en pause. La loupe affiche un schéma de cet impact, ses vitesses et ses échanges, avec son instant. La cavité montre l’état courant et un repère à l’emplacement enregistré. Les flèches bleues et vertes correspondent aux vitesses relatives à la paroi avant et après le choc ; à paroi fixe, elles sont aussi les vitesses dans le laboratoire.

Les données du zoom proviennent du moteur : date, position, particule, vitesses entrantes et sortantes, impulsion, travail et chaleur. En mode ponctuel, les collisions de différentes particules sont calculées séparément : le moteur retient l’événement le plus récent **par sa date physique**, et non par son ordre d’appel. L’instrumentation ne change pas la dynamique ni le tirage aléatoire du thermostat.

Dans la comparaison, la partie « disques » du zoom représente un choc mutuel réellement calculé. La partie « points » est une illustration comparative : elle prolonge les mêmes vitesses entrantes sans interaction. Elle ne prétend pas être une collision enregistrée dans l’autre gaz. Les deux vues d’ensemble et les deux courbes PV/T proviennent, elles, de deux simulations indépendantes.

## Pression, travail et chaleur

Le modèle emploie m = kB = 1 et des unités réduites. Le « volume » est l’aire V = L × H. En 2D, la pression est une force par longueur de paroi.

Au piston, l’impulsion normale reçue par la paroi vaut J = m(vx avant − vx après). La pression affichée dans l’expérience 01 utilise :

```text
Ppiston = somme(J) / (H × durée de la fenêtre)
δW reçu par le gaz = −u J
```

La jauge utilise cette pression mesurée, avec une échelle visuelle de 0 à quatre fois la pression idéale initiale. La valeur numérique n’est pas plafonnée. À piston immobile, u = 0 : chaque choc peut transmettre une impulsion non nulle, mais son travail est nul. Lorsque le piston avance ou recule, le zoom affiche séparément son impulsion et le travail reçu par le gaz.

Le travail cumulé est calculé aux impacts et non à partir d’une pression déduite de l’équation d’état. Son lien avec un diagramme est W reçu = −∫Ppiston dV. Une intégrale utilisant la pression glissante reste une estimation, et les aires de P–T ou de V–T ne sont pas des travaux.

Dans l’expérience 02, **seule la paroi gauche** est reliée au thermostat par défaut ; les autres parois sont isolées et le piston reste fixe. Une option avancée étend le contact thermique à toutes les parois. L’isolation, la température de paroi et la fraction de chocs thermalisés peuvent changer pendant la simulation, sans modifier immédiatement les vitesses ni effacer le cumul de chaleur.

Lors d’un choc thermique, le moteur tire la vitesse sortante dans le référentiel de la paroi : normale intérieure suivant la loi de flux `|cn| = √(−2 Tb ln U)` et tangente gaussienne de variance Tb. La chaleur reçue est la variation d’énergie dans ce référentiel. À paroi fixe :

```text
δQ = Ec après − Ec avant
flux thermique moyen 2D = somme(δQ) / (longueur × durée)
```

La flèche thermique traverse le point de contact dans le sens de l’énergie échangée. Un choc peut chauffer ou refroidir, même avec un thermostat plus chaud que le gaz : c’est le bilan moyen qui détermine l’évolution de la température. Le flux affiché est celui de la paroi gauche sur la fenêtre de mesure, alors que Q cumule tous les échanges depuis l’état initial. Le premier principe est toujours vérifié : **ΔE = W + Q**. Le modèle de réflexion est celui décrit dans la [documentation LAMMPS des parois stochastiques](https://docs.lammps.org/fix_wall_reflect_stochastic.html).

## Deux modèles et leurs limites

Le gaz ponctuel contient des particules sans interaction mutuelle. Les chocs isolés sur les parois sont élastiques ; au piston de vitesse u, vx après = 2u − vx avant. Un piston peut rendre les températures directionnelles différentes : Tx = moyenne(vx²), Ty = moyenne(vy²). Sans collisions mutuelles, leur différence ne se résorbe pas spontanément.

Les disques durs ont un rayon 0,04. Ils sont placés sans recouvrement et leur centre reste à cette distance des parois. Un choc entre deux disques conserve exactement, aux arrondis numériques près, l’énergie cinétique et la quantité de mouvement de la paire. L’énergie échangée entre particules n’est ni W ni Q, car elle reste interne au gaz.

Le moteur prédit les dates de contact, les traite dans une file de priorité et invalide les prédictions après les changements de vitesse. Une grille spatiale filtre les paires candidates initiales ; les paires impliquant des particules dont la vitesse a changé sont recalculées. Cette méthode suit le principe de la [simulation événementielle de disques durs de Princeton](https://algs4.cs.princeton.edu/61event/index.php). Aucun rééchelonnement global d’énergie ni déplacement correctif de recouvrement n’est appliqué.

La comparaison commence avec les mêmes vitesses initiales, N, V et T. Les positions diffèrent pour placer les disques sans recouvrement. Leur fraction de surface est Nπr²/V, affichée dans l’interface. Leur taille finie introduit un volume exclu : PV/T peut dépasser N même à l’équilibre. Les collisions élastiques seules ne définissent pas toutes les propriétés d’un gaz réel. Il n’y a pas d’attraction ni d’énergie potentielle à distance : une détente libre isolée conserve donc T dans les deux modèles.

Tcin = Ec/N est un indicateur d’énergie, incluant le mouvement collectif éventuel. Une loi adiabatique idéale PV^γ = constante suppose une évolution quasi statique et un gaz isotrope ; γ = 2 est la référence idéale 2D à deux degrés de liberté. L’ajustement logarithmique utilise le dernier trajet, au moins trois fenêtres de pression entièrement incluses dans ce trajet et non recouvrantes. Il produit un exposant apparent, sans prouver ces hypothèses. La détente libre est exclue de cet ajustement. Voir [OpenStax : processus adiabatiques](https://openstax.org/books/university-physics-volume-2/pages/3-6-adiabatic-processes-for-an-ideal-gas).

**Contacts thermiques multiples.** Sous compression rapide, des disques peuvent toucher simultanément une paroi et d’autres disques. Pour éviter une répétition sans vol libre des tirages thermiques, une seule réémission par particule est autorisée au même instant numérique (tolérance 10⁻¹⁰ u.t.) ; les réflexions supplémentaires sont élastiques. Cette convention conserve ΔE = W + Q, mais limite l’interprétation des contacts multiples. Leur compteur est affiché dans les explications et exporté.

## Export et conservation des données

L’export CSV regroupe les relevés de l’expérience courante : pressions mesurées, température, volume, PV/T, travail, chaleur, bilan, modèle, collisions et conditions thermiques. La comparaison produit une ligne par gaz et par instant, permettant de vérifier les deux bilans séparément. Les valeurs sont séparées par des points-virgules, avec une virgule décimale.

Chaque expérience conserve au plus 6 000 relevés, environ un tous les 0,1 u.t., plus les commandes et arrêts sur événement. Les deux histogrammes utilisent des densités normalisées et les mêmes classes pour les états comparés. Dans la comparaison, les barres représentent le gaz ponctuel et les pointillés les disques ; ailleurs, les pointillés représentent l’état initial. Les mesures ne sont pas sauvegardées après fermeture de la page.

## Exécution, validation et publication

Ouvrir `dist/index.html` directement dans un navigateur récent, ou utiliser :

```sh
python3 -m http.server 8080 --directory dist
```

Puis ouvrir <http://localhost:8080>. Aucun build, dépendance applicative ou accès réseau n’est nécessaire à la simulation.

```sh
node --test tests/*.test.mjs
```

Les tests vérifient les conservations, le confinement, les collisions, les thermostats sélectifs, les observations avant/après, les diagrammes et les commandes. Les scénarios d’interface exécutent le vrai moteur et le code applicatif avec un DOM et un Canvas simulés ; l’apparence est également contrôlée dans un navigateur. Le module d’analyse des cycles de la version précédente est conservé dans les sources, mais n’est plus chargé par l’interface.

GitHub Pages publie automatiquement la branche `main`, depuis la racine du dépôt. `index.html` redirige vers `dist/` et `.nojekyll` demande un service statique sans transformation. Le dépôt est public : pousser les changements sur `main` met à jour le démonstrateur.
