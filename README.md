# Gaz 2D — Visite guidée du laboratoire

**[Ouvrir le démonstrateur](https://fmath92.github.io/gaz-2d/)** · [Code source](https://github.com/fmath92/gaz-2d)

Un laboratoire de thermodynamique pour relier les collisions microscopiques à la pression, au travail et à la chaleur. La version 0.7.0 réunit la simulation et les courbes sur le même écran de travail et organise la navigation par expériences.

## La visite

| Étape | Expérience | À observer |
| --- | --- | --- |
| 01 | Pression | Un choc à venir, sa poussée sur le piston immobile et sa contribution à la pression. |
| 02 | Échanges thermiques | Parcours automatique de deux chocs : chaleur reçue par le gaz, puis chaleur cédée à la paroi. |
| 03 | Joule–Gay–Lussac | Ouverture vers le vide (doublement du volume par défaut), énergie et température conservées en mode isolé. |
| 04 | Détente et compression adiabatiques | Choix du sens du mouvement ; zoom sur un choc au piston mobile et sur le travail reçu ou fourni. |
| 05 | Comparer les modèles | Deux simulations simultanées : points sans interaction et disques durs, chacune avec 1 000 particules. |

Toutes les expériences utilisent **1 000 particules** : aucun sélecteur de nombre n’est présent. Les points et les disques sont dessinés avec le même rayon 0,04. Ce rayon est seulement graphique pour les points ; il est physique pour les disques durs.

Chaque onglet garde son état, ses réglages, sa pause et ses mesures jusqu’au rechargement de la page. Seule l’expérience affichée évolue. « Recommencer » efface les données de l’expérience courante. L’expérience de cycles périodiques a été retirée de l’interface ; les déplacements proposés sont des trajets simples, à vitesse constante ou progressifs.

## Observer et mesurer

La cavité et les tracés restent côte à côte sur ordinateur. Sur écran étroit, les panneaux s’empilent. Le commutateur principal passe entre :

- **Évolution P, V, T** : rapports P/P₀, V/V₀ et T/T₀, sur une même échelle. P₀ = nRT₀/V₀ est la référence idéale initiale, indépendante de la pression mesurée. V est tracé en pointillés pour rester identifiable lorsque V/V₀ et T/T₀ se superposent.
- **PV/(nRT) au cours du temps** : pression réellement mesurée × volume / nRT, avec la référence idéale 1. Dans la comparaison, les deux gaz ont chacun leur courbe.

Les cartes au-dessus donnent les valeurs instantanées. La pression est calculée sur une fenêtre glissante de 0,23 ms. La première fenêtre est partielle ; pendant une transformation, la pression garde aussi la mémoire des instants précédents. Un écart à PV/(nRT) = 1 peut donc venir des fluctuations, du retard de mesure, de l’anisotropie ou, pour les disques durs, de leur taille finie.

Les autres diagrammes (P–V, P–T, V–T, PV = f(T), ln(P) = f(ln(V))), les histogrammes, le choix du capteur de pression, la température initiale et les explications sont regroupés dans **Approfondir**. Le graphique choisi y remplace le tracé principal, sans faire disparaître la cavité. Le saut de volume d’une détente libre n’est pas relié par un segment dans P–V : il ne définit pas un travail de pression.

La lecture peut être ralentie jusqu’à ×0,05, accélérée jusqu’à ×4, mise en pause ou avancée par pas de 0,02 u.t. Le ralentissement change le temps simulé écoulé par seconde réelle ; il ne modifie ni les collisions ni les paramètres physiques. Pour garder une interface réactive, le calcul peut ralentir sous charge, sans sauter de pas physique. Les deux gaz de comparaison restent synchronisés.

## Les collisions à la loupe

Dans les expériences de pression, de chaleur et de travail, le bouton d’illustration lance une **séquence automatique dans la cavité elle-même** :

1. Repérage d’une collision à venir, sans avancer le gaz affiché.
2. Ralentissement et rapprochement progressif de la caméra du point de contact ; la particule suivie est entourée.
3. Collision réelle et rebond continu, sans arrêt sur image. Une onde visuelle se propage dans le piston pendant que la particule repart.
4. Éloignement de la particule, recul de la caméra et reprise automatique à la vitesse de lecture choisie avant la séquence.

Le parcours thermique effectue ces étapes deux fois : **δQ > 0 puis δQ < 0**, avec deux particules qui peuvent être différentes. Cela n’impose aucun échange : une paroi chaude peut recevoir de l’énergie lors d’un choc individuel. Pour le travail, le bouton lance le trajet choisi s’il n’a pas encore commencé, ou suit le piston déjà en mouvement. Le signe reste celui du **travail reçu par le gaz** : positif en compression, négatif en détente.

Les flèches `p avant` et `p après` sont des quantités de mouvement dans le **référentiel du laboratoire**, avec une même masse représentative et une même échelle. Leurs longueurs peuvent donc différer au piston mobile. Une flèche supplémentaire représente l’impulsion reçue par la paroi, ou le sens du transfert d’énergie. L’onde illustre la transmission de la poussée ; elle ne simule pas l’élasticité du solide et n’ajoute aucune force ni énergie au modèle. Le piston et les autres particules continuent à être ceux de la simulation ; la caméra ne substitue pas un dessin indépendant au gaz.

Pour le travail, la caméra se rapproche d’une **position fixe dans le laboratoire** et ne suit jamais la largeur courante du gaz. Une ligne marque la position initiale du piston ; une graduation fixe, sa vitesse et son déplacement permettent de voir le mouvement dès l’approche. Le cadrage tient compte du trajet avant le contact pour garder le piston visible.

La trajectoire violette en pointillés représente un **rebond hypothétique sur un piston immobile**, au même point et avec la même vitesse incidente. À droite : v′x = 2u − vx pour le piston mobile, contre v′x = −vx pour le piston immobile, avec vy inchangée. Les deux vitesses sortantes sont affichées, et les flèches utilisent une échelle commune. Juste avant le dézoom, un arrêt sur image de 2,5 secondes met en évidence les deux vitesses sortantes dans la cavité et dans le panneau de mesures. Le rebond reste continu ; seule cette comparaison finale est figée, puis la reprise est automatique. Le cercle violet prolonge seulement le vol libre après ce rebond hypothétique : ce n’est pas une seconde simulation du gaz. Les chocs guidés sont sélectionnés avec vx incident positif, afin que la particule puisse aussi heurter un piston immobile. Un piston qui rattrape une particule s’éloignant de lui est signalé séparément dans les mesures ordinaires.

Le repérage emploie une copie indépendante du moteur, comprenant l’état du générateur aléatoire thermique, les positions, les vitesses, le mouvement du piston et les conditions aux limites. La copie cherche un événement suffisamment éloigné dans le futur pour laisser le temps de zoomer, hors des coins. Le moteur affiché emploie ensuite les mêmes pas physiques et confirme l’identifiant, la date et les échanges de la collision prévue. La recherche ne consomme aucun tirage du gaz affiché et ne modifie pas ses mesures. Le budget de calcul par image reste borné.

Les paramètres physiques sont verrouillés pendant le parcours. **Quitter le zoom**, Pause, un changement d’onglet ou une remise à zéro l’interrompent sans revenir en arrière dans le temps. La vitesse antérieure est conservée. Une préférence système de réduction des animations supprime la transition progressive de caméra. Si aucun choc adapté n’existe dans l’horizon de recherche (8 u.t., ou la fin du trajet pour le travail), l’interface le signale ; elle ne fabrique aucun choc. Le bouton thermique est désactivé pour une paroi isolée ou une accommodation nulle.

Dans la comparaison des modèles, **Isoler un choc mutuel** conserve le schéma figé précédent : la partie « disques » représente une collision réellement calculée, la partie « points » prolonge les mêmes vitesses entrantes sans interaction. Les deux vues d’ensemble et les deux courbes PV/(nRT) proviennent de deux simulations indépendantes.

## Pression, travail et chaleur

Le moteur conserve ses unités réduites (m = kB = 1). Les formules de calcul ci-dessous décrivent ces variables internes ; `dist/units.js` applique ensuite une conversion fixe à tous les affichages et exports. La pression physique utilise la surface S = H × profondeur et le volume équivalent est L × H × profondeur.

### Échelles physiques fixes

| Grandeur interne | Valeur physique d’une unité |
| --- | --- |
| Température | 200 K |
| Volume (aire interne) | 1/82,5 L |
| Pression | 5 500 Pa = 0,055 bar |
| Énergie, travail, chaleur | 1/15 J |
| Longueur et profondeur constante | ∛(0,001/82,5) m ≈ 2,297 cm |
| Vitesse | 200 m/s |
| Temps | longueur / vitesse ≈ 0,1149 ms |
| Impulsion | énergie / vitesse = 1/3000 N·s |

Ainsi, l’état de référence (largeur 11, hauteur 7,5, T = 1,5) a V = 1 L, T = 300 K, E = 100 J et P idéal = 1 bar. La quantité de gaz est n = (1/3)/R ≈ 0,04009 mol, avec R = 8,31446261815324 J·mol⁻¹·K⁻¹. Chaque marqueur représente n/1000 mol ; ses énergies et impulsions sont pondérées en conséquence. La masse effective d’un marqueur vaut (1/15)/200² kg. Le choix de vitesse fixe une masse molaire équivalente d’environ 41,6 g/mol, sans prétendre simuler une espèce chimique particulière.

Ces échelles ne dépendent jamais de la pression mesurée, du changement d’onglet ou d’une remise à zéro. Les autres volumes initiaux donnent donc d’autres pressions idéales. Le diagnostic affiché est PV/(nRT), de référence 1. En P–V, 1 bar·L = 100 J ; PV = f(T) affiche PV en J. Les logarithmes portent sur P/(1 bar) et V/(1 L), sans changer la pente ajustée. Les histogrammes affichent m/s et J par marqueur, avec densités normalisées.

La dynamique reste **2D** : E = nRT et γ = 2 pour l’idéal isotrope, et non les capacités thermiques d’un gaz 3D. La profondeur est une convention de conversion, sans troisième vitesse cachée. La lecture ×1 est volontairement ralentie : 1 s d’animation représente environ 0,1149 ms physiques (hors ralentissement sous charge). Le flux thermique affiché est converti en kW/m², les puissances exportées en W. Les diagnostics JavaScript `gaz2D.metrics` et les historiques restent internes en unités réduites ; les CSV utilisent les unités indiquées dans chaque en-tête et incluent n en mol.

Au piston, l’impulsion normale reçue par la paroi vaut J = m(vx avant − vx après). La pression affichée dans l’expérience 01 utilise :

```text
Ppiston = somme(J) / (H × durée de la fenêtre)
δW reçu par le gaz = −u J
```

La jauge utilise cette pression mesurée, avec une échelle visuelle de 0 à quatre fois la pression idéale initiale. La valeur numérique n’est pas plafonnée. À piston immobile, u = 0 : chaque choc peut transmettre une impulsion non nulle, mais son travail est nul. Le premier onglet garde le piston fixe et se concentre sur la pression. Le travail et les commandes du piston sont regroupés dans l’expérience adiabatique, où les énergies avant/après et δW sont affichés à côté du zoom.

Le travail cumulé est calculé aux impacts et non à partir d’une pression déduite de l’équation d’état. Son lien avec un diagramme est W reçu = −∫Ppiston dV. Une intégrale utilisant la pression glissante reste une estimation, et les aires de P–T ou de V–T ne sont pas des travaux.

Dans l’expérience 02, **seule la paroi gauche** est reliée au thermostat par défaut ; les autres parois sont isolées et le piston reste fixe. Une option avancée étend le contact thermique à toutes les parois. L’isolation, la température de paroi et la fraction de chocs thermalisés peuvent changer pendant la simulation, sans modifier immédiatement les vitesses ni effacer le cumul de chaleur.

Lors d’un choc thermique, le moteur tire la vitesse sortante dans le référentiel de la paroi : normale intérieure suivant la loi de flux `|cn| = √(−2 Tb ln U)` et tangente gaussienne de variance Tb. La chaleur reçue est la variation d’énergie dans ce référentiel. À paroi fixe :

```text
δQ = Ec après − Ec avant
flux thermique moyen 2D = somme(δQ) / (longueur × durée)
```

La flèche thermique traverse le point de contact dans le sens de l’énergie échangée. Un choc peut chauffer ou refroidir, même avec un thermostat plus chaud que le gaz : c’est le bilan moyen qui détermine l’évolution de la température. Le flux affiché est celui de la paroi gauche sur la fenêtre de mesure, alors que Q cumule tous les échanges depuis l’état initial. Le premier et le second choc du parcours sont sélectionnés par leur signe, sans modifier ces bilans. Le premier principe est toujours vérifié : **ΔE = W + Q**. Le modèle de réflexion est celui décrit dans la [documentation LAMMPS des parois stochastiques](https://docs.lammps.org/fix_wall_reflect_stochastic.html).

## Deux modèles et leurs limites

Le gaz ponctuel contient des particules sans interaction mutuelle. Les chocs isolés sur les parois sont élastiques ; au piston de vitesse u, vx après = 2u − vx avant. Un piston peut rendre les températures directionnelles différentes : Tx = moyenne(vx²), Ty = moyenne(vy²). Sans collisions mutuelles, leur différence ne se résorbe pas spontanément.

Les disques durs ont un rayon 0,04. Ils sont placés sans recouvrement et leur centre reste à cette distance des parois. Un choc entre deux disques conserve exactement, aux arrondis numériques près, l’énergie cinétique et la quantité de mouvement de la paire. L’énergie échangée entre particules n’est ni W ni Q, car elle reste interne au gaz.

Le moteur prédit les dates de contact, les traite dans une file de priorité et invalide les prédictions après les changements de vitesse. Une grille spatiale filtre les paires candidates initiales ; les paires impliquant des particules dont la vitesse a changé sont recalculées. Cette méthode suit le principe de la [simulation événementielle de disques durs de Princeton](https://algs4.cs.princeton.edu/61event/index.php). Aucun rééchelonnement global d’énergie ni déplacement correctif de recouvrement n’est appliqué.

La comparaison commence avec les mêmes vitesses initiales, N, V et T. Les positions diffèrent pour placer les disques sans recouvrement. Leur fraction de surface est Nπr²/V, affichée dans l’interface. Leur taille finie introduit un volume exclu : PV/(nRT) peut dépasser 1 même à l’équilibre. Les collisions élastiques seules ne définissent pas toutes les propriétés d’un gaz réel. Il n’y a pas d’attraction ni d’énergie potentielle à distance : une détente libre isolée conserve donc T dans les deux modèles.

Tcin = Ec/N est un indicateur d’énergie, incluant le mouvement collectif éventuel. Une loi adiabatique idéale PV^γ = constante suppose une évolution quasi statique et un gaz isotrope ; γ = 2 est la référence idéale 2D à deux degrés de liberté. L’ajustement logarithmique utilise le dernier trajet, au moins trois fenêtres de pression entièrement incluses dans ce trajet et non recouvrantes. Il produit un exposant apparent, sans prouver ces hypothèses. La détente libre est exclue de cet ajustement. Voir [OpenStax : processus adiabatiques](https://openstax.org/books/university-physics-volume-2/pages/3-6-adiabatic-processes-for-an-ideal-gas).

**Contacts thermiques multiples.** Sous compression rapide, des disques peuvent toucher simultanément une paroi et d’autres disques. Pour éviter une répétition sans vol libre des tirages thermiques, une seule réémission par particule est autorisée au même instant numérique (tolérance 10⁻¹⁰ u.t.) ; les réflexions supplémentaires sont élastiques. Cette convention conserve ΔE = W + Q, mais limite l’interprétation des contacts multiples. Leur compteur est affiché dans les explications et exporté.

## Export et conservation des données

L’export CSV regroupe les relevés de l’expérience courante : pressions mesurées, température, volume, PV/(nRT), travail, chaleur, bilan, modèle, collisions et conditions thermiques. La comparaison produit une ligne par gaz et par instant, permettant de vérifier les deux bilans séparément. Les valeurs sont séparées par des points-virgules, avec une virgule décimale.

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

Les tests vérifient les conservations, le confinement, les collisions, les thermostats sélectifs, les observations avant/après, la fidélité des prévisions, les parcours de caméra, la reprise automatique, les interruptions, les diagrammes et les commandes. Les scénarios d’interface exécutent le vrai moteur et le code applicatif avec un DOM et un Canvas simulés ; l’apparence est également contrôlée dans un navigateur. Le module d’analyse des cycles de la version précédente est conservé dans les sources, mais n’est plus chargé par l’interface.

GitHub Pages publie automatiquement la branche `main`, depuis la racine du dépôt. `index.html` redirige vers `dist/` et `.nojekyll` demande un service statique sans transformation. Le dépôt est public : pousser les changements sur `main` met à jour le démonstrateur.
