# Versions du démonstrateur

## 0.2 — 24 octobre 2026

Réglage de 10 à 1 000 particules, par curseur ou saisie entière. Histogrammes normalisés de la norme de la vitesse et de l’énergie cinétique individuelle, comparant l’état actuel à l’état initial.

Calcul du travail de pression à partir des impulsions sur le piston, avec puissance moyenne et contrôle par le bilan énergétique. Ajout des graphiques `PV = f(T)` et `ln(P) = f(ln(V))`, d’une référence isotrope 2D et d’un ajustement du γ apparent sur un seul trajet. Choix de la pression moyenne des parois ou de celle du piston pour les graphiques. Export CSV enrichi.

Le modèle conserve des particules ponctuelles sans collisions moléculaires. Les références thermodynamiques restent des comparaisons dont les conditions doivent être examinées ; la simulation n’impose pas la loi adiabatique.

Point de sauvegarde avant ces évolutions : `8df03e4`.

## 0.1 — 24 octobre 2026

Première version fonctionnelle : gaz parfait ponctuel en 2D, piston à vitesse constante, mouvement progressif ou périodique, détente libre, pression calculée par les collisions, température cinétique et bilan énergétique. Graphiques temporels et pression–volume, pause, réinitialisation et export CSV. Fonctionnement autonome dans le navigateur.

Validation : 18 tests physiques et 7 scénarios fonctionnels passent.

Code initial : `ce231efd8e8e54ccc9bdb5604906497b2e22f944`.
