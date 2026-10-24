# Versions du démonstrateur

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
