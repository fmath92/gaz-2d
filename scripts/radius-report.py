"""Build the reproducible reference dataset and comparison report after acquisition.
Requires matplotlib and numpy. Run from the repository root.
"""
import json, math, csv, hashlib
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parent.parent
raw=json.loads((root/'data/radius-study-raw.json').read_text())
p=raw['protocol'];runs=raw['results']
assert len(runs)==len(p['radii'])*len(p['seeds']), 'Acquisition incomplete'
mean=lambda xs: float(np.mean(xs))
def sem(xs):return float(np.std(xs,ddof=1)/math.sqrt(len(xs)))
length=(1e-3/82.5)**(1/3);time=length/200
rows=[];records=[]
for radius in p['radii']:
    replicas=[q for q in runs if q['radius']==radius]
    assert len(replicas)==2
    blocks=[b for q in replicas for b in q['blocks']]
    zs=[b['ratio'] for b in blocks]
    paired=[mean([bs[i]['ratio'],bs[i+1]['ratio']]) for q in replicas for bs in [q['blocks']] for i in range(0,len(bs)-1,2)]
    z=mean([q['ratio'] for q in replicas])
    error=max(sem(zs),sem(paired),sem([q['ratio'] for q in replicas]))
    phi=p['count']*math.pi*radius**2/(p['width']*p['height'])
    flights=sum(b['completedFlights'] for b in blocks)
    weighted=lambda key:sum(b[key]*b['completedFlights'] for b in blocks)/flights
    rows.append(dict(radius_mm=radius*length*1000,packing=phi,Z=z,SE=error,blocks=len(blocks),replicas=2,volume_L=1,temperature_K=300,pressure_bar=z,equilibration_min_ms=min(q['equilibratedAt'] for q in replicas)*time*1000,measurement_total_ms=sum(b['end']-b['start'] for b in blocks)*time*1000,max_relative_energy_error=max(q['maxEnergyError'] for q in replicas)))
    records.append(dict(radius=radius,ratio=z,ratioSE=error,blocks=len(blocks),replicas=2,pressure=z*1000*1.5/82.5,volume=82.5,packing=phi,temperature=1.5,source='mean',protocol='reference',time=None,windowStart=None,meanFreePath=weighted('meanFreePath'),meanCollisionTime=weighted('meanCollisionTime'),completedFlights=flights))
x=np.array([r['radius_mm'] for r in rows]);z=np.array([r['Z'] for r in rows]);err=np.array([r['SE'] for r in rows]);phi=np.array([r['packing'] for r in rows])
H=lambda eta:(1+eta*eta/8)/(1-eta)**2
C=lambda r:11*7.5*(11+7.5-4*r)/((11-2*r)*(7.5-2*r)*(11+7.5))
lo,hi=0,.999/x.max()
objective=lambda a:sum((z-1/(1-a*x))**2)
for _ in range(150):
    a,b=(2*lo+hi)/3,(lo+2*hi)/3
    if objective(a)<objective(b):hi=b
    else:lo=a
old_a=(lo+hi)/2
models={'Ancien modèle b = a·r (a ajusté)':1/(1-old_a*x),'Volume exclu b = 2V occupé':1/(1-2*phi),'Henderson (fluide homogène)':H(phi),'Henderson × correction de paroi':H(phi)*C(np.array(p['radii']))}
scores={name:dict(R2=float(1-sum((z-values)**2)/sum((z-z.mean())**2)),RMSE=float(np.sqrt(np.mean((z-values)**2))),max_relative_error=float(np.max(np.abs((values-z)/z)))) for name,values in models.items()}
for i,r in enumerate(rows):
    r['Henderson']=float(models['Henderson (fluide homogène)'][i]);r['Henderson_wall']=float(models['Henderson × correction de paroi'][i])
with (root/'data/radius-study.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=rows[0].keys());writer.writeheader();writer.writerows(rows)
summary={'protocol':p,'runs':len(runs),'blocks':sum(len(q['blocks']) for q in runs),'rows':rows,'models':scores,'old_a_L_per_mm':old_a,'physics_sha256':hashlib.sha256((root/'dist/physics.js').read_bytes()).hexdigest(),'max_energy_error':max(q['maxEnergyError'] for q in runs)}
(root/'data/radius-study-summary.json').write_text(json.dumps(summary,indent=2))
(root/'dist/radius-reference.js').write_text('/* Measured reference: scripts/radius-study.mjs + scripts/radius-report.py. */\nglobalThis.GasRadiusReference = Object.freeze('+json.dumps({'protocol':p,'records':records},ensure_ascii=False,separators=(',',':'))+');\n')
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False})
fig,(ax,delta)=plt.subplots(2,1,figsize=(9,8),sharex=True,gridspec_kw={'height_ratios':[2,1]},layout='constrained')
ax.errorbar(x,z,yerr=err,fmt='o',ms=4,color='#287db4',label='26 rayons · mesures ± erreur-type',zorder=5)
grid=np.linspace(x.min(),x.max(),300);r=grid/(length*1000);eta=1000*np.pi*r*r/82.5
ax.plot(grid,1/(1-old_a*grid),'--',color='#a46b78',label='Ancien modèle b = a·r (ajusté)')
ax.plot(grid,H(eta),'--',color='#85969c',label='Henderson seul')
ax.plot(grid,H(eta)*C(r),color='#ce8033',lw=2,label='Henderson × correction de paroi')
ax.set_ylabel('PV / (nRT)');ax.set_title('Disques durs 2D : effet du rayon à l’équilibre',loc='left',weight='bold');ax.legend(frameon=False,loc='upper left',fontsize=10);ax.grid(alpha=.15)
residual=z-models['Henderson × correction de paroi'];delta.errorbar(x,residual,yerr=err,fmt='o',ms=4,color='#287db4');delta.axhline(0,color='#ce8033');delta.grid(alpha=.15);delta.set_ylabel('Mesure − modèle corrigé');delta.set_xlabel('Rayon (mm)')
fig.savefig(root/'data/radius-study.png',dpi=170);fig.savefig(root/'data/radius-study.svg')
tr=''.join(f'<tr><td>{name}</td><td>{v["R2"]:.6f}</td><td>{v["RMSE"]:.5f}</td><td>{100*v["max_relative_error"]:.3f} %</td></tr>' for name,v in scores.items())
html=f'''<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Gaz 2D — étude précise des rayons</title><style>body{{font:17px/1.6 system-ui;max-width:1000px;margin:40px auto;padding:0 24px;color:#253e4c}}h1,h2{{line-height:1.2}}img{{width:100%}}table{{border-collapse:collapse;width:100%}}td,th{{text-align:left;padding:10px;border-bottom:1px solid #ddd}}code{{overflow-wrap:anywhere}}a{{color:#087c78}}</style>
<h1>Disques durs : une série de référence contrôlée</h1><p>26 rayons de {x.min():.3f} à {x.max():.3f} mm, deux graines indépendantes par rayon, 1 000 particules, 300 K, 1 L, parois isolantes et piston fixe. Les mesures viennent du moteur du simulateur ; aucune pression n’est reconstruite à partir d’une équation d’état.</p><img src="radius-study.png" alt="Mesures avec erreurs statistiques et comparaison des modèles ; résidus du modèle corrigé">
<h2>Protocole et précision</h2><p>52 simulations et {summary['blocks']} blocs de mesure. À chaque rayon : au moins 60 unités internes (≈ 6,90 ms, plus de six temps de traversée typiques) écartées. Trois fenêtres de 20 unités consécutives doivent présenter un étalement de pression inférieur à 2 %, une anisotropie moyenne |Tx − Ty|/T inférieure à 3 %, et une occupation moyenne de chacun des quatre quarts de la cavité à moins de 2 points de 25 %. Ce contrôle pratique ne prouve pas mathématiquement l’équilibre.</p><p>Ensuite, au moins huit nouvelles fenêtres disjointes de 20 unités (≈ 2,30 ms, dix fois la fenêtre usuelle) par initialisation. Jusqu’à seize fenêtres si l’erreur-type par simulation dépasse 0,0015 sur Z. Tous les blocs retenus sont conservés, y compris leurs fluctuations. Chaque point final est la moyenne des deux initialisations. L’erreur-type affichée est le maximum de trois estimations : dispersion des blocs de 20 unités, des paires de blocs (40 unités), et des deux moyennes d’initialisation. Elle ne comprend pas les erreurs systématiques, et deux initialisations ne suffisent pas à certifier l’indépendance statistique.</p><p>Erreurs-types finales : {min(err):.5f} à {max(err):.5f} sur Z. Écart énergétique relatif maximal : {summary['max_energy_error']:.2g}. La comparaison de la première et de la seconde moitié des mesures est disponible dans les blocs bruts ; les premières et dernières fenêtres peuvent encore fluctuer.</p>
<h2>Comparaison des formules</h2><table><tr><th>Modèle</th><th>R²</th><th>Écart RMS sur Z</th><th>Écart relatif maximal</th></tr>{tr}</table><p>Le coefficient de l’ancien modèle est réajusté sur la nouvelle série : a = {old_a:.6f} L/mm. Les trois autres courbes n’ont aucun paramètre ajusté. R² = 1 − Σ(Zmes − Zmodèle)² / Σ(Zmes − moyenne)² : c’est un indicateur d’accord, pas une régression quand aucun paramètre n’est ajusté.</p>
<h2>Pourquoi la dépendance en rayon change</h2><p>Pour des disques, φ = Nπr²/(LH). La formule de Henderson est ZH = (1 + φ²/8)/(1 − φ)², et commence par 1 + 2φ aux faibles densités. Le premier effet des collisions mutuelles varie donc comme r². Source : <a href="https://research.ibm.com/publications/a-simple-equation-of-state-for-hard-discs">Henderson (1975)</a> ; <a href="https://landau.unex.es/~sphinx/santos/PUBLICATIONS/a95SaHaYuJCPv103p4622_n21.pdf">comparaison des équations par Santos et al. (1995)</a>.</p>
<h2>Prise en compte approchée des parois</h2><p>Les centres ne peuvent pas s’approcher à moins de r d’une paroi : les longueurs accessibles sont L − 2r et H − 2r. Pour des centres indépendants, les forces moyennes sur les parois sont NkT/(L − 2r) et NkT/(H − 2r). En utilisant la même moyenne sur le périmètre physique que le simulateur, on obtient exactement Cparois = LH(L + H − 4r)/[(L − 2r)(H − 2r)(L + H)].</p><p>La courbe orange utilise Z ≈ Cparois × ZH(φ). La multiplication par ce facteur est une approximation géométrique proposée ici, pas une formule exacte du fluide en interaction et pas une conséquence démontrée de l’équation de Henderson. Elle donne un bon accord sur cette série. Les termes de surface liés aux interactions et les coins ne sont pas traités ; la précision ne doit pas être extrapolée à d’autres densités, nombres de particules ou géométries. La courbe Henderson seule reste visible pour distinguer les deux contributions.</p>
<h2>Reproduire et examiner</h2><p><a href="radius-study.csv">Données agrégées CSV</a> · <a href="radius-study-raw.json">Tous les blocs bruts JSON</a> · <a href="radius-study-summary.json">Résumé et scores JSON</a> · <a href="radius-study.svg">Figure SVG</a></p><p>Commandes : <code>node scripts/radius-study.mjs</code>, puis <code>python scripts/radius-report.py</code> (numpy et matplotlib). La collecte reprend les runs terminés. Le moteur reste inchangé, avec son pas maximal 1/240 et ses collisions élastiques exactes dans chaque segment.</p><p>SHA-256 de physics.js : <code>{summary['physics_sha256']}</code>.</p></html>'''
(root/'data/radius-study-report.html').write_text(html)
print(json.dumps({k:summary[k] for k in ['runs','blocks','models','old_a_L_per_mm','max_energy_error']},indent=2))
