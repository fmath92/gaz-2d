## 0.20.4 — Montrer les commandes sans multiplier les popups

- Navigation, lancement et retour guidés par surlignage ; progression automatique après l’action, sans confirmation supplémentaire.
- Les animations de pression et de température restent dégagées jusqu’au bilan.
- Aucune animation en cours n’est grisée, même si l’on avance dans le tutoriel.
- Sortie du guide toujours accessible dans l’en-tête ou avec Échap.

## 0.20.3 — Une visite plus directe

- Suppression des étapes de lecture ralentie, pause/reprise et préparation de la première détente : 34 étapes.
- « Refaire avec un autre regard » rejoint le bandeau inférieur.
- Le défilement privilégie le haut de page et descend seulement si la cible ne serait pas visible, sans la coller au bord supérieur.

## 0.20.2 — Observer la détente sans obstacle

- Le guide des deux détentes de Joule–Gay–Lussac et de leur bilan se place en bandeau compact en bas de l’écran, en laissant la cavité dégagée.

## 0.20.1 — Une visite sans blocage

- « Continuer » reste disponible à chaque étape, sans attendre obligatoirement une manipulation ou la fin d’une animation ; il remplace aussi « Passer cette étape ».
- Le voile gris disparaît pendant l’action et l’observation, puis revient après validation de l’étape et relâchement du curseur.
- Les textes du tutoriel sont mis à jour seulement lorsqu’ils changent, pour conserver des commandes stables pendant les rafraîchissements.
- Vérifications de la navigation sur les 38 étapes, des gestes à la souris et au clavier et de la stabilité du bouton.

## 0.20.0 — Une visite guidée du laboratoire

- Invitation facultative à l’arrivée ; parcours interactif de 38 étapes sur les vraies commandes, avec mise en lumière, progression, chapitres, étapes passables et sortie à tout moment.
- Les étapes attendent les actions et les résultats des simulations ; aucune mesure ni trajectoire n’est inventée par le tutoriel.
- Joule–Gay–Lussac : graduations et grille à 0,5, 1 et 2 ; invitation à recommencer avec PV/(nRT) après observation du transitoire.
- Explication du travail en détente : l’énergie est cédée parce que le piston recule pendant le choc.
- Tests des graduations, de la fenêtre d’accueil, des actions attendues, des changements de chapitre et de la nouvelle détente avec le rapport.

## 0.19.0 — Comparer et déplacer sans à-coups

- Comparaison dans l’ordre vitesse sortante / vitesse entrante : > en compression, = au repos, < en détente.
- Conclusion du quiz mise en évidence en gras dans un encadré : travail reçu positif, nul ou négatif.
- Relaxation du piston vers la souris, vitesse maximale inchangée ; les mouvements lents conservent une courbe continue et les reprises dans le même sens restent reliées.
- Moyenne de pression pondérée par le déplacement pour conserver le bilan du travail à vitesse variable ; test de régression sur des mouvements de pointeur lents et intermittents.

## 0.18.0 — Réessayer, déplacer et intégrer

- Quiz : indice après une erreur, choix rouge, réponse correcte obligatoire ; Continuer sur le bandeau de l’animation.
- Parcours compression → détente → repos, puis manipulation libre du piston.
- Poignée sur le piston, utilisable à la souris, au toucher et au clavier ; sens imposé pour les deux trajets guidés, déplacement physique continu et borné.
- Zoom resserré sur la bande orange, repères A/B fixes et trajet de volume plus grand.
- Courbe continue P(V) construite sur les pressions mesurées, aire colorée après le trajet ; comparaison de l’intégrale approchée au travail des chocs et à ΔEc.
- Cas immobile avec largeur nulle sur les axes du trajet précédent ; manipulation libre avec branches et aires signées, nouveau tracé sans remise à zéro du gaz.

## 0.17.0 — Comparer activement les vitesses

- Bandeau interactif sur le zoom : vitesse entrante <, = ou > vitesse sortante, pour les trois cas.
- Explication après le choix : contribution à la pression, énergie gagnée ou cédée et signe du travail reçu.
- Correction explicite d’une réponse erronée ; Continuer devient disponible après une réponse.
- Retrait du rebond hypothétique sur piston fixe dans le parcours guidé ; pauses manuelles conservées.

## 0.16.1 — Lire chaque résultat à son rythme

- Les résultats de repos et de compression attendent un clic sur « Cas suivant » ; aucun passage automatique.
- Arrêt manuel sur les vitesses entrante et sortante dans chacun des trois cas ; bouton Continuer pour reprendre.
- Dézoom conservé entre les cas, retour à la simulation toujours disponible.
- Rayon initial commun fixé à 0,50 mm, avec réglage continu sans arrondi du rayon sélectionné.
- Tests de l’attente sans évolution du gaz et du passage manuel entre les trois cas.

## 0.16.0 — Trois cas pour comprendre le travail

- Parcours guidé : piston au repos, compression, puis détente sur le même gaz.
- Pour chaque cas : choc individuel, comparaison des vitesses, puis cumul des chocs sur tout le piston.
- Repère fixe et volume balayé visibles ; convention du travail reçu par le gaz explicitée.
- Diagramme P–V avec aire signée, travail mesuré et variation d’énergie sur la même fenêtre.
- Résultats des trois cas conservés, pause et retour progressif, réglages manuels disponibles hors parcours.
- Tests du signe du travail, de l’égalité avec l’aire et ΔE, des enchaînements et des interruptions.

## 0.15.0 — Entrée et retour progressifs des illustrations

- Température : ralentissement en vue générale, capture à l’arrêt, tracé du cadre, puis zoom sur les vitesses.
- Même rendu du gaz et du piston pendant toutes les transitions, sans déplacer ni modifier les particules pour les besoins du dessin.
- Résultat maintenu à l’écran jusqu’au retour demandé ; le bouton de lancement devient « Retour à la simulation » pour la pression et la température.
- Retour progressif : restitution des flèches, dézoom complet, puis reprise graduelle du temps à la vitesse choisie. Retour anticipé également possible.
- Tests des rampes de lecture, de la caméra, du gaz témoin, des boutons et des interruptions.

## 0.14.0 — Un parcours continu pour la pression

- Un seul bouton : choc individuel, dézoom, vue d’ensemble, puis zoom sur le cumul des poussées.
- Réutilisation du rendu principal et continuité des trajectoires réelles pendant les deux zooms.
- Fenêtre de mesure ouverte uniquement après le second zoom, sans réinitialiser le gaz.
- Tests du passage entre séquences, du retour à la vue d’ensemble et de l’identité avec une simulation témoin.

## 0.13.0 — Comprendre les mesures de pression et de température

- Accumulation réelle des impulsions sur une surface du piston pendant une fenêtre définie, avec somme, force moyenne et pression locale.
- Nouvel onglet Température : zoom figé, vecteurs vitesse, alignement à norme conservée, énergies, somme et moyenne globale.
- Lecture automatique ou pas à pas, pause et retour à la simulation ; distinction entre zone observée et système entier.
- Journal des collisions enrichi en position et identifiant, sans changement de dynamique.

## 0.12.0 — Parcours guidé, séries de températures et cycles

- Onglet Rayon recentré sur deux graphiques pédagogiques, simulation et tracé côte à côte.
- Série automatique de cinq températures avec stabilisation, fenêtre de mesure dédiée, pause et arrêt.
- Analyse P(V − b) et ajustement d’α limités au rayon courant, sans effacer les autres relevés.
- Nouvel onglet Cycles P–V : 1, 3 ou 5 allers-retours, durée réglable, branches colorées et bilan énergétique.

## 0.11.0 — Volume exclu et retour aux expériences

- Tracé P(V − b) en fonction de T, b = αV occupé, référence de pente nR et régression libre.
- Température réglable près du graphique, relevés conservés et distinction entre volume b et interception c.
- Invitation à revisiter les trois premières expériences avec des disques plus grands.

## 0.10.1 — Navigation et grandeurs des relevés

- Rayon commun aux quatre expériences, avec réinitialisation lors du changement et conservation des relevés antérieurs.
- Retrait de l’onglet Échanges thermiques ; quatre expériences renumérotées.
- Axes et CSV : P(V − αV occupé)/T en J/K, inverse du libre parcours moyen et inverse du temps moyen entre chocs.
- Référence à nR et explication du R² pour une grandeur attendue constante.

## 0.10.0 — α ajustable, collecte et régressions

- α réglable de 0 à 5 ; recalcul des relevés et ajustement automatique du rapprochement à 1 par moindres carrés.
- Explication de la référence diluée α ≈ 2 pour les disques 2D et de ses limites.
- 10 000 relevés conservés sans éviction, collecte automatique respectant les fenêtres, tableau paginé.
- Régression OLS sur les axes choisis : équation, R², incertitudes-types sur pente/interception et hypothèses explicites.
- Export des ratios corrigés avec l’α courant ; tests analytiques des erreurs-types et de l’ajustement d’α.

## 0.9.1 — Fenêtres de relevé et correction de volume

- Relevés sur une même fenêtre glissante, après une fenêtre initiale de démarrage écartée ; délai d’au moins une fenêtre entre deux clics.
- Trajets attribués à leur collision finale ; exclusion des trajets commencés pendant le démarrage et conservation des bornes temporelles dans le tableau/CSV.
- Ajout de P(V − V occupé)/(nRT) aux mesures, axes, tableau et export, avec sa définition géométrique.
- Documentation de la différence entre absence de chevauchement et indépendance statistique.

## 0.9.0 — Graphiques des relevés

- Axes X/Y libres pour comparer ratio, rayon, libre parcours moyen, occupation, pression, température, temps entre collisions et nombre de trajets.
- Mesure cinématique des trajets complets entre collisions mutuelles, indépendante de l’équation d’état ; définition et biais de durée explicités.
- Tableau des conditions et export CSV dédié à tous les relevés conservés.
- Tests des distances analytiques avec rebonds aux parois, de l’indépendance des prévisions et des axes/exports.

## 0.8.0 — Impulsions et disques durs

- Impulsion affichée en kg·m/s et expliquée par J = m(v avant − v après) ; flèche orange à la même échelle que les flèches de quantité de mouvement.
- Disques durs avec collisions mutuelles dans les cinq expériences ; suppression du choix ponctuel dans l’interface.
- Dernier onglet consacré au rayon : réglage, réinitialisation au même n/V/T initial, fraction de surface occupée et relevés conservés de PV/(nRT).
- Rayon réel utilisé par le moteur, le dessin et l’export CSV ; zoom mutuel centré sur les seuls disques.
- Vérification des rayons extrêmes, du confinement, des conservations et des séquences guidées.

## 0.7.0 — Unités physiques à échelles fixes

- Affichage en K, L, bar, J, m/s et ms ; état de référence à 300 K, 1 L et 1 bar.
- Conversion cohérente des impulsions, du travail, de la chaleur, des flux, des zooms, des distributions et des exports CSV.
- Diagnostic PV/(nRT) de référence 1, axes logarithmiques sans dimension et rappel 1 bar·L = 100 J.
- 1 000 marqueurs représentent environ 0,0401 mol ; profondeur constante et approximation cinétique 2D documentées discrètement.
- Moteur physique et animations inchangés ; vérification des conversions et des bilans.

# Versions du démonstrateur

## 0.6.3 — 24 octobre 2026

Arrêt sur image de 2,5 secondes à la fin du parcours de travail, après le rebond et avant le dézoom. Les vitesses sortantes « si fixe » et « si mobile » sont agrandies et mises en évidence sur la cavité et dans les mesures, puis la lecture reprend automatiquement. Les autres parcours restent continus.

## 0.6.2 — 24 octobre 2026

Zoom du travail ancré dans le laboratoire, avec position initiale du piston et graduation fixes, vitesse et déplacement visibles avant le choc. Comparaison du rebond réel avec le rebond hypothétique sur un piston immobile au même contact : trajectoire violette, vitesses sortantes et relation v′x = 2u − vx. Choix de chocs incidents permettant cette comparaison, sans modifier la physique.

## 0.6.1 — 24 octobre 2026

Suppression de l’arrêt sur image au choc dans les parcours animés. Le ralenti reste continu, avec une transition progressive de vitesse après le rebond. Une onde visuelle s’étend et s’atténue à l’intérieur du piston, sans modifier sa dynamique ni les échanges calculés.

## 0.6 — 24 octobre 2026

Séquences animées dans la simulation : repérage d’un choc à venir, ralenti, zoom de la caméra, visualisation de l’impact et du transfert, dézoom et reprise automatique à la vitesse précédente. Le repérage utilise une copie indépendante du moteur et du générateur aléatoire thermique ; le choc est ensuite vérifié dans le gaz affiché. Paramètres verrouillés pendant la séquence, interruption par Pause, changement d’onglet, remise à zéro ou bouton dédié.

Premier onglet consacré à la pression sur un piston immobile. Parcours thermique montrant successivement une chaleur reçue puis cédée par le gaz. Détente et compression regroupées dans un onglet adiabatique, avec une illustration du travail sur le piston mobile. Les quantités de mouvement sont représentées dans le référentiel du laboratoire à la même échelle, et les variations d’énergie sont explicitées avec la convention du travail reçu par le gaz. Absence de choc signalée sans modifier la dynamique.

Tests de fidélité des prévisions et des trajectoires, des deux signes de chaleur et de travail, y compris pour les disques durs, et des commandes de reprise ou d’interruption. Le schéma figé de comparaison des modèles reste disponible.

## 0.5 — 24 octobre 2026

Visite guidée organisée par expériences, dans l’ordre : pression–travail, échanges thermiques, Joule–Gay–Lussac, détente adiabatique, compression adiabatique et comparaison des modèles. Simulation et courbes réunies sur le même écran de travail, avec basculement Évolution P/V/T ↔ PV/T. États et mesures conservés par onglet ; seule l’expérience affichée évolue. Retrait de l’expérience des cycles périodiques et de son interface.

Nombre de particules fixé à 1 000 dans chaque gaz. Rayon graphique 0,04 dans les deux modèles. Deux simulations synchronisées pour comparer les points et les disques durs, courbes PV/T communes et export distinct des mesures de chaque modèle.

Instrumentation des vrais événements : position et date, vitesses avant/après, impulsion, travail et chaleur. Zoom du choc, arrêt sur un nouvel événement, ralenti jusqu’à ×0,05 et pas de 0,02 u.t. Flèche d’impulsion ou de chaleur au point de contact. Jauge de pression calculée par ΣJ/(HΔt) et mise en évidence de δW = 0 à piston fixe. Thermostat sélectif (paroi gauche par défaut), chaleur par collision et flux moyen par unité de longueur. Le zoom des deux modèles distingue le choc calculé des disques du prolongement illustratif des trajectoires ponctuelles.

Diagrammes avancés et distributions maintenus dans une section dépliable. Documentation et tests adaptés aux parcours guidés, à la conservation des états, au comptage de 1 000 particules, à l’instrumentation et aux exports comparatifs.

## 0.4 — 24 octobre 2026

Interface organisée en quatre onglets : Expérimenter, Diagrammes, Particules et Comprendre. Presets Joule–Gay–Lussac, détente et compression adiabatiques, cycles périodiques et laboratoire libre. Les curseurs de volume, de durée et de température, les questions guidées et les détails dépliables permettent de découvrir progressivement les commandes. Toutes les analyses, tous les réglages et les exports de la version 0.3 sont conservés. Navigation clavier et présentation adaptée aux écrans étroits.

Modèle optionnel de disques durs de rayon 0,04 avec collisions mutuelles élastiques, placement sans recouvrement et résolution événementielle des contacts. Compteurs de collisions et de surface occupée, températures directionnelles et export du modèle. Le changement s’applique lors de la préparation d’un nouvel état. Les limites du modèle, dont la convention de contact thermique multiple à temps identique, sont documentées.

Les sauts de volume d’une détente libre ne sont plus reliés par un segment dans les diagrammes classiques, afin de ne pas suggérer un travail de pression. Le budget de calcul par image préserve la réactivité pour les simulations coûteuses sans sauter de pas physique.

## 0.3 — 24 octobre 2026

Diagrammes P–V, P–T et V–T sur plusieurs périodes du mouvement du piston, avec distinction des parcours successifs. Comparaison du travail mesuré aux chocs à l’intégrale estimée dans le diagramme P–V. Bilans de travail, de chaleur et d’énergie par période et export des cycles. Une période mécanique n’est pas supposée être un cycle thermodynamique fermé.

Choix entre parois isolantes et contact avec un thermostat à température réglable, avec fraction de chocs thermalisés et choix du comportement thermique du piston. Quantification de la chaleur reçue ou cédée, de la puissance thermique et du bilan `ΔE = W + Q`. Les vitesses sont modifiées par les collisions thermiques et non par un rééchelonnement global instantané.

L’aire issue d’une pression lissée reste une estimation ; son retard de mesure et les fluctuations sont explicités. Les aires des diagrammes P–T et V–T ne sont pas assimilées à un travail.

## 0.2 — 24 octobre 2026

Réglage de 10 à 1 000 particules, par curseur ou saisie entière. Histogrammes normalisés de la norme de la vitesse et de l’énergie cinétique individuelle, comparant l’état actuel à l’état initial.

Calcul du travail de pression à partir des impulsions sur le piston, avec puissance moyenne et contrôle par le bilan énergétique. Ajout des graphiques `PV = f(T)` et `ln(P) = f(ln(V))`, d’une référence isotrope 2D et d’un ajustement du γ apparent sur un seul trajet. Choix de la pression moyenne des parois ou de celle du piston pour les graphiques. Export CSV enrichi.

Le modèle conserve des particules ponctuelles sans collisions moléculaires. Les références thermodynamiques restent des comparaisons dont les conditions doivent être examinées ; la simulation n’impose pas la loi adiabatique.

Point de sauvegarde avant ces évolutions : `8df03e4`.

## 0.1 — 24 octobre 2026

Première version fonctionnelle : gaz parfait ponctuel en 2D, piston à vitesse constante, mouvement progressif ou périodique, détente libre, pression calculée par les collisions, température cinétique et bilan énergétique. Graphiques temporels et pression–volume, pause, réinitialisation et export CSV. Fonctionnement autonome dans le navigateur.

Validation : 18 tests physiques et 7 scénarios fonctionnels passent.

Code initial : `ce231efd8e8e54ccc9bdb5604906497b2e22f944`.
