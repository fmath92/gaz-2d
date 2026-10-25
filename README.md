# Gaz 2D — Visite guidée du laboratoire

**[Ouvrir le démonstrateur](https://fmath92.github.io/gaz-2d/)** · [Code source](https://github.com/fmath92/gaz-2d)

Un laboratoire de thermodynamique pour relier les collisions microscopiques à la pression, au travail et à la chaleur. La version 0.20.10 réunit la simulation et les courbes sur le même écran de travail et organise la navigation par expériences.

## La visite

| Étape | Expérience | À observer |
| --- | --- | --- |
| 01 | Pression | Un choc à venir, sa poussée sur le piston immobile et sa contribution à la pression. |
| 02 | Température | Instant figé, zoom local, vitesses alignées, énergies puis moyenne globale. |
| 03 | Joule–Gay–Lussac | Ouverture vers le vide (doublement du volume par défaut), énergie et température conservées en mode isolé. |
| 04 | Détente et compression adiabatiques | Parcours compression → détente → repos → manipulation libre ; chocs, travail reçu et aire signée P–V. Transformations manuelles également disponibles. |
| 05 | Cycles P–V | Allers-retours isolés du piston, branches compression/détente et échauffement éventuel. |
| 06 | Rayon & loi des gaz | Une simulation de disques durs à rayon réglable ; relevés de PV/(nRT) à n, V et T initiale identiques. |

Toutes les expériences utilisent **1 000 disques durs** avec collisions élastiques mutuelles. Le rayon commun vaut initialement 0,50 mm équivalent (≈ 0,0218 unité interne). Son curseur agit immédiatement, sans bouton de validation. Chaque changement dans le dernier onglet s’applique aux six expériences et les réinitialise ; les relevés conservés gardent leur rayon d’origine. Le dernier onglet propose de 0,005 à 0,07 unité (≈ 0,11 à 1,61 mm). Le rayon dessiné est le rayon de collision. Le modèle ponctuel reste disponible dans la bibliothèque et ses tests, mais n’est plus proposé dans l’interface.

Chaque onglet garde son état, ses réglages, sa pause et ses mesures jusqu’au rechargement de la page. Seule l’expérience affichée évolue. « Recommencer » efface les données de l’expérience courante. L’onglet Cycles P–V propose 1, 3 ou 5 allers-retours progressifs, entre le volume de départ et 70 % de ce volume.

## Tutoriel interactif facultatif

À chaque chargement, une invitation propose **Commencer la visite guidée** ou **Explorer librement**. Le film est suspendu tant que cette invitation est ouverte, sans modifier le réglage de lecture. Le bouton **Visite guidée**, dans l’en-tête, permet de la relancer.

Le parcours comporte 36 étapes, avec une zone mise en lumière et des transitions animées. Il utilise les véritables contrôles du simulateur : regarder les séquences de pression et de température, réaliser deux détentes de Joule–Gay–Lussac, répondre aux comparaisons de vitesse, déplacer le piston, lancer des cycles, choisir cinq rayons distincts, enregistrer un relevé par rayon, comparer PV/(nRT) au rayon, lire les distributions et découvrir les exports. Les actions et les résultats réellement obtenus sont signalés, sans verrouiller la progression : **Continuer reste disponible dans les panneaux explicatifs**, même pour avancer sans faire une manipulation. Une fois une étape réalisée, elle reste validée.

Les simples consignes de navigation, de lancement et de retour deviennent des boutons surlignés sans popup ; l’action fait avancer automatiquement la visite. Le bouton d’en-tête « Quitter la visite » et Échap restent disponibles. L’animation de pression affiche le commentaire du guide seulement au bilan. Pour la température, toutes les explications restent dans l’encadré de calcul à droite de la simulation ; aucun popup ne s’ajoute, même au bilan.

Le voile gris disparaît pendant les manipulations et les animations à observer ; le cadre coloré continue d’indiquer la zone utile. Le voile revient lorsque l’étape est réalisée, après le relâchement de la souris, du doigt ou de la touche si l’on règle un curseur. Les chapitres sont accessibles directement, et **Quitter** ou Échap ferme le tutoriel. Les expériences et les réglages restent conservés. Les réinitialisations et les exports ne se font que lorsque l’utilisateur clique sur les commandes correspondantes. La navigation au clavier est disponible ; l’invitation retient le focus, et la préférence de réduction des animations supprime les transitions décoratives. Le tutoriel ne modifie pas les trajectoires physiques.

## Observer et mesurer

La cavité et les tracés restent côte à côte sur ordinateur. Sur écran étroit, les panneaux s’empilent. Le commutateur principal passe entre :

- **Évolution P, V, T** : rapports P/P₀, V/V₀ et T/T₀, sur une même échelle. P₀ = nRT₀/V₀ est la référence idéale initiale, indépendante de la pression mesurée. V est tracé en pointillés pour rester identifiable lorsque V/V₀ et T/T₀ se superposent.
- **PV/(nRT) au cours du temps** : pression réellement mesurée × volume / nRT, avec la référence idéale 1. Dans le dernier onglet, on compare les mesures à la référence idéale 1.

Dans Joule–Gay–Lussac, les graduations horizontales comprennent toujours **0,5, 1 et 2**, avec un pas de 0,5 ; l’axe est agrandi si les mesures dépassent le cadre usuel. Après au moins huit unités internes de temps depuis l’ouverture (≈ 0,92 ms), une invitation propose de **recommencer avec PV/(nRT)**. Ce délai laisse observer le transitoire, sans certifier l’équilibre. Le bouton prépare un nouveau gaz au même rayon et à la même température initiale, sélectionne le diagramme du rapport et laisse l’utilisateur déclencher l’ouverture.

Les cartes au-dessus donnent les valeurs instantanées. La pression est calculée sur une fenêtre glissante de 0,23 ms. La première fenêtre est partielle ; pendant une transformation, la pression garde aussi la mémoire des instants précédents. Un écart à PV/(nRT) = 1 peut donc venir des fluctuations, du retard de mesure, de l’anisotropie ou, pour les disques durs, de leur taille finie.

Les autres diagrammes (P–V, P–T, V–T, PV = f(T), ln(P) = f(ln(V))), les histogrammes, le choix du capteur de pression, la température initiale et les explications sont regroupés dans **Approfondir**. Le graphique choisi y remplace le tracé principal, sans faire disparaître la cavité. Le saut de volume d’une détente libre n’est pas relié par un segment dans P–V : il ne définit pas un travail de pression.

La lecture peut être ralentie jusqu’à ×0,05, accélérée jusqu’à ×4, mise en pause ou avancée par pas de 0,02 u.t. Le ralentissement change le temps simulé écoulé par seconde réelle ; il ne modifie ni les collisions ni les paramètres physiques. Pour garder une interface réactive, le calcul peut ralentir sous charge, sans sauter de pas physique. Les collisions mutuelles redistribuent les vitesses dans toutes les expériences.

## Les collisions à la loupe

Dans les expériences de pression et de travail, le bouton d’illustration lance une **séquence automatique dans la cavité elle-même** :

1. Repérage d’une collision à venir, sans avancer le gaz affiché.
2. Ralentissement et rapprochement progressif de la caméra du point de contact ; la particule suivie est entourée.
3. Collision réelle et rebond continu, sans arrêt sur image. Une onde visuelle se propage dans le piston pendant que la particule repart.
4. Éloignement de la particule, recul de la caméra, puis mesure collective des chocs. Le retour final reste déclenché par le bouton Retour à la simulation.

Le parcours de travail montre successivement la compression, la détente et le repos, puis laisse manipuler le piston dans les deux sens. Il utilise des déplacements pédagogiques modérés ; les transformations manuelles conservent leurs propres réglages. Le signe reste celui du **travail reçu par le gaz** : nul au repos, positif en compression, négatif en détente.

L’impulsion J est affichée en **kg·m/s**, unité équivalente à N·s : p = mv, J reçu par le piston = m(v avant − v après), composante normale à la paroi. La flèche orange emploie exactement la même échelle que les deux flèches de quantité de mouvement ; pour un choc frontal sur une paroi fixe, elle vaut deux fois la flèche entrante. La masse est celle du marqueur représentatif.

Les flèches `p avant` et `p après` sont des quantités de mouvement dans le **référentiel du laboratoire**, avec une même masse représentative et une même échelle. Leurs longueurs peuvent donc différer au piston mobile. Une flèche supplémentaire représente l’impulsion reçue par la paroi, ou le sens du transfert d’énergie. L’onde illustre la transmission de la poussée ; elle ne simule pas l’élasticité du solide et n’ajoute aucune force ni énergie au modèle. Le piston et les autres particules continuent à être ceux de la simulation ; la caméra ne substitue pas un dessin indépendant au gaz.

Pour le travail, la caméra se rapproche d’une **position fixe dans le laboratoire** et ne suit jamais la largeur courante du gaz. Une ligne marque la position initiale du piston ; une graduation fixe, sa vitesse et son déplacement permettent de voir le mouvement dès l’approche. Le cadrage tient compte du trajet avant le contact pour garder le piston visible.

Dans le parcours guidé de travail, le bandeau compare les **normes de la vitesse sortante et de la vitesse entrante**, en m/s. L’étudiant choisit <, = ou > dans cet ordre. La comparaison reste figée jusqu’à une bonne réponse puis au clic sur Continuer, dans le même bandeau. Le commentaire relie la poussée à la pression et la variation de vitesse à l’énergie cinétique : égalité au repos, vitesse sortante plus grande en compression, plus petite en détente. Une réponse erronée apparaît en rouge et donne un indice sans révéler le signe correct. Continuer reste désactivé jusqu’à la bonne réponse. Les trajectoires et vitesses physiques ne sont jamais modifiées par ces réponses. Le rebond hypothétique sur un piston fixe n’apparaît plus dans ce parcours.

Le repérage emploie une copie indépendante du moteur, comprenant l’état du générateur aléatoire thermique, les positions, les vitesses, le mouvement du piston et les conditions aux limites. La copie cherche un événement suffisamment éloigné dans le futur pour laisser le temps de zoomer, hors des coins. Le moteur affiché emploie ensuite les mêmes pas physiques et confirme l’identifiant, la date et les échanges de la collision prévue. La recherche ne consomme aucun tirage du gaz affiché et ne modifie pas ses mesures. Le budget de calcul par image reste borné.

Les paramètres physiques sont verrouillés pendant le parcours. **Retour à la simulation** quitte l’illustration progressivement ; Pause la suspend, un changement d’onglet suspend le gaz affiché, et Recommencer réinitialise l’expérience. La vitesse de lecture choisie est conservée. Une préférence système de réduction des animations supprime les transitions de caméra du choc individuel. Si aucun choc adapté n’existe dans l’horizon de recherche (8 unités internes, ou la fin du trajet pour le travail), l’interface le signale ; elle ne fabrique aucun choc.

Dans le dernier onglet, **Isoler un choc mutuel** présente uniquement le vrai choc entre deux disques, avec les flèches avant/après. Le réglage de rayon est une préparation d’expérience : « Appliquer le rayon et recommencer » reconstruit les positions sans recouvrement et réinitialise les mesures à n, V et T initiale identiques. Il ne gonfle pas des particules en pleine simulation et n’invente pas un travail associé. Les relevés (jusqu’à 10 000, sans éviction des anciens) survivent à cette réinitialisation et sont effaçables. Un relevé devient possible après quatre unités internes (≈ 0,46 ms) ; cette durée ne garantit pas à elle seule l’équilibre, les fluctuations restent visibles. Les relevés donnent le rayon, PV/(nRT), T, t et le capteur utilisé. L’export CSV porte sur l’historique du rayon courant.

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

L’onglet d’échanges thermiques a été retiré de la visite. Le moteur thermique reste disponible dans la bibliothèque et couvert par ses tests ; les six expériences proposées utilisent des parois isolées.

Lors d’un choc thermique, le moteur tire la vitesse sortante dans le référentiel de la paroi : normale intérieure suivant la loi de flux `|cn| = √(−2 Tb ln U)` et tangente gaussienne de variance Tb. La chaleur reçue est la variation d’énergie dans ce référentiel. À paroi fixe :

```text
δQ = Ec après − Ec avant
flux thermique moyen 2D = somme(δQ) / (longueur × durée)
```

La flèche thermique traverse le point de contact dans le sens de l’énergie échangée. Un choc peut chauffer ou refroidir, même avec un thermostat plus chaud que le gaz : c’est le bilan moyen qui détermine l’évolution de la température. Le flux affiché est celui de la paroi gauche sur la fenêtre de mesure, alors que Q cumule tous les échanges depuis l’état initial. Le premier et le second choc du parcours sont sélectionnés par leur signe, sans modifier ces bilans. Le premier principe est toujours vérifié : **ΔE = W + Q**. Le modèle de réflexion est celui décrit dans la [documentation LAMMPS des parois stochastiques](https://docs.lammps.org/fix_wall_reflect_stochastic.html).

## Disques durs et limites

Le modèle utilisé dans l’interface contient des disques durs en interaction élastique. Les chocs isolés sur les parois sont élastiques ; au piston de vitesse u, vx après = 2u − vx avant. Un piston peut rendre les températures directionnelles différentes : Tx = moyenne(vx²), Ty = moyenne(vy²). Les collisions mutuelles permettent leur rééquilibrage ; une compression rapide peut néanmoins créer une anisotropie transitoire.

Les disques durs ont un rayon équivalent de 0,50 mm par défaut, réglable dans la sixième expérience. Ils sont placés sans recouvrement et leur centre reste à cette distance des parois. Un choc entre deux disques conserve exactement, aux arrondis numériques près, l’énergie cinétique et la quantité de mouvement de la paire. L’énergie échangée entre particules n’est ni W ni Q, car elle reste interne au gaz.

Le moteur prédit les dates de contact, les traite dans une file de priorité et invalide les prédictions après les changements de vitesse. Une grille spatiale filtre les paires candidates initiales ; les paires impliquant des particules dont la vitesse a changé sont recalculées. Cette méthode suit le principe de la [simulation événementielle de disques durs de Princeton](https://algs4.cs.princeton.edu/61event/index.php). Aucun rééchelonnement global d’énergie ni déplacement correctif de recouvrement n’est appliqué.

La fraction de surface est Nπr²/V (variables internes 2D). La taille finie introduit un volume exclu : PV/(nRT) peut dépasser 1 même à l’équilibre. Réduire le rayon permet d’explorer la limite diluée ; à très petit rayon, les collisions mutuelles sont moins fréquentes. Le volume affiché est toujours celui de la cavité entière. Il n’y a pas d’attraction ni d’énergie potentielle à distance : une détente libre isolée conserve T.

Tcin = Ec/N est un indicateur d’énergie, incluant le mouvement collectif éventuel. Une loi adiabatique idéale PV^γ = constante suppose une évolution quasi statique et un gaz isotrope ; γ = 2 est la référence idéale 2D à deux degrés de liberté. L’ajustement logarithmique utilise le dernier trajet, au moins trois fenêtres de pression entièrement incluses dans ce trajet et non recouvrantes. Il produit un exposant apparent, sans prouver ces hypothèses. La détente libre est exclue de cet ajustement. Voir [OpenStax : processus adiabatiques](https://openstax.org/books/university-physics-volume-2/pages/3-6-adiabatic-processes-for-an-ideal-gas).

**Contacts thermiques multiples.** Sous compression rapide, des disques peuvent toucher simultanément une paroi et d’autres disques. Pour éviter une répétition sans vol libre des tirages thermiques, une seule réémission par particule est autorisée au même instant numérique (tolérance 10⁻¹⁰ u.t.) ; les réflexions supplémentaires sont élastiques. Cette convention conserve ΔE = W + Q, mais limite l’interprétation des contacts multiples. Leur compteur est affiché dans les explications et exporté.

## Export et conservation des données

L’export CSV regroupe les relevés de l’expérience courante : pressions mesurées, température, volume, PV/(nRT), travail, chaleur, bilan, modèle, collisions et conditions thermiques. Chaque ligne indique également le rayon en mm. Les valeurs sont séparées par des points-virgules, avec une virgule décimale.

Chaque expérience conserve au plus 6 000 relevés, environ un tous les 0,1 u.t., plus les commandes et arrêts sur événement. Les deux histogrammes utilisent des densités normalisées et les mêmes classes pour les états comparés. Les barres représentent l’état actuel et les pointillés l’état initial. Les mesures ne sont pas sauvegardées après fermeture de la page.

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


## Graphique des relevés (0.10.0)

Dans « Rayon & loi des gaz », le panneau **Comparer les relevés** trace une grandeur sauvegardée en fonction d’une autre. Les deux axes proposent PV/(nRT), rayon (mm), libre parcours moyen (mm), surface occupée (%), pression (bar), température (K), temps moyen entre collisions mutuelles (µs) et nombre de trajets complets. Les points ne sont pas reliés ; une ligne de référence à 1 accompagne un axe PV/(nRT). Le tableau et l’export dédié `gaz-2d-releves.csv` conservent les conditions de chaque mesure, même après changement de rayon. L’export habituel reste celui de l’historique courant.

Le moteur intègre la distance réellement parcourue par chaque disque. Une collision mutuelle clôt le trajet de chacun des deux participants. Les rebonds aux parois n’interrompent pas ce comptage ; les trajets initiaux partiels et les trajets en cours ne sont pas inclus. Pour les relevés, la moyenne utilise les trajets dont la collision finale appartient à la fenêtre glissante, en excluant ceux commencés pendant le démarrage. Un trajet peut commencer avant la fenêtre, mais il n’est attribué qu’à sa collision finale : deux fenêtres disjointes ne réutilisent pas le même trajet. Le calcul ne déduit rien de la loi des gaz parfaits. Le temps moyen est calculé sur les mêmes trajets. Les statistiques de la prévision des zooms sont indépendantes de celles du gaz affiché.

Pression et statistiques de trajets emploient la même fenêtre de 2 unités internes (≈ 0,230 ms). La première fenêtre sert au démarrage et est écartée ; le premier relevé est donc autorisé à partir de 4 unités internes (≈ 0,459 ms). Les suivants doivent attendre au moins 2 unités simulées après le précédent. Une pause ne consomme pas ce délai, et effacer la liste, changer les axes ou le capteur ne le supprime pas. Appliquer un nouveau rayon ou recommencer recrée le gaz et impose à nouveau démarrage + fenêtre. Le bouton et le gestionnaire du clic vérifient cette condition. Les fenêtres sont ouvertes à gauche, fermées à droite : un événement sur la borne n’est pas compté deux fois. T et V sont constants dans cette expérience isolée à piston fixe : la valeur instantanée coïncide avec sa moyenne, aux arrondis près. Les moyennes cumulées du moteur restent disponibles dans les diagnostics techniques, mais ne servent plus aux relevés. Des fenêtres sans chevauchement ne garantissent pas une indépendance statistique complète. Une observation courte sous-échantillonne les longs trajets ; le nombre de trajets et l’instant du relevé permettent de juger la durée d’observation, sans garantir l’équilibre. En 2D, l’occupation est Nπr²/(LH), égale à la fraction du volume équivalent pour des disques extrudés sur la profondeur conventionnelle. Aucun volume de sphères 3D n’est utilisé.


Le ratio corrigé **P(V − αV occupé)/(nRT)** est affiché dans le dernier onglet et disponible sur les deux axes, dans le tableau et dans l’export des relevés. Il vaut Z(1−αφ), où Z = PV/(nRT), φ = Nπr²/(LH) et V occupé = φV. Cette soustraction géométrique est une hypothèse à explorer, pas une équation d’état imposée : le volume inaccessible aux centres des autres particules diffère du volume matériel occupé. Les deux ratios se comparent à la référence 1. Chaque relevé exporte les bornes temporelles exactes de sa fenêtre.


### α, collecte et régression (0.10.0)

α est un paramètre d’analyse compris entre 0 et 5, modifiable par curseur ou saisie numérique. Tous les ratios corrigés sont recalculés depuis Z et φ sauvegardés, sans modifier la dynamique. « Ajuster α » minimise Σ[Zᵢ(1−αφᵢ)−1]² avec poids égaux par relevé ; le minimum non contraint est Σ[Zᵢφᵢ(Zᵢ−1)]/Σ(Zᵢφᵢ)², puis borné à [0,5]. Le RMS à 1 est affiché ; répéter plus souvent un rayon augmente son poids. Le CSV indique l’α utilisé pour l’analyse exportée.

La référence diluée 2D α ≈ 2 et son lien avec le second coefficient du viriel sont expliqués dans l’interface, avec cette [référence sur le gaz de disques](https://landau.unex.es/~sphinx/santos/PUBLICATIONS/a98HaroSanYusEJPv19p281_n33.pdf). L’ajustement à densité finie ne constitue pas une validation de cette limite théorique.

La collecte automatique est facultative. Elle suit l’expérience visible, respecte le démarrage et le délai entre fenêtres, s’arrête en pause et reprend avec les mêmes conditions après un changement de rayon. À 10 000 relevés elle s’arrête sans supprimer les anciens. La liste abrégée affiche les 10 derniers ; le tableau est paginé par 100. Les graphiques, régressions, ajustements d’α et exports utilisent tous les relevés valides conservés. Les données restent en mémoire jusqu’au rechargement : exporter avant de quitter.

La régression OLS affiche y = ax + b, R², n et les incertitudes-types u(a), u(b), calculées à partir de la variance résiduelle SSE/(n−2). Il faut 3 points et des X distincts ; R² reste indéfini pour Y constant. Les ± sont à 1 σ, pas à 95 %. Les [hypothèses OLS](https://itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm) et les limites liées aux corrélations, aux erreurs sur X et à l’ajustement préalable d’α sont explicitées dans l’interface. Les unités sont celles des axes : Y/X pour a et Y pour b.

### Grandeurs supplémentaires (0.10.1)

Les axes proposent P(V − αV occupé)/T en J/K, avec une référence à nR, ainsi que 1/λ en mm⁻¹ et 1/τ en µs⁻¹ (inverses des moyennes mesurées sur la fenêtre, non moyennes des inverses). Les valeurs indisponibles ou nulles sont omises pour les inverses. Ces trois colonnes sont aussi exportées en CSV.

À n constant, multiplier le ratio corrigé par nR ne change pas R². Pour tester une constante, regarder la compatibilité de la pente avec zéro et l’écart au niveau attendu ; un faible R² ne signifie pas que la correction échoue. Cette explication accompagne le tracé corrigé.

### Volume exclu et température (0.11.0)

Le bouton « Tracer P(V − b) en fonction de T » choisit T en K en abscisse et P(V − b) en J en ordonnée, avec b = αV occupé. La droite verte de référence a une pente nR = 1/3 J/K et passe par l’origine. La régression orange reste libre, avec pente a et ordonnée c (pour ne pas confondre l’interception avec le volume b). Le CSV exporte aussi P(V − b).

Un réglage de température près du graphique permet de préparer plusieurs états à rayon et volume fixes, sans effacer les relevés. Il faut attendre le démarrage et la fenêtre de mesure après chaque réinitialisation. Des rayons mélangés déclenchent une indication : b varie alors entre les relevés. Ici b est le volume total exclu, soit n fois le covolume molaire usuel. Une bonne linéarité seule ne valide pas b : comparer la pente à nR et explorer plusieurs densités.

Des boutons invitent à revenir à la pression, à Joule–Gay–Lussac et aux adiabatiques avec le rayon commun choisi, pour réexaminer les résultats du gaz dilué.

## Parcours guidé et séries automatiques (0.12.0)

L’onglet Rayon affiche la simulation et un seul graphique côte à côte. Deux choix remplacent les axes libres : effet du rayon sur PV/(nRT), puis P(V − b) en fonction de T. Les autres grandeurs restent dans le CSV, sans commandes supplémentaires. Les incertitudes et explications techniques se déplient à la demande. Le second graphique et l’ajustement d’α utilisent uniquement les relevés au rayon courant ; les autres relevés sont conservés et exportés.

« Relever les 5 températures » prépare successivement 200, 300, 400, 500 et 600 K au rayon et volume fixes. Pour chaque état, la préparation réinitialise les positions et vitesses (ce n’est pas un chauffage par thermostat). La stabilisation dure au moins max(6, 3L/√T) unités internes, puis compare deux fenêtres de pression non recouvrantes à 10 % près et exige |Tx−Ty|/T < 10 %. Une fenêtre complète supplémentaire est réservée à la mesure. La série s’arrête sans relever l’état si la stabilisation dépasse max(100, 5 fois le délai initial). Ce critère est pratique et ne démontre pas l’équilibre ni l’indépendance statistique.

La série se met en pause avec la simulation ou lors d’un changement d’onglet. On peut l’arrêter ou réinitialiser ; les points déjà relevés sont conservés. Le rayon, les températures manuelles et l’effacement des données sont verrouillés pendant la série. La lecture automatique utilise ×4 et s’arrête après les cinq points.

Les cycles utilisent des trajets sinusoïdaux progressifs entre V0 et 0,7 V0. Le curseur de durée règle chaque demi-cycle. La pression représentée est celle du piston ; orange = compression, bleu = détente. Pause, arrêt et réinitialisation sont disponibles. Les parois restent isolées : des allers-retours mécaniques ne sont pas forcément des cycles fermés en température et pression, et le gaz peut s’échauffer. Aucun segment artificiel ne ferme les branches du diagramme.

## Illustrer les mesures (0.13.0)

Le premier onglet enchaîne l’illustration d’un choc puis l’addition des poussées. La simulation avance au ralenti pendant une fenêtre de 2 unités internes (≈ 0,230 ms). Seuls les impacts sur la moitié centrale du piston sont retenus, sur (t0, t0 + Δt]. Chaque impact est identifié, y compris lorsque plusieurs chocs surviennent dans le même pas ou au même instant. La position de contact et l’identifiant sont ajoutés au journal physique sans changer les collisions. Le diagramme présente les impulsions individuelles et leur somme cumulée ; P = ΣJ/(SΔt), avec la surface équivalente de cette bande, et F moyenne = ΣJ/Δt. La jauge locale peut différer de celle du piston entier. À la fin, la scène est arrêtée pour permettre sa lecture. Le bouton de lancement devient « Retour à la simulation » : il déclenche le dézoom puis la reprise progressive du temps.

L’onglet Température ralentit le gaz en vue générale pendant 1,6 s, puis capture un instant immuable. Un rectangle est tracé pendant 1 s autour d’une zone centrale, qui est ensuite agrandie ; toutes ses particules sont montrées (au moins 12, sans sélection par vitesse). Les flèches sont translatées et orientées à l’écran à longueur conservée, puis transformées en barres proportionnelles à Ec = m|v|²/2. Les énergies locales s’ajoutent successivement. La dernière étape reste zoomée et présente E et E/N calculés sur les 1 000 particules, puis T = E/(nR), convention du modèle 2D. L’estimation locale est explicitement distinguée de la température globale. Les masses et énergies affichées sont celles des marqueurs représentatifs.

Après le ralentissement et le tracé du cadre, l’animation dure 18 secondes sans faire évoluer le temps physique, puis attend le retour demandé par l’utilisateur. Pause et Étape suivante permettent de l’examiner ; chaque passage manuel suspend l’animation. La préférence « réduire les animations » la démarre en pause. Le retour replace d’abord les flèches sur les particules (1,1 s), recule jusqu’au piston entier (1,4 s), puis accélère progressivement la lecture jusqu’à la vitesse choisie (1,6 s). Le même bouton permet aussi un retour avant la fin du récit. Changer d’onglet suspend la séquence ; Recommencer réinitialise l’expérience. Les tests vérifient la somme de tous les impacts, les limites de fenêtre, l’invariance des particules pendant le récit et l’accord de la température globale avec celle du moteur.

## Parcours unique de pression (0.14.0)

« Comprendre la pression » enchaîne l’illustration individuelle existante, son dézoom complet, une vue d’ensemble de 0,8 s, puis un zoom de 1,4 s vers la moitié centrale du piston. Les particules continuent à évoluer pendant ces déplacements de caméra. Une fois le second zoom terminé, la fenêtre de cumul des impulsions commence ; les chocs survenus pendant la transition n’entrent pas dans cette mesure.

Le second plan utilise désormais exactement le rendu de la cavité principale : mêmes particules, rayons, palette de vitesses, parois et repères. Aucune trajectoire n’est générée pour l’illustration. La caméra interpole depuis les coordonnées de la vue d’ensemble ; chaque flèche de poussée correspond à un événement du journal physique. Le test de continuité compare le gaz animé à un témoin avancé avec les mêmes pas, sans réinitialisation entre les séquences.

Le deuxième bouton de lancement a été retiré. À la fin, le résultat reste lisible en pause ; Le bouton de lancement est remplacé par « Retour à la simulation », disponible dès le premier zoom. Il annule la suite éventuelle, dézoome progressivement puis relance le temps. Aucun retour automatique ne ferme la mesure finale.


## Le travail : du choc au trajet du piston (0.18.0)

« Comprendre le travail : les trois cas » enchaîne **compression → détente → repos**, sur le même gaz. Pour chaque cas, un choc réel est suivi dans le référentiel du laboratoire. Le bandeau de comparaison fige les vitesses sortante et entrante : il faut choisir `<`, `=` ou `>` dans cet ordre. Un choix incorrect devient rouge et donne un indice pour réessayer. Seule une bonne réponse active **Continuer**, sur le même bandeau. Le commentaire explique l’énergie gagnée ou cédée et le rôle de la poussée. En détente, il précise que la particule cède de l’énergie **parce que le piston reculait pendant le choc**, et non du seul fait qu’elle le pousse. Aucune réponse ne modifie les trajectoires physiques.

Après le choc individuel, la caméra dézoome, puis cadre plus étroitement une bande orange du piston. Les repères A et B restent fixes dans le laboratoire. Pour la compression et la détente, l’étudiant **glisse la poignée orange de A vers B** : le mouvement inverse est bloqué. Le déplacement atteint trois unités internes (environ 0,27 L), sauf limite de la cavité. Le piston se relaxe vers la position demandée avec un léger retard (temps de relaxation interne 0,18), en conservant sa vitesse maximale de 0,55. Il ralentit quand il se rapproche de la souris, ce qui évite les arrêts entre deux événements de pointeur. Les reprises dans un même sens conservent une seule branche continue. Les particules ne sont jamais déplacées instantanément. On peut aussi utiliser les flèches gauche/droite, Début et Fin au clavier. La pression est mesurée à partir de tous les chocs sur le piston, y compris ceux qui sont hors du cadrage.

Le diagramme trace progressivement **une courbe continue P(V)** : les pressions sont moyennées sur des intervalles de 0,25 unité de temps, avec une pondération par le déplacement pour tenir compte de la vitesse variable du piston et lissées sur les intervalles voisins, puis reliées à leur volume médian. Aux arrêts et changements de sens, le dernier intervalle est fermé. À l’arrivée en B, l’aire sous la courbe se colore progressivement. Son intégrale numérique signée est affichée séparément du travail exact des chocs et de la variation d’énergie cinétique du gaz. L’aire est une **approximation**, sensible aux fluctuations et au lissage ; elle n’est pas recalibrée sur le travail. Le bilan exact reste ΔEc = ΣδW, puisque Q = 0. La convention est le travail **reçu par le gaz** : positif en compression, négatif en détente ; δW = −uJ lors d’un choc.

Chaque résultat attend **Cas suivant** sur l’animation. Le repos arrive en troisième : les chocs persistent, mais A et B sont confondus, la largeur du trajet sur P–V est nulle et W = 0. Le diagramme conserve les bornes du trajet de détente précédent et le rappelle en pointillés.

Après les trois cas, **À vous de jouer librement** permet de déplacer le piston dans les deux sens. Les branches du diagramme restent dans l’ordre du parcours, avec leur sens et leurs aires signées ; elles ne sont pas triées par volume. **Nouveau tracé** remet à zéro uniquement la mesure du parcours, sans réinitialiser le gaz. Une préparation réelle est annoncée si la largeur initiale est inférieure à 7, pour laisser de la place à la compression. Retour à la simulation reste disponible à tout moment et arrête le piston avant le dézoom et la reprise progressive. Les réglages de transformation manuelle sont retrouvés ensuite.
