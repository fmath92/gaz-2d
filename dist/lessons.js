/* Pedagogical scenes use immutable velocity snapshots or an exact collision ledger.
 * Display rearrangements never alter the physical particle state. */
(function(root){
  'use strict';
  const U=root.GasUnits, clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const f=(x,d=2)=>Number.isFinite(x)?x.toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
  function line(c,x,y,X,Y,color,width=1){c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function arrow(c,x,y,dx,dy,color){const a=Math.atan2(dy,dx);line(c,x,y,x+dx,y+dy,color,2);line(c,x+dx,y+dy,x+dx-5*Math.cos(a-.5),y+dy-5*Math.sin(a-.5),color,2);line(c,x+dx,y+dy,x+dx-5*Math.cos(a+.5),y+dy-5*Math.sin(a+.5),color,2);}
  function text(c,str,x,y,color='#294b5b',size=12){c.font=size+'px system-ui';c.fillStyle=color;c.textAlign='left';c.fillText(str,x,y);}
  function dot(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
  class PressureWindow {
    constructor(sim,{cinematic=false}={}){this.cinematic=cinematic;this.cameraTime=0;this.accumulator=0;this.kind='pressure';this.start=sim.time;this.duration=2;this.y0=sim.height*.25;this.y1=sim.height*.75;this.width=sim.width;this.lastId=sim._collisions;this.events=[];this.elapsed=0;this.paused=false;this.phase=cinematic?'overview':'collect';}
    collect(sim){
      for(const e of sim._events)if(e.id>this.lastId&&e.time>this.start&&e.time<=this.start+this.duration+1e-9&&e.wall==='right'&&e.y>=this.y0&&e.y<=this.y1)this.events.push({...e});
      this.lastId=sim._collisions;this.events.sort((a,b)=>a.time-b.time||a.id-b.id);
      this.elapsed=Math.min(this.duration,sim.time-this.start);if(this.elapsed>=this.duration-1e-9)this.phase='done';
    }
    get zoom(){return this.phase==='overview'?0:this.phase==='zoom'?ease(this.cameraTime/1.4):1;}
    tick(seconds,sim,advance,speed=1){
      if(this.paused||this.phase==='done')return;
      const phase=this.phase;
      const rate=phase==='overview'?speed:phase==='zoom'?speed+(Math.min(.25,speed)-speed)*this.zoom:Math.min(.25,speed);
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
  function pressureChamber(canvas,sim,story,options={}){
    // Reuse the normal simulation renderer: same particles, radii, colors and walls.
    root.LabGraphics.chamber(canvas,sim,{...options,region:{x:sim.width,y:(story.y0+story.y1)/2,y0:story.y0,y1:story.y1,zoom:story.zoom,events:story.events}});
  }
  function temperatureChamber(canvas,story){
    const surf=root.LabGraphics.setup(canvas);if(!surf)return;const{ctx:c,w,h}=surf;
    const t=story.elapsed,b=story.bounds,returning=clamp((t-15)/3),zoom=ease(t/2)*(1-ease(returning));
    const scale0=Math.min((w-45)/story.width,(h-60)/story.height),scale1=Math.min((w-95)/(2*b.half),(h-95)/(2*b.half)),scale=scale0+(scale1-scale0)*zoom;
    const X=x=>w/2+(x-b.cx)*scale,Y=y=>h/2-(y-b.cy)*scale;
    const arrange=ease((t-5)/3),energyMix=ease((t-8)/3),vanish=1-ease(returning);
    c.save();c.beginPath();c.rect(8,25,w-16,h-45);c.clip();
    if(t<8||t>=15){
      line(c,X(0),Y(0),X(story.width),Y(0),'#9db1b9',2);line(c,X(story.width),Y(0),X(story.width),Y(story.height),'#9db1b9',4);line(c,X(0),Y(story.height),X(story.width),Y(story.height),'#9db1b9',2);line(c,X(0),Y(0),X(0),Y(story.height),'#9db1b9',2);
      for(const p of story.particles){c.globalAlpha=t<8?1-arrange*.9:1;dot(c,X(p.x),Y(p.y),Math.max(1.5,story.radius*scale),story.localIds.has(p.id)?'#cb8a37':'#83b6c0');}c.globalAlpha=1;
      c.setLineDash([5,4]);c.strokeStyle='#cb8a37';c.strokeRect(X(b.cx-b.half),Y(b.cy+b.half),2*b.half*scale,2*b.half*scale);c.setLineDash([]);
    }
    if(t>=2&&t<18){
      const cols=w<380?1:2,rows=Math.ceil(story.local.length/cols),rowH=Math.min(40,(h-75)/rows),cellW=(w-35)/cols,unit=Math.min(75,cellW-100)/story.maxSpeed;
      story.local.forEach((p,i)=>{
        const col=Math.floor(i/rows),row=i%rows,tx=30+col*cellW,ty=45+row*rowH;
        const a=arrange*(1-ease(returning)),x=X(p.x)+(tx-X(p.x))*a,y=Y(p.y)+(ty-Y(p.y))*a;
        // Rotating and translating the drawing preserves every original norm.
        const angle=Math.atan2(-p.vy,p.vx)*(1-a),len=p.speed*unit;
        c.globalAlpha=vanish;
        if(energyMix<1)arrow(c,x,y,len*Math.cos(angle),len*Math.sin(angle),'#268985');
        if(a>.9){text(c,String(i+1),x-22,y+3,'#82949d',9);text(c,f(p.speed*U.scales.velocity,0)+' m/s',x,y-7,'#278982',10);}
        if(energyMix>0){c.fillStyle='#d4974c';c.fillRect(tx,ty+3,energyMix*p.energy/story.maxEnergy*Math.min(85,cellW-95),7);text(c,f(p.energy*U.scales.energy,3)+' J',tx+Math.min(90,cellW-90),ty+10,'#9b672e',9);}
      });c.globalAlpha=1;
    }
    c.restore();text(c,'Instant figé : t = '+U.text('time',story.time),18,17);
    text(c,t<5?'Toutes les vitesses de la zone encadrée':t<8?'On déplace et oriente les dessins, sans changer les normes':t<15?'Même masse : Ec = ½ m |v|² pour chaque marqueur':'Retour aux '+story.particles.length+' particules du système',18,h-7,'#687f8a',10);
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
  root.GasLessons={PressureWindow,TemperatureSnapshot,pressureChamber,temperatureChamber,pressureGraph,temperatureGraph};
})(typeof globalThis!=='undefined'?globalThis:window);
