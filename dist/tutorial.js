/* Optional guided visit. Progress observes real UI actions and simulation state;
 * the guide never fabricates a measurement or changes particle trajectories. */
(function(root){
  'use strict';
  const idle=s=>!s.lesson&&!s.tour&&!s.returning;
  const relaxed=s=>s.run?.free&&s.time-s.run.start>=8;
  const steps=[
    {title:'Votre laboratoire, à votre rythme',target:'chamber',text:'Les points sont 1 000 disques qui se déplacent et se heurtent. Leur couleur indique leur rapidité. Les cartes au-dessus affichent les grandeurs mesurées. Le cadre lumineux vous indiquera où agir.'},
    {title:'Ralentir pour observer',target:'timeScale',event:'timeScale:input',text:'Changez la vitesse de lecture, par exemple ×0,25. Vous ralentissez le film, sans changer les vitesses physiques des particules.'},
    {title:'Arrêter le film',target:'pause',event:'pause:click',done:s=>!s.playing,text:'Cliquez sur Pause. Vous pouvez prendre le temps de regarder les particules et les mesures.'},
    {title:'Reprendre la lecture',target:'pause',event:'pause:click',done:s=>s.playing,text:'Reprenez la lecture. Les expériences gardent leurs réglages et leur état lorsque vous changez d’onglet.'},
    {experiment:'pressure',scene:true,waiting:s=>!!(s.tour||s.lesson&&!s.lesson.paused),title:'D’où vient la pression ?',target:s=>s.lesson?.paused?'pause':s.lesson?'lessonCanvas':s.tour?'chamber':'illustrate',done:s=>s.lesson?.kind==='pressure'&&s.lesson.phase==='done',text:s=>s.lesson?'Regardez les impulsions s’additionner : la pression est leur somme divisée par la surface et la durée de mesure. Attendez le bilan.':s.tour?'Suivez la poussée d’une particule. Le parcours montrera ensuite plusieurs chocs sur une même surface.':'Cliquez sur « Comprendre la pression ». Vous suivrez un choc, puis une assemblée de chocs du même gaz.'},
    {experiment:'pressure',title:'Revenir au gaz',target:'illustrate',done:idle,text:'Cliquez sur « Retour à la simulation ». La caméra recule et le temps reprend progressivement.'},
    {title:'Passer à la température',target:'tab-temperature',done:s=>s.experiment==='temperature',text:'Ouvrez l’onglet Température. Nous allons relier l’agitation des particules à une grandeur mesurable.'},
    {experiment:'temperature',scene:true,waiting:s=>!!s.lesson&&!s.lesson.paused,title:'Des vitesses à la température',target:s=>s.lesson?.paused&&s.lesson.phase!=='done'?'nextTemperatureStage':s.lesson?'chamber':'illustrateTemperature',done:s=>s.lesson?.kind==='temperature'&&s.lesson.phase==='done',text:s=>s.lesson?'Le temps se fige ; les vecteurs sont rassemblés, puis leurs normes donnent les énergies cinétiques. Même masse : Ec = ½mv². En 2D, l’énergie totale donne T = E/(nR). Attendez le bilan ; « Étape suivante » permet aussi d’avancer.':'Lancez « Des vitesses à la température ». L’animation part d’un véritable instant du gaz.'},
    {experiment:'temperature',title:'Quitter l’instant figé',target:'illustrateTemperature',done:idle,text:'Utilisez le même bouton pour retrouver la simulation et la lecture normale.'},
    {title:'Une détente sans travail',target:'tab-free',done:s=>s.experiment==='free',text:'Ouvrez Joule–Gay–Lussac : le gaz va disposer de plus d’espace en s’étendant dans le vide.'},
    {experiment:'free',title:'Préparer une nouvelle détente',target:'reset',event:'reset:click',text:'Cliquez sur Recommencer. Cela réinitialise cette expérience ; le rayon commun est conservé. Le volume final vaut deux fois le volume initial par défaut.'},
    {experiment:'free',scene:true,waiting:s=>s.run?.free&&s.playing,title:'Ouvrir et suivre P, V et T',target:s=>s.chart!=='time'?'chart-time':s.run?.free?'chart':'start',done:s=>s.chart==='time'&&relaxed(s),text:s=>s.run?.free?'V/V₀ atteint 2, T/T₀ reste à 1. Pour un gaz dilué revenu à l’équilibre, P/P₀ est proche de 0,5. Laissez passer le transitoire : la pression est mesurée sur une fenêtre de temps.':'Choisissez « Évolution P, V, T », puis « Ouvrir vers le vide ». Aucun piston mobile ne travaille ici : W = Q = 0.'},
    {experiment:'free',title:'Refaire avec un autre regard',event:'retryFreeRatio:click',target:s=>relaxed(s)?'retryFreeRatio':s.run?.free?'chart':'start',done:s=>s.chart==='ratio'&&!s.run,text:'Cliquez sur « Recommencer avec PV/(nRT) » sous le diagramme. Le gaz est préparé à nouveau, et le graphique change.'},
    {experiment:'free',scene:true,waiting:s=>s.run?.free&&s.playing,title:'La même détente, avec PV/(nRT)',target:s=>s.run?.free?'chart':'start',done:s=>s.chart==='ratio'&&relaxed(s),text:'Ouvrez à nouveau vers le vide. Après le transitoire, le rapport revient-il près de 1 ? La référence idéale ne décrit pas nécessairement chaque instant hors équilibre.'},
    {experiment:'free',scene:true,title:'Ce qu’il faut retenir',target:'chart',text:'L’ouverture ne change aucune vitesse au départ. La température cinétique reste constante ; la pression évolue lorsque le gaz remplit la cavité. Avec des disques moins dilués, le rapport PV/(nRT) peut s’écarter de 1.'},
    {title:'Quand le piston se déplace',target:'tab-adiabatic',done:s=>s.experiment==='adiabatic',text:'Ouvrez Détente & compression pour voir comment un piston mobile échange de l’énergie avec le gaz.'},
    {experiment:'adiabatic',title:'Lancer les trois cas',target:'illustrate',done:s=>s.lesson?.kind==='work',text:'Lancez « Comprendre le travail ». Vous comparerez les vitesses sortante et entrante, puis déplacerez le piston.'},
    {experiment:'adiabatic',scene:true,title:'Un choc, puis le travail du trajet',target:s=>s.lesson?.paused?'pause':s.lesson?.tour?.phase==='compare'?'workSpeedQuestion':s.lesson?.phase==='hold'?'nextWorkCase':s.lesson?.window?.canDrag?'workPistonHandle':s.lesson?'chamber':'illustrate',done:s=>s.lesson?.phase==='free',text:s=>s.lesson?.tour?.phase==='compare'?'Comparez vitesse sortante et vitesse entrante. Choisissez <, = ou >, puis lisez le signe du travail. Une bonne réponse active Continuer.':s.lesson?.phase==='hold'?'Lisez le bilan : l’aire signée du diagramme est reliée à l’énergie échangée. Passez au cas suivant sur le bandeau.':s.lesson?.window?.canDrag?'Glissez la poignée orange de A vers B. La courbe P(V) se trace pendant le mouvement ; son aire se colore à l’arrivée. Vous pouvez aussi utiliser les flèches du clavier.':'Suivez la compression, la détente, puis le repos. Une poussée contribue à la pression ; un échange d’énergie dépend aussi du mouvement du piston.'},
    {experiment:'adiabatic',scene:true,title:'Essayer un parcours libre',target:s=>s.lesson?.window?.canDrag?'workPistonHandle':'illustrate',done:s=>s.lesson?.phase==='free'&&s.lesson.window.strokes.some(b=>b.direction>0)&&s.lesson.window.strokes.some(b=>b.direction<0),text:'Déplacez le piston dans les deux sens. Les branches du diagramme gardent l’ordre du parcours. Le travail reçu est positif en compression, négatif en détente ; il est nul au repos.'},
    {experiment:'adiabatic',title:'Revenir aux commandes',target:'illustrate',done:idle,text:'Quittez l’illustration avec « Retour à la simulation ». Vous retrouvez les réglages de trajet et de durée pour vos propres essais.'},
    {title:'Enchaîner des cycles',target:'tab-cycles',done:s=>s.experiment==='cycles',text:'Ouvrez Cycles P–V pour suivre plusieurs compressions et détentes sur un même diagramme.'},
    {experiment:'cycles',title:'Choisir un aller-retour',target:'cycleCount',done:()=>document.getElementById('cycleCount').value==='1',text:'Pour ce premier essai, choisissez 1 aller-retour. Vous pourrez ensuite en comparer 3 ou 5.'},
    {experiment:'cycles',title:'Régler la rapidité du piston',target:'duration',event:'duration:input',text:'Déplacez le curseur de durée du trajet. Une durée courte signifie un piston rapide. Le temps simulé est indiqué en millisecondes, avec une lecture fortement ralentie.'},
    {experiment:'cycles',waiting:s=>s.cycle?.running&&s.playing,title:'Dessiner l’aller et le retour',target:s=>s.cycle&&!s.playing?'pause':s.cycle?'chart':'start',done:s=>!!s.cycle&&s.cycle.leg>=1,text:'Lancez les cycles. Orange : compression ; bleu : détente. Les trajets peuvent différer : comparez leur aire et l’énergie du gaz. Attendez au moins le premier changement de sens, ou passez cette étape.'},
    {title:'Mettre la loi des gaz à l’épreuve',target:'tab-comparison',done:s=>s.experiment==='comparison',text:'Ouvrez Rayon & loi des gaz. Le volume propre des disques permet d’explorer les limites du gaz dilué.'},
    {experiment:'comparison',title:'Changer la taille des disques',target:'particleRadius',event:'particleRadius:input',text:'Déplacez le curseur de rayon. Le rayon est commun aux six expériences : il faudra appliquer ce choix pour reconstruire le gaz sans recouvrement.'},
    {experiment:'comparison',title:'Appliquer le nouveau rayon',target:'applyRadius',event:'applyRadius:click',text:'Appliquez le rayon. Les simulations redémarrent, mais les relevés déjà conservés gardent leur rayon d’origine.'},
    {experiment:'comparison',title:'Conserver une mesure',target:s=>s.recordY!=='ratio'?'plotRadius':!s.playing?'pause':'recordRadius',event:'recordRadius:click',text:'Choisissez « L’effet du rayon », laissez le gaz évoluer puis relevez ce rayon. Le bouton attend une fenêtre complète ; deux relevés successifs ne partagent pas la même fenêtre de mesure.'},
    {experiment:'comparison',title:'Introduire un volume exclu',target:'plotExcludedVolume',done:s=>s.recordY==='correctedPV',text:'Passez à P(V − b) en fonction de T. À rayon fixé, on cherche une correction de volume b = αV occupé qui rapproche les mesures de la droite de pente nR.'},
    {experiment:'comparison',waiting:s=>!!s.batch,title:'Mesurer plusieurs températures',target:s=>s.batch?'temperatureProtocol':'startTemperatureSeries',event:'startTemperatureSeries:click',done:s=>!s.batch&&s.seriesFinished,text:s=>s.batch?'La série prépare cinq températures, attend une stabilisation puis mesure chaque état. La lecture passe à ×4. Laissez-la terminer, ou passez cette étape pour découvrir la suite.':'Lancez les cinq températures. Les points sont mesurés à rayon fixé, avant toute correction par α. En cas d’arrêt faute de stabilisation, vous pouvez relancer ou passer cette étape.'},
    {experiment:'comparison',title:'Ajuster la correction',target:s=>s.recordY==='correctedPV'?'alpha':'plotExcludedVolume',event:'alpha:input',text:'Faites varier α. Les points corrigés bougent, mais le gaz ne change pas. Comparez la pente mesurée à nR et l’ordonnée à l’origine à zéro. Le bouton d’ajustement automatique propose aussi une valeur.'},
    {experiment:'comparison',title:'Lire une régression avec prudence',target:'recordChart',text:'La droite de référence, la régression, R² et les incertitudes sur la pente et l’ordonnée aident à comparer les relevés. Il faut au moins trois températures distinctes. Un grand R² ne prouve pas à lui seul une équation d’état.'},
    {title:'Revenir avec des disques plus grands',target:s=>s.experiment==='comparison'?'revisitAdiabatic':'tab-adiabatic',done:s=>s.experiment==='adiabatic',text:'Retournez aux adiabatiques avec le rayon choisi. Les résultats observés pour un gaz dilué restent-ils valables ? Les boutons en bas de l’expérience proposent ce retour au laboratoire.'},
    {experiment:'adiabatic',title:'Ouvrir les outils complémentaires',target:s=>!idle(s)?'illustrate':'advancedToggle',done:s=>idle(s)&&document.getElementById('advanced').open,text:'Si une illustration est encore ouverte, revenez à la simulation. Ouvrez ensuite « Approfondir » : autres diagrammes, distributions, réglages et export.'},
    {experiment:'adiabatic',title:'Changer de diagramme',target:()=>document.getElementById('advanced').open?'extraChart':'advancedToggle',event:'extraChart:input',text:'Choisissez P–T, V–T, P–V ou une autre représentation. Seule l’aire sur P–V se relie directement au travail de pression ; les autres graphes répondent à d’autres questions.'},
    {experiment:'adiabatic',title:'Observer la dispersion des vitesses',target:'speedHistogram',text:'Ces distributions montrent les normes des vitesses et les énergies cinétiques. Les pointillés rappellent l’état initial : une moyenne ne décrit pas à elle seule toute la population.'},
    {experiment:'adiabatic',title:'Garder une trace de vos expériences',target:'export',text:'Ce bouton exporte l’historique en CSV avec les unités. Dans Rayon & loi des gaz, un autre bouton exporte les relevés conservés. Vous pouvez essayer, ou continuer sans télécharger.'},
    {title:'À vous de mener l’enquête',target:'openTutorial',text:'Vous connaissez les commandes principales. Variez un paramètre à la fois, comparez vos prédictions aux mesures et revenez sur les expériences avec un autre rayon. La visite reste accessible ici.'}
  ];
  function create({getState}){
    const $=id=>document.getElementById(id),counts={},guide={welcoming:true,active:false,index:0,baseline:{},target:null,completed:false,interacting:false};
    const pointers=new Set(),keys=new Set();
    const resolve=(value,state)=>typeof value==='function'?value(state):value;
    const setText=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text;};
    function record(id,type){const key=id+':'+type;$(id).addEventListener(type,()=>{counts[key]=(counts[key]??0)+1;if(guide.active)update();});}
    for(const key of new Set(steps.flatMap(s=>s.event?[s.event]:[]))){const[id,type]=key.split(':');record(id,type);}
    function modal(open){guide.welcoming=open;$('tutorialWelcome').hidden=!open;$('appHeader').inert=$('appMain').inert=open;}
    function finish(){guide.active=false;guide.target=null;guide.interacting=false;pointers.clear();keys.clear();modal(false);$('tutorialCard').hidden=$('tutorialSpotlight').hidden=true;document.body?.classList.toggle('tutorial-running',false);$('openTutorial').focus();}
    function enter(index){
      if(index>=steps.length){finish();return;}
      guide.index=index;guide.completed=false;guide.baseline={...counts};guide.target=null;guide.active=true;modal(false);
      $('tutorialCard').hidden=false;document.body?.classList.toggle('tutorial-running',true);
      $('tutorialChapter').value=String([0,4,6,9,15,20,24,32].filter(i=>i<=index).at(-1));
      setText('tutorialTitle',steps[index].title);$('tutorialTitle').focus({preventScroll:true});update();
    }
    function ready(state){if(guide.completed)return true;const step=steps[guide.index];return !!((!step.experiment||state.experiment===step.experiment)&&(!step.event||(counts[step.event]??0)>(guide.baseline[step.event]??0))&&(!step.done||step.done(state)));}
    function update(){
      if(!guide.active)return;
      const step=steps[guide.index],s=getState(),wrong=step.experiment&&step.experiment!==s.experiment;
      let id=wrong?'tab-'+step.experiment:resolve(step.target,s);
      const closed=$(id).closest?.('details:not([open])');if(closed?.id==='advanced')id='advancedToggle';
      const el=$(id),ok=!wrong&&ready(s);if(ok)guide.completed=true;
      // Keep the laboratory unobscured until the action/observation is finished.
      // A slider gesture must finish before the veil returns, even if its first
      // input event has already validated the step.
      guide.interacting=!ok||pointers.size>0||keys.size>0;
      $('tutorialSpotlight').classList.toggle('interaction',guide.interacting);
      $('tutorialCard').classList.toggle('scene-guide',!!step.scene);
      setText('tutorialTitle',step.title);
      setText('tutorialText',wrong?'Revenez à l’onglet indiqué pour poursuivre cette étape. Vos autres expériences conservent leur état.':resolve(step.text,s));
      setText('tutorialProgress','VISITE · '+(guide.index+1)+' / '+steps.length);
      const progress=((guide.index+1)/steps.length*100)+'%';
      if($('tutorialFill').style.width!==progress)$('tutorialFill').style.width=progress;
      // Navigation is always available. Completion is feedback, not a lock.
      setText('tutorialNext',guide.index===steps.length-1?'Terminer la visite ✓':'Continuer →');
      const message=ok?(step.done||step.event?'Étape réalisée ✓ · prenez le temps de lire.':'À observer · continuez quand vous le souhaitez.'):step.waiting?.(s)?'Observation en cours… « Continuer » reste disponible à votre rythme.':'À vous de jouer dans la zone encadrée. « Continuer » reste disponible à votre rythme.';
      setText('tutorialStatus',message);
      if(guide.target!==id){
        guide.target=id;
        // Keep both the cavity and its diagram visible during a desktop scene,
        // even when the highlighted control is near the bottom of the cavity.
        const scrollTarget=step.scene&&!wrong&&(root.innerWidth??1280)>=760?$('chamber'):el;
        scrollTarget.scrollIntoView?.({block:step.scene||(root.innerWidth??1280)<760?'start':'center',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      }
      position(el);
    }
    function position(el){
      const rect=el.getBoundingClientRect(),vw=root.innerWidth??1280,vh=root.innerHeight??800;
      const spot=$('tutorialSpotlight'),card=$('tutorialCard');
      spot.hidden=el.hidden||rect.width===0||rect.height===0;
      spot.style.left=(rect.left-7)+'px';spot.style.top=(rect.top-7)+'px';spot.style.width=(rect.width+14)+'px';spot.style.height=(rect.height+14)+'px';
      const scene=steps[guide.index].scene;
      const width=Math.min(scene?850:370,vw-24);card.style.width=width+'px';
      const height=card.getBoundingClientRect().height;
      if(scene){card.style.left=((vw-width)/2)+'px';card.style.top=Math.max(12,vh-height-12)+'px';}
      else if(vw<760){card.style.left='12px';card.style.top=Math.max(12,vh-height-12)+'px';}
      else {
        const rightSpace=vw-(rect.left+rect.width),leftSpace=rect.left;
        const x=guide.target==='workPistonHandle'?vw-width-18:rightSpace>=width+28?rect.left+rect.width+20:leftSpace>=width+28?rect.left-width-20:vw-width-18;
        const y=rightSpace>=width+28||leftSpace>=width+28?Math.max(18,Math.min(rect.top,vh-height-18)):rect.top>=height+30?rect.top-height-18:vh-height-18;
        card.style.left=Math.max(12,x)+'px';card.style.top=Math.max(12,y)+'px';
      }
    }
    $('tutorialStart').addEventListener('click',()=>enter(0));$('tutorialDismiss').addEventListener('click',finish);
    $('openTutorial').addEventListener('click',()=>{if(guide.active)finish();modal(true);$('tutorialStart').focus();});
    $('tutorialQuit').addEventListener('click',finish);
    $('tutorialNext').addEventListener('click',()=>{if(guide.active)enter(guide.index+1);});
    $('tutorialChapter').addEventListener('change',()=>enter(Number($('tutorialChapter').value)));
    const inLab=target=>!!target?.closest?.('#appHeader, #appMain');
    document.addEventListener('pointerdown',event=>{if(guide.active&&inLab(event.target)){pointers.add(event.pointerId);update();}},true);
    const releasePointer=event=>{if(pointers.delete(event.pointerId))update();};
    document.addEventListener('pointerup',releasePointer,true);document.addEventListener('pointercancel',releasePointer,true);
    const adjustmentKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown',' ','Enter']);
    document.addEventListener('keydown',event=>{
      if(guide.active&&inLab(event.target)&&adjustmentKeys.has(event.key)){keys.add(event.key);update();}
      if(event.key==='Escape'&&(guide.welcoming||guide.active)){event.preventDefault();finish();}
      if(event.key==='Tab'&&guide.welcoming){event.preventDefault();(document.activeElement===$('tutorialStart')?$('tutorialDismiss'):$('tutorialStart')).focus();}
    },true);
    document.addEventListener('keyup',event=>{if(keys.delete(event.key))update();},true);
    root.addEventListener?.('blur',()=>{pointers.clear();keys.clear();update();});
    root.addEventListener?.('resize',()=>{if(guide.active)position($(guide.target));});
    root.addEventListener?.('scroll',()=>{if(guide.active)position($(guide.target));},{passive:true});
    modal(true);$('tutorialStart').focus();
    return {update,get welcoming(){return guide.welcoming;},get snapshot(){return {active:guide.active,welcoming:guide.welcoming,index:guide.index,total:steps.length,title:steps[guide.index].title,target:guide.target,ready:guide.active&&ready(getState()),interacting:guide.active&&guide.interacting};}};
  }
  root.GasTutorial={create,steps};
})(typeof globalThis!=='undefined'?globalThis:window);
