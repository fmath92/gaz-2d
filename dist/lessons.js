/* Pedagogical scenes use immutable velocity snapshots or an exact collision ledger.
 * Display rearrangements never alter the physical particle state. */
(function(root){
  'use strict';
  const U=root.GasUnits, clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const f=(x,d=2)=>Number.isFinite(x)?x.toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
  function line(c,x,y,X,Y,color,width=1){c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function arrow(c,x,y,dx,dy,color){const a=Math.atan2(dy,dx);line(c,x,y,x+dx,y+dy,color,2);line(c,x+dx,y+dy,x+dx-5*Math.cos(a-.5),y+dy-5*Math.sin(a-.5),color,2);line(c,x+dx,y+dy,x+dx-5*Math.cos(a+.5),y+dy-5*Math.sin(a+.5),color,2);}
  function text(c,str,x,y,color='#294b5b',size=12){c.font=size+'px system-ui';c.fillStyle=color;c.textAlign='left';c.fillText(str,x,y);}
  class PressureWindow {
    constructor(sim,{cinematic=false,speed=1}={}){this.slowRate=.25;this.speed=speed;this.cinematic=cinematic;this.cameraTime=0;this.accumulator=0;this.kind='pressure';this.start=sim.time;this.duration=2;this.y0=sim.height*.25;this.y1=sim.height*.75;this.width=sim.width;this.lastId=sim._collisions;this.events=[];this.elapsed=0;this.paused=false;this.phase=cinematic?'overview':'collect';}
    collect(sim){
      for(const e of sim._events)if(e.id>this.lastId&&e.time>this.start&&e.time<=this.start+this.duration+1e-9&&e.wall==='right'&&e.y>=this.y0&&e.y<=this.y1)this.events.push({...e});
      this.lastId=sim._collisions;this.events.sort((a,b)=>a.time-b.time||a.id-b.id);
      this.elapsed=Math.min(this.duration,sim.time-this.start);if(this.elapsed>=this.duration-1e-9)this.phase='done';
    }
    get rate(){return this.paused||this.phase==='done'?0:this.phase==='overview'?(this.speed??1):this.phase==='zoom'?(this.speed??1)+(Math.min(this.slowRate,this.speed??1)-(this.speed??1))*this.zoom:Math.min(this.slowRate,this.speed??1);}
    get zoom(){return this.phase==='overview'?0:this.phase==='zoom'?ease(this.cameraTime/1.4):1;}
    tick(seconds,sim,advance,speed=1){
      if(this.paused||this.phase==='done')return;
      this.speed=speed;const phase=this.phase,rate=this.rate;
      this.accumulator=Math.min(.15,this.accumulator+seconds*rate);
      for(let i=0;i<24&&this.accumulator>=1/120&&this.phase!=='done';i++){
        const dt=phase==='collect'?Math.min(1/120,this.duration-this.elapsed):1/120;
        advance(dt);this.accumulator=Math.max(0,this.accumulator-dt);
        if(phase==='collect')this.collect(sim);
      }
      if(phase==='overview'||phase==='zoom'){
        this.cameraTime+=seconds;
        if(this.cameraTime>=(phase==='overview'?.8:1.4)){
          this.phase=phase==='overview'?'zoom':'collect';this.cameraTime=0;
          if(this.phase==='collect'){this.start=sim.time;this.lastId=sim._collisions;this.accumulator=0;}
        }
      }
    }
    get impulse(){return this.events.reduce((sum,e)=>sum+e.impulse,0);}
    get pressure(){return this.elapsed>1e-10?this.impulse/((this.y1-this.y0)*this.elapsed):null;}
    get surface(){return (this.y1-this.y0)*U.scales.length*U.scales.depth;}
  }
  class WorkWindow extends PressureWindow {
    constructor(sim,options={}){
      super(sim,options);this.kind='work-window';this.duration=1.5;this.slowRate=.4;
      this.height=sim.height;this.y0=0;this.y1=sim.height;this.captureStart(sim);
    }
    captureStart(sim){
      this.startWidth=this.currentWidth=sim.width;this.startEnergy=this.currentEnergy=sim.metrics.energy;
      this.velocity=sim.metrics.pistonVelocity;
    }
    collect(sim){super.collect(sim);this.currentWidth=sim.width;this.currentEnergy=sim.metrics.energy;}
    tick(seconds,sim,advance,speed=1){
      const before=this.phase;super.tick(seconds,sim,advance,speed);
      if(before==='zoom'&&this.phase==='collect')this.captureStart(sim);
    }
    get work(){return this.events.reduce((sum,e)=>sum+e.work,0);}
    get deltaVolume(){return (this.currentWidth-this.startWidth)*this.height;}
    get deltaEnergy(){return this.currentEnergy-this.startEnergy;}
    get pressureWork(){return -(this.pressure??0)*this.deltaVolume;}
    get bins(){
      const dt=this.duration/12,bins=[];
      for(let i=0;i<12&&i*dt<this.elapsed-1e-10;i++){
        const t0=i*dt,t1=Math.min(this.elapsed,(i+1)*dt);
        const impulse=this.events.filter(e=>e.time-this.start>(i===0?0:t0+1e-9)&&e.time-this.start<=t1+1e-9).reduce((sum,e)=>sum+e.impulse,0);
        const pressure=impulse/(this.height*(t1-t0));
        bins.push({pressure,v0:(this.startWidth+this.velocity*t0)*this.height,v1:(this.startWidth+this.velocity*t1)*this.height});
      }
      return bins;
    }
    get summary(){return {start:this.start,elapsed:this.elapsed,phase:this.phase,events:this.events.map(e=>({...e})),velocity:this.velocity,startVolume:this.startWidth*this.height,deltaVolume:this.deltaVolume,pressure:this.pressure,work:this.work,pressureWork:this.pressureWork,deltaEnergy:this.deltaEnergy,bins:this.bins};}
  }
  // Samples come from the real full-piston collision ledger. The connected
  // midpoint pressures form a continuous P(V) trace; its numerical area is an
  // approximation, kept distinct from the exact collision energy balance.
  class WorkPath {
    constructor(sim,{mode='compression',speed=1}={}){
      this.mode=mode;this.speed=speed;this.phase='overview';this.cameraTime=0;this.height=sim.height;
      this.startWidth=this.currentWidth=this.width=sim.width;this.startEnergy=this.currentEnergy=sim.metrics.energy;
      this.start=sim.time;this.elapsed=0;this.lastId=sim._collisions;this.events=[];this.samples=[];this.strokes=[];
      this.impulse=0;this.work=0;this.duration=2;this.shade=0;this.velocity=0;
      const travel=Math.min(3,mode==='compression'?sim.width-3:18-sim.width);
      this.endWidth=mode==='fixed'?sim.width:sim.width+(mode==='compression'?-travel:travel);
      this.minWidth=mode==='free'?Math.max(3,sim.width-2.5):Math.min(this.startWidth,this.endWidth);
      this.maxWidth=mode==='free'?Math.min(18,sim.width+2.5):Math.max(this.startWidth,this.endWidth);
      this.requestedWidth=sim.width;this.y0=sim.height*.3;this.y1=sim.height*.7;
    }
    get zoom(){return this.phase==='overview'?0:this.phase==='zoom'?ease(this.cameraTime/1.4):1;}
    get rate(){return ['overview','zoom','draw','fixed'].includes(this.phase)?Math.min(.75,this.speed):0;}
    get canDrag(){return this.phase==='draw'&&this.mode!=='fixed';}
    setTarget(width){
      if(!this.canDrag||!Number.isFinite(width))return;
      let lower=this.minWidth,upper=this.maxWidth;
      if(this.mode==='compression')upper=this.currentWidth;
      if(this.mode==='expansion')lower=this.currentWidth;
      this.requestedWidth=Math.max(lower,Math.min(upper,width));
    }
    get deltaVolume(){return (this.currentWidth-this.startWidth)*this.height;}
    get deltaEnergy(){return this.currentEnergy-this.startEnergy;}
    get pressure(){return this.elapsed>0?this.impulse/(this.height*this.elapsed):null;}
    get pressureWork(){return this.samples.reduce((sum,b)=>sum-b.pressure*(b.v1-b.v0),0);}
    get area(){return this.strokes.reduce((sum,stroke)=>sum+stroke.points.slice(1).reduce((a,p,i)=>a-(p.v-stroke.points[i].v)*(p.p+stroke.points[i].p)/2,0),0);}
    flush(){
      const b=this.pending;if(!b||b.dt<1e-10)return;
      const sample={v0:b.v0,v1:this.currentWidth*this.height,pressure:b.integral/(this.currentWidth*this.height-b.v0),dt:b.dt};
      this.samples.push(sample);
      const stroke=this.strokes.at(-1);
      if(stroke){
        stroke.bins.push(sample);
        const bins=stroke.bins,first=bins[0],last=bins.at(-1);
        // Average neighbouring measurement intervals to reduce collision noise.
        // Keep the actual path order, including reversals; never sort by volume.
        const middle=bins.map((x,i)=>{const nearby=bins.slice(Math.max(0,i-1),i+2);return {v:(x.v0+x.v1)/2,p:nearby.reduce((sum,b)=>sum+b.pressure*b.dt,0)/nearby.reduce((sum,b)=>sum+b.dt,0)};});
        stroke.points=[{v:first.v0,p:middle[0].p},...middle,{v:last.v1,p:middle.at(-1).p}];
      }
      this.pending=null;
    }
    closeStroke(){this.flush();if(this.strokes.length)this.strokes.at(-1).complete=true;this.direction=0;}
    advanceMeasured(dt,sim,advance){
      let remaining=dt;
      while(remaining>1e-10){
        const h=Math.min(1/120,remaining,sim.motion?sim.motion.duration-sim.motion.elapsed:Infinity);
        if(h<1e-10){sim.stopMotion();continue;}
        const v0=sim.width*this.height,u=sim.motion?(sim.motion.targetWidth-sim.motion.startWidth)/sim.motion.duration:0;
        const dir=Math.sign(u);
        if(dir!==this.direction){
          this.closeStroke();this.direction=dir;
          if(dir){
            const last=this.strokes.at(-1);
            if(last?.direction===dir)last.complete=false;
            else this.strokes.push({direction:dir,points:[],bins:[],complete:false});
          }
        }
        advance(h);remaining-=h;this.elapsed+=h;this.currentWidth=sim.width;this.currentEnergy=sim.metrics.energy;
        const fresh=sim._events.filter(e=>e.id>this.lastId&&e.wall==='right');this.lastId=sim._collisions;
        let impulse=0;
        for(const e of fresh){this.events.push({...e});impulse+=e.impulse;this.work+=e.work;}
        this.impulse+=impulse;
        if(dir){
          if(!this.pending)this.pending={v0,dt:0,impulse:0,integral:0};
          this.pending.dt+=h;this.pending.impulse+=impulse;this.pending.integral+=impulse*u;
          if(this.pending.dt>=.25-1e-10||!sim.motion)this.flush();
        }
      }
    }
    tick(seconds,sim,advance){
      if(this.phase==='done')return;
      if(['overview','zoom'].includes(this.phase)){
        advanceTime(seconds*this.rate,advance);this.cameraTime+=seconds;
        if(this.cameraTime>=(this.phase==='overview'?.6:1.4)){
          this.phase=this.phase==='overview'?'zoom':this.mode==='fixed'?'fixed':'draw';this.cameraTime=0;
          if(['fixed','draw'].includes(this.phase)){this.start=sim.time;this.startEnergy=this.currentEnergy=sim.metrics.energy;this.lastId=sim._collisions;}
        }
        return;
      }
      if(this.phase==='shade'){this.shade=clamp(this.shade+seconds/1.3);if(this.shade===1)this.phase='done';return;}
      if(this.phase==='draw'){
        const distance=this.requestedWidth-sim.width;
        if(Math.abs(distance)>1e-10){
          // Relax toward the pointer. Recompute the speed as the gap shrinks,
          // keeping the existing cap; the physics engine advances every segment.
          const duration=Math.abs(distance)<1e-5?Math.abs(distance)/.55:Math.max(.18,Math.abs(distance)/.55);
          sim.setMotion({targetWidth:this.requestedWidth,duration});
        }else if(sim.motion)sim.stopMotion();
      }
      this.velocity=sim.metrics.pistonVelocity;
      this.advanceMeasured(seconds*this.rate,sim,advance);this.velocity=sim.metrics.pistonVelocity;
      if(!sim.motion)this.closeStroke();
      if(this.phase==='fixed'&&this.elapsed>=this.duration || this.phase==='draw'&&this.mode!=='free'&&Math.abs(sim.width-this.endWidth)<1e-10){
        sim.stopMotion();this.closeStroke();this.phase='shade';
      }
    }
    get summary(){return {mode:this.mode,phase:this.phase,start:this.start,elapsed:this.elapsed,velocity:this.velocity,startVolume:this.startWidth*this.height,deltaVolume:this.deltaVolume,pressure:this.pressure,work:this.work,pressureWork:this.pressureWork,area:this.area,deltaEnergy:this.deltaEnergy,events:this.events.map(e=>({...e})),samples:this.samples.map(b=>({...b})),strokes:this.strokes.map(s=>({direction:s.direction,complete:s.complete,points:s.points.map(p=>({...p}))})),startWidth:this.startWidth,endWidth:this.endWidth,minWidth:this.minWidth,maxWidth:this.maxWidth,requestedWidth:this.requestedWidth,canDrag:this.canDrag};}
  }
  const workCases=['compression','expansion','fixed'];
  class WorkJourney {
    constructor(sim,{speed=1,reducedMotion=false,planningBudget=9}={}){
      this.kind='work';this.sim=sim;this.speed=speed;this.reducedMotion=reducedMotion;this.planningBudget=planningBudget;
      this.index=0;this.paused=false;this.elapsed=0;this.results=[];this.window=null;this.tour=null;this.collision=null;
      sim.stopMotion();
      if(sim.width<7){this.phase='prepare';sim.setMotion({targetWidth:11,duration:(11-sim.width)/.6});}
      else this.beginCase();
    }
    get case(){return workCases[this.index]??'free';}
    answerComparison(choice){
      if(this.phase!=='collision'||this.tour.phase!=='compare'||!['<','=','>'].includes(choice))return;
      const e=this.tour.event,incoming=Math.hypot(e.before.vx,e.before.vy),outgoing=Math.hypot(e.after.vx,e.after.vy);
      const relation=Math.abs(incoming-outgoing)<=1e-10*Math.max(1,incoming,outgoing)?'=':outgoing<incoming?'<':'>';
      this.answer={choice,relation,correct:choice===relation,incoming,outgoing};
    }
    continueComparison(){if(this.answer?.correct&&this.phase==='collision'&&this.tour.phase==='compare'){this.tour.continueComparison();this.paused=false;}}
    nextCase(){if(this.phase!=='hold')return;this.phase='between';this.elapsed=0;this.paused=false;}
    setPistonTarget(width){if(!this.paused&&['measure','free'].includes(this.phase))this.window.setTarget(width);}
    beginCase(){
      this.sim.stopMotion();this.elapsed=0;this.window=null;this.collision=null;this.answer=null;
      if(this.case==='free'){this.window=new WorkPath(this.sim,{mode:'free',speed:this.speed});this.phase='free';return;}
      if(this.case!=='fixed'){
        const direction=this.case==='compression'?-1:1;
        const travel=Math.min(2,direction<0?this.sim.width-3:18-this.sim.width);
        this.sim.setMotion({targetWidth:this.sim.width+direction*travel,duration:12});
      }
      this.phase='collision';this.tour=new root.CollisionTour(this.sim,{kind:this.case==='fixed'?'pressure':'work',speed:this.speed,reducedMotion:this.reducedMotion,manualComparison:true});
    }
    get zoom(){return this.phase==='collision'?this.tour.zoom:this.phase==='between'?1-ease(this.elapsed/1.4):this.window?.zoom??0;}
    get rate(){return this.paused?0:this.phase==='prepare'?this.speed:this.phase==='collision'?(this.tour.rate??0):['measure','free'].includes(this.phase)?this.window.rate:0;}
    get progress(){const p=this.phase==='collision'?.2:this.phase==='measure'?.65:.95;return this.phase==='prepare'?0:this.phase==='free'?1:(this.index+p)/3;}
    tick(seconds,sim,advance){
      if(this.paused||this.phase==='hold'||this.phase==='unavailable')return;
      if(this.phase==='prepare'){advanceTime(seconds*this.speed,advance);if(!sim.motion)this.beginCase();return;}
      if(this.phase==='collision'){
        this.tour.tick(seconds,advance,this.planningBudget);
        if(!this.tour.finished)return;
        if(this.tour.phase!=='done'){this.message=this.tour.message;this.phase='unavailable';sim.stopMotion();return;}
        this.collision=this.tour.events.at(-1);this.tour=null;sim.stopMotion();
        this.window=new WorkPath(sim,{mode:this.case,speed:this.speed});this.phase='measure';return;
      }
      if(['measure','free'].includes(this.phase)){
        this.window.tick(seconds,sim,advance);
        if(this.window.phase==='done'&&this.phase==='measure'){
          this.results.push({case:this.case,collision:{...this.collision},...this.window.summary});
          sim.stopMotion();this.elapsed=0;this.phase='hold';
        }
        return;
      }
      this.elapsed+=seconds;
      if(this.phase==='between'&&this.elapsed>=1.4){this.index++;this.beginCase();}
    }
    get summary(){return {kind:this.kind,phase:this.phase,case:this.case,index:this.index,zoom:this.zoom,rate:this.rate,progress:this.progress,collision:this.tour?.event??this.collision,collisionPhase:this.tour?.phase??null,answer:this.answer?{...this.answer}:null,window:this.window?.summary??null,results:this.results.map(r=>({...r})),message:this.message??''};}
  }
  class TemperatureSnapshot {
    constructor(sim){
      this.kind='temperature';this.time=sim.time;this.width=sim.width;this.height=sim.height;this.radius=sim.radius;this.elapsed=0;this.paused=false;
      this.particles=sim.particles.map(p=>({...p,speed:Math.hypot(p.vx,p.vy),energy:(p.vx*p.vx+p.vy*p.vy)/2}));
      const cx=sim.width/2,cy=sim.height/2;let half=.4,local=[];
      do{half+=.05;local=this.particles.filter(p=>Math.abs(p.x-cx)<=half&&Math.abs(p.y-cy)<=half);}while(local.length<12&&half<Math.min(sim.width,sim.height)/3);
      this.bounds={cx,cy,half};this.local=local;this.localIds=new Set(local.map(p=>p.id));
      this.energy=this.particles.reduce((s,p)=>s+p.energy,0);this.localEnergy=local.reduce((s,p)=>s+p.energy,0);
      this.temperature=this.energy/this.particles.length*U.scales.temperature;this.localTemperature=local.length?this.localEnergy/local.length*U.scales.temperature:null;
      this.maxSpeed=Math.max(...local.map(p=>p.speed),.001);this.maxEnergy=Math.max(...local.map(p=>p.energy),.001);
    }
    tick(seconds){if(!this.paused)this.elapsed=Math.min(18,this.elapsed+seconds);}
    get phase(){return this.elapsed<2?'zoom':this.elapsed<5?'vectors':this.elapsed<8?'align':this.elapsed<11?'energy':this.elapsed<15?'sum':this.elapsed<18?'global':'done';}
    get counted(){return Math.round(clamp((this.elapsed-11)/4)*this.local.length);}
    get partialEnergy(){return this.local.slice(0,this.counted).reduce((s,p)=>s+p.energy,0);}
  }
  // Time ramps advance the real simulator in bounded steps; they never scale velocities.
  function advanceTime(dt,advance){while(dt>1e-12){const h=Math.min(1/120,dt);advance(h);dt-=h;}}
  class TemperatureLesson extends TemperatureSnapshot {
    constructor(sim,{speed=1,playing=true}={}){super(sim);this.entry='slowdown';this.entryTime=0;this.startRate=playing?speed:0;}
    get phase(){return this.entry||super.phase;}
    get rate(){return !this.paused&&this.entry==='slowdown'?this.startRate*(1-ease(this.entryTime/1.6)):0;}
    get visual(){return {zoom:this.entry?0:ease(this.elapsed/2),selection:this.entry==='slowdown'?0:this.entry==='frame'?ease(this.entryTime):1,arrange:ease((this.elapsed-5)/3),energyMix:ease((this.elapsed-8)/3),opacity:1};}
    tick(seconds,sim,advance){
      if(this.paused)return;
      if(!this.entry){super.tick(seconds);return;}
      const phase=this.entry,duration=phase==='slowdown'?1.6:1,dt=Math.min(seconds,duration-this.entryTime),before=this.rate;
      this.entryTime+=dt;
      if(phase==='slowdown')advanceTime(dt*(before+this.rate)/2,advance);
      if(this.entryTime>=duration-1e-9){
        if(phase==='slowdown')Object.assign(this,new TemperatureSnapshot(sim));
        this.entry=phase==='slowdown'?'frame':null;this.entryTime=0;
      }
    }
  }
  class SimulationReturn {
    constructor({zoom=0,rate=0,speed=1,visual=null}={}){
      this.startZoom=zoom;this.startRate=rate;this.speed=speed;this.original=visual;
      this.phase=visual?.arrange>0?'restore':'zoomOut';this.elapsed=0;
    }
    get duration(){return this.phase==='restore'?1.1:this.phase==='zoomOut'?1.4:1.6;}
    get progress(){return ease(this.elapsed/this.duration);}
    get zoom(){return this.phase==='restore'?this.startZoom:this.phase==='zoomOut'?this.startZoom*(1-this.progress):0;}
    get rate(){return this.phase==='zoomOut'?this.startRate*(1-this.progress):this.phase==='resume'?this.speed*this.progress:0;}
    get visual(){const q=this.phase==='restore'?1-this.progress:0;return {...this.original,zoom:this.zoom,arrange:(this.original?.arrange??0)*q,energyMix:(this.original?.energyMix??0)*q,opacity:this.phase==='restore'?1:this.phase==='zoomOut'?1-this.progress:0,selection:(this.original?.selection??0)*(this.phase==='restore'?1:this.phase==='zoomOut'?1-this.progress:0)};}
    tick(seconds,advance){
      if(this.phase==='done')return;
      const dt=Math.min(seconds,this.duration-this.elapsed),before=this.rate;this.elapsed+=dt;
      advanceTime(dt*(before+this.rate)/2,advance);
      if(this.elapsed>=this.duration-1e-9){this.phase=this.phase==='restore'?'zoomOut':this.phase==='zoomOut'?'resume':'done';this.elapsed=0;}
    }
  }
  function pressureChamber(canvas,sim,story,options={}){
    // Reuse the normal simulation renderer: same particles, radii, colors and walls.
    root.LabGraphics.chamber(canvas,sim,{...options,region:{x:sim.width,y:(story.y0+story.y1)/2,y0:story.y0,y1:story.y1,zoom:options.zoom??story.zoom,opacity:options.opacity??1,events:story.events}});
  }
  function temperatureChamber(canvas,sim,story,options={}){
    const v=options.visual??story.visual,t=story.elapsed,b=story.bounds;
    const area={...b,zoom:v.zoom,selection:v.selection,opacity:1-v.arrange};
    root.LabGraphics.chamber(canvas,sim,{...options,vectors:false,area,particleOpacity:1-v.arrange});
    const c=canvas.getContext('2d'),{width:w,height:h}=canvas.getBoundingClientRect();if(!w||!h)return;
    const {X,Y}=root.LabGraphics.chamberCamera(w,h,sim,{area});
    const arrange=v.arrange,energyMix=v.energyMix;
    c.save();c.beginPath();c.rect(8,25,w-16,h-45);c.clip();
    if(t>=2){
      const cols=w<380?1:2,rows=Math.ceil(story.local.length/cols),rowH=Math.min(40,(h-75)/rows),cellW=(w-35)/cols,unit=Math.min(75,cellW-100)/story.maxSpeed;
      story.local.forEach((p,i)=>{
        const col=Math.floor(i/rows),row=i%rows,tx=30+col*cellW,ty=45+row*rowH;
        const a=arrange,x=X(p.x)+(tx-X(p.x))*a,y=Y(p.y)+(ty-Y(p.y))*a;
        // Rotating and translating the drawing preserves every original norm.
        const angle=Math.atan2(-p.vy,p.vx)*(1-a),len=p.speed*unit;
        c.globalAlpha=v.opacity*(1-energyMix);
        arrow(c,x,y,len*Math.cos(angle),len*Math.sin(angle),'#268985');
        c.globalAlpha=v.opacity*a;
        if(a>.01){text(c,String(i+1),x-22,y+3,'#82949d',9);text(c,f(p.speed*U.scales.velocity,0)+' m/s',x,y-7,'#278982',10);}
        c.globalAlpha=v.opacity*energyMix;
        if(energyMix>0){c.fillStyle='#d4974c';c.fillRect(x,y+3,p.energy/story.maxEnergy*Math.min(85,cellW-95),7);text(c,f(p.energy*U.scales.energy,3)+' J',x+Math.min(90,cellW-90),y+10,'#9b672e',9);}
      });
    }
    c.restore();c.globalAlpha=v.opacity;
    if(story.phase!=='slowdown')text(c,'Instant figé : t = '+U.text('time',story.time),18,17);
    if(t>=2)text(c,t<5?'Toutes les vitesses de la zone encadrée':t<8?'On déplace et oriente les dessins, sans changer les normes':t<15?'Même masse : Ec = ½ m |v|² pour chaque marqueur':'La même méthode s’applique aux 1 000 particules',18,h-7,'#687f8a',10);
    c.globalAlpha=1;
  }
  function workRegion(sim,story,options={}){
    const m=story.window;
    return {x:(m.minWidth+m.maxWidth)/2,y:sim.height/2,y0:m.y0,y1:m.y1,fit:true,minX:m.minWidth,maxX:m.maxWidth,
      zoom:options.zoom??story.zoom,events:m.events,opacity:options.opacity??1,
      work:{mode:m.mode,startWidth:m.startWidth,endWidth:m.endWidth,free:m.mode==='free',deltaVolume:m.deltaVolume,work:m.work,velocity:m.velocity}};
  }
  function workChamber(canvas,sim,story,options={}){
    const G=root.LabGraphics,zoom=options.zoom??story.zoom;
    if(story.tour){G.chamber(canvas,sim,{...options,tour:{...story.tour.view,zoom,compareIncoming:true}});return;}
    if(!story.window){G.chamber(canvas,sim,options);return;}
    G.chamber(canvas,sim,{...options,region:workRegion(sim,story,options)});
  }
  function workGraph(canvas,story){
    const surf=root.LabGraphics.setup(canvas);if(!surf)return;const{ctx:c,w,h}=surf,m=story.window,e=story.tour?.event??story.collision;
    const color=story.case==='compression'?'#c77e2f':story.case==='expansion'?'#337fba':'#268b80';
    if(story.tour?.phase==='compare'&&e){
      text(c,'Comparez les vitesses de la même particule',22,28,'#294b5b',13);
      text(c,'Vitesse sortante',22,65,'#258d79');
      text(c,U.text('velocity',Math.hypot(e.after.vx,e.after.vy)),22,95,'#258d79',24);
      text(c,'Vitesse entrante',22,133,'#397fbe');
      text(c,U.text('velocity',Math.hypot(e.before.vx,e.before.vy)),22,163,'#397fbe',24);
      text(c,story.answer?.correct?'δW reçu = Ec après − Ec avant = '+U.text('energy',e.work,4):'Même masse : Ec = ½ m |v|²',22,207,color,13);
      text(c,'Choisissez <, = ou > sur le bandeau du zoom.',22,246,'#687f8a',11);
      return;
    }
    if(!m){
      text(c,'Une poussée, avec ou sans déplacement.',22,28,'#294b5b',13);
      text(c,'Travail reçu par le gaz lors du choc :',22,70);
      text(c,'δW = −u × J',22,106,color,22);
      text(c,e?'J = '+U.text('momentum',e.impulse,5)+' ; u = '+U.text('velocity',e.wallVelocity):'J : impulsion transmise au piston ; u : sa vitesse.',22,143,'#687f8a',11);
      text(c,e?'δW = '+U.text('energy',e.work,4):'Suivez une particule jusqu’au contact.',22,177,color,18);
      text(c,story.case==='fixed'?'u = 0 : rebond, mais aucune énergie échangée.':story.case==='compression'?'Le piston avance : la particule gagne de l’énergie.':'Le piston recule : la particule cède de l’énergie.',22,220,'#687f8a',11);
      return;
    }
    const all=m.strokes.flatMap(s=>s.points),volume=m.startWidth*m.height;
    const prior=story.case==='fixed'?story.results?.[1]:null,reference=prior?.strokes?.flatMap(s=>s.points)??[];
    const minWidth=prior?.minWidth??m.minWidth,maxWidth=prior?.maxWidth??m.maxWidth;
    const span=Math.max(8,(maxWidth-minWidth)*m.height);
    const vMin=minWidth*m.height-.12*span,vMax=maxWidth*m.height+.12*span;
    const pMax=Math.max(1,m.pressure??0,...all.map(p=>p.p),...reference.map(p=>p.p))*1.18;
    const left=54,right=w-22,top=36,bottom=h-68,X=v=>left+(v-vMin)/(vMax-vMin)*(right-left),Y=p=>bottom-p/pMax*(bottom-top);
    text(c,'P (bar) · pression mesurée au piston',left,18,'#687f8a',11);
    line(c,left,top,left,bottom,'#9fb4be');line(c,left,bottom,right,bottom,'#9fb4be');
    for(let i=0;i<=3;i++){
      const p=i*pMax/3,y=Y(p);text(c,f(p*U.scales.pressure/1e5,2),5,y+4,'#687f8a',10);
      const v=vMin+(vMax-vMin)*i/3;text(c,f(v*U.scales.volume*1000,2),X(v)-15,bottom+18,'#687f8a',10);
    }
    if(story.case==='fixed'){
      if(reference.length){c.setLineDash([4,5]);c.beginPath();reference.forEach((p,i)=>i?c.lineTo(X(p.v),Y(p.p)):c.moveTo(X(p.v),Y(p.p)));c.strokeStyle='#bdcdd9';c.lineWidth=1.5;c.stroke();c.setLineDash([]);text(c,'Pointillés : détente précédente',left+10,bottom-12,'#82949d',10);}
      const p=m.pressure??0;line(c,X(volume),bottom,X(volume),Y(p),color,3);
      if(p>0){c.beginPath();c.arc(X(volume),Y(p),4,0,Math.PI*2);c.fillStyle=color;c.fill();}
      text(c,'A = B : ΔV = 0',left+10,top+22,color,14);
      text(c,'Aucune largeur, aucune aire.',left+10,top+43,'#687f8a',12);
    }else{
      for(const stroke of m.strokes){
        const points=stroke.points;if(points.length<2)continue;
        const tone=stroke.direction<0?'#c77e2f':'#337fba',shade=m.mode==='free'?1:m.shade;
        if(shade>0){
          c.beginPath();c.moveTo(X(points[0].v),bottom);
          for(const p of points)c.lineTo(X(p.v),bottom+(Y(p.p)-bottom)*shade);
          c.lineTo(X(points.at(-1).v),bottom);c.closePath();c.fillStyle=tone;c.globalAlpha=.2;c.fill();c.globalAlpha=1;
        }
        c.beginPath();points.forEach((p,i)=>i?c.lineTo(X(p.v),Y(p.p)):c.moveTo(X(p.v),Y(p.p)));c.strokeStyle=tone;c.lineWidth=2.5;c.stroke();
        const mid=Math.floor(points.length/2),p=points[mid],prev=points[Math.max(0,mid-1)];
        if(Math.abs(X(p.v)-X(prev.v))>8)arrow(c,X(prev.v),Y(prev.p),X(p.v)-X(prev.v),Y(p.p)-Y(prev.p),tone);
      }
      if(!all.length)text(c,'Déplacez le piston : la courbe se dessine ici.',left+8,top+45,'#687f8a',11);
    }
    text(c,'V (L)',right-28,bottom+38,'#687f8a',11);
    text(c,story.case==='fixed'?'W reçu = 0 J':'W reçu ≈ −∫ P dV = '+U.text('energy',m.area,2),left,h-7,color,14);
  }
  function pressureGraph(canvas,s){
    const surf=root.LabGraphics.setup(canvas);if(!surf)return;const{ctx:c,w,h}=surf;const left=35,right=w-18,X=t=>left+(t-s.start)/s.duration*(right-left),max=Math.max(1,...s.events.map(e=>e.impulse));
    text(c,'Les poussées s’additionnent sur Δt',left,18);line(c,left,90,right,90,'#b9cbd0');
    for(const e of s.events)line(c,X(e.time),90,X(e.time),90-55*e.impulse/max,'#d28b38',3);
    text(c,'Chaque trait : une impulsion Jᵢ',left,108,'#687f8a',10);
    let sum=0,prev=left;const total=Math.max(s.impulse,1),Y=v=>h-45-v/total*(h-180);
    for(const e of s.events){const x=X(e.time);line(c,prev,Y(sum),x,Y(sum),'#248b7c',2);const old=sum;sum+=e.impulse;line(c,x,Y(old),x,Y(sum),'#248b7c',2);prev=x;}
    line(c,prev,Y(sum),X(s.start+s.elapsed),Y(sum),'#248b7c',2);
    text(c,'ΣJᵢ = '+U.text('momentum',s.impulse,5),left,138,'#248b7c');
    text(c,'0',left,h-15,'#687f8a',10);text(c,U.text('time',s.duration,3),right-65,h-15,'#687f8a',10);
    line(c,X(s.start+s.elapsed),30,X(s.start+s.elapsed),h-35,'#b2c5cc');
  }
  function temperatureGraph(canvas,s){
    const surf=root.LabGraphics.setup(canvas);if(!surf)return;const{ctx:c,w,h}=surf;let x=25;const counted=s.counted,total=s.localEnergy;
    if(s.elapsed<8){
      text(c,s.elapsed<5?'Un instant, toutes les vitesses de la zone':'Les normes ne dépendent pas du sens',25,25);
      text(c,s.local.length+' particules observées, sans échantillonnage des vitesses.',25,60,'#687f8a',11);
      text(c,'|vᵢ| = √(vx,ᵢ² + vy,ᵢ²)',25,110,'#248b7c',20);
      text(c,'On conserve la longueur de chaque flèche.',25,151);
      text(c,'La direction sera inutile pour calculer Ec.',25,175);
      return;
    }
    text(c,'La somme des énergies dans la zone',25,22);
    for(let i=0;i<counted;i++){const width=(w-50)*s.local[i].energy/Math.max(total,1e-9);c.fillStyle=i%2?'#e4b46f':'#cc8a3b';c.fillRect(x,45,width,30);x+=width;}
    text(c,counted+' / '+s.local.length+' énergies additionnées',25,98,'#687f8a');
    text(c,'Σ Ec,zone = '+U.text('energy',s.partialEnergy,3),25,125,'#a56f30',15);
    if(s.elapsed>=15){
      text(c,'La zone illustre la méthode.',25,160);text(c,'Le thermomètre utilise les '+s.particles.length+' particules.',25,181);
      text(c,'E totale = '+U.text('energy',s.energy,3),25,212,'#248b7c',16);
      text(c,'T = E totale / (nR) = '+f(s.temperature)+' K',25,241,'#248b7c',16);
    }else text(c,'Puis on fait la même somme sur tout le gaz.',25,165,'#687f8a');
  }
  root.GasLessons={PressureWindow,WorkWindow,WorkPath,WorkJourney,workRegion,workChamber,workGraph,TemperatureSnapshot,TemperatureLesson,SimulationReturn,pressureChamber,temperatureChamber,pressureGraph,temperatureGraph};
})(typeof globalThis!=='undefined'?globalThis:window);
