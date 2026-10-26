import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GasSimulation}=require('../dist/physics.js');
const output=new URL('../data/radius-study-raw.json',import.meta.url);
const protocol={count:1000,width:11,height:7.5,temperature:1.5,window:20,minimumWarmup:60,minimumBlocks:8,maximumBlocks:16,targetSEM:.0015,seeds:[314159,271828],radii:Array.from({length:26},(_,i)=>.005+.065*i/25)};
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const se=a=>Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length*(a.length-1)));
if(!isMainThread){
 const {radius,seed}=workerData;
 const s=new GasSimulation({count:protocol.count,width:protocol.width,height:protocol.height,temperature:protocol.temperature,measurementWindow:protocol.window,particleModel:'hard-disks',particleRadius:radius,seed});
 const blocks=[],equilibration=[];
 function block(){
  const before=s.metrics,anisotropy=[],occupancy=[0,0,0,0];
  for(let i=0;i<200;i++){s.step(.1);if(i%10===9){const m=s.metrics;anisotropy.push((m.temperatureX-m.temperatureY)/m.temperature);for(const p of s.particles)occupancy[(p.x>s.width/2?1:0)+(p.y>s.height/2?2:0)]++;}}
  const m=s.metrics;
  return {start:before.time,end:m.time,ratio:m.pressure*m.volume/(m.count*m.temperature),pressure:m.pressure,temperature:m.temperature,anisotropy:mean(anisotropy),occupancy:occupancy.map(n=>n/20000),pairCollisions:m.pairCollisions-before.pairCollisions,wallCollisions:m.collisions-before.collisions,relativeEnergyError:Math.abs(m.balanceError)/s.initialEnergy,meanFreePath:m.windowMeanFreePath,meanCollisionTime:m.windowMeanCollisionTime,completedFlights:m.windowCompletedFlights};
 }
 let stable=false;
 while(s.time<400&&!stable){
  equilibration.push(block());const last=equilibration.slice(-3);
  if(last.length===3&&s.time>=protocol.minimumWarmup-1e-6){const ps=last.map(b=>b.ratio);stable=(Math.max(...ps)-Math.min(...ps))/mean(ps)<.02&&Math.abs(mean(last.map(b=>b.anisotropy)))<.03&&[0,1,2,3].every(i=>Math.abs(mean(last.map(b=>b.occupancy[i]))-.25)<.02);}
 }
 if(!stable)throw new Error('Equilibration failed '+JSON.stringify(workerData));
 while(blocks.length<protocol.maximumBlocks){blocks.push(block());if(blocks.length>=protocol.minimumBlocks&&se(blocks.map(b=>b.ratio))<protocol.targetSEM)break;}
 parentPort.postMessage({radius,seed,equilibratedAt:blocks[0].start,equilibration,blocks,ratio:mean(blocks.map(b=>b.ratio)),sem:se(blocks.map(b=>b.ratio)),maxEnergyError:Math.max(...blocks.map(b=>b.relativeEnergyError))});
}else{
 const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output)):null;
 if(previous&&JSON.stringify(previous.protocol)!==JSON.stringify(protocol))throw new Error('Existing protocol differs; choose a new output file.');
 const results=previous?.results??[];
 const jobs=protocol.radii.flatMap(radius=>protocol.seeds.map(seed=>({radius,seed}))).filter(j=>!results.some(r=>r.radius===j.radius&&r.seed===j.seed));
 const save=()=>fs.writeFileSync(output,JSON.stringify({protocol,results},null,2));
 async function worker(){while(jobs.length){const job=jobs.shift();const r=await new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:job});w.once('message',resolve);w.once('error',reject);w.once('exit',code=>{if(code)reject(new Error('Worker exit '+code));});});results.push(r);save();console.log(JSON.stringify({completed:results.length,total:52,radius:r.radius,seed:r.seed,Z:r.ratio,SEM:r.sem,blocks:r.blocks.length,warmup:r.equilibratedAt}));}}
 await Promise.all(Array.from({length:4},worker));
}
