import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('../dist/units.js');require('../dist/graphics.js');

test('explicit PVT reference ticks draw both labels and horizontal grid lines at their values',()=>{
 const labels=[],segments=[];let pen;
 const ctx=new Proxy({fillText:(text,x,y)=>labels.push({text,x,y}),moveTo:(x,y)=>{pen={x,y};},lineTo:(x,y)=>segments.push({from:pen,to:{x,y}})}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={getBoundingClientRect:()=>({width:600,height:300}),getContext:()=>ctx};
 globalThis.LabGraphics.plot(canvas,{series:[],xRange:[0,1],yRange:[0,2.2],yTicks:[0,.5,1,1.5,2],xLabel:'t',yLabel:'Rapports'});
 for(const [value,label] of [[.5,'0,5'],[1,'1,0'],[2,'2,0']]){
  const y=271-value/2.2*249;
  assert.ok(labels.some(l=>l.text===label&&Math.abs(l.y-y-3)<1e-9));
  assert.ok(segments.some(s=>s.from.x===49&&s.to.x===580&&Math.abs(s.from.y-y)<1e-9&&s.to.y===s.from.y));
 }
});
