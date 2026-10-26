(function (root) {
  'use strict';
  const U = root.GasUnits;
  const format = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
  function dataRange(values, fallback, zero = false) {
    let min = Infinity, max = -Infinity;
    for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
    if (!Number.isFinite(min)) [min, max] = fallback;
    const span = max - min || Math.max(Math.abs(max) * 0.2, 0.2);
    return [zero ? 0 : min - span * 0.08, max + span * 0.08];
  }
  function plotAxes(ctx, w, h, xr, yr, xLabel, yLabel, yTicks) {
    const left = 49, right = w - 20, top = 22, bottom = h - 29;
    const X = x => left + (x - xr[0]) / (xr[1] - xr[0]) * (right - left);
    const Y = y => bottom - (y - yr[0]) / (yr[1] - yr[0]) * (bottom - top);
    const tick = (value, span) => Math.abs(value) >= 10000 ? value.toExponential(1) : format(value, span < 1 ? Math.min(6, Math.max(2, Math.ceil(-Math.log10(span)) + 1)) : span < 8 ? 1 : 0);
    ctx.font = '9px system-ui, sans-serif';
    for (const value of yTicks??Array.from({length:5},(_,i)=>yr[0]+(yr[1]-yr[0])*i/4)) {
      if(value<yr[0]||value>yr[1])continue;
      line(ctx, left, Y(value), right, Y(value), '#eaf0f2');
      ctx.textAlign = 'right'; ctx.fillStyle = '#82949f'; ctx.fillText(tick(value, yr[1] - yr[0]), left - 7, Y(value) + 3);
    }
    for (let i = 0; i <= 5; i++) {
      const value = xr[0] + (xr[1] - xr[0]) * i / 5;
      ctx.textAlign = 'center'; ctx.fillStyle = '#82949f'; ctx.fillText(tick(value, xr[1] - xr[0]), X(value), h - 10);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#637c8d'; ctx.fillText(yLabel, left, 11);
    ctx.textAlign = 'right'; ctx.fillText(xLabel, right, 11);
    return { X, Y, left, right, top, bottom };
  }
  function plotLine(ctx, axes, points, color, { dashed = false, scatter = false, radius = 1.7, lineWidth = 1.7, arrows = false } = {}) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lineWidth;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath(); let pen = false;
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { pen = false; continue; }
      const x = axes.X(p.x), y = axes.Y(p.y);
      if (scatter) { ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, 2 * Math.PI); }
      else if (pen) ctx.lineTo(x, y);
      else { ctx.moveTo(x, y); pen = true; }
    }
    if (scatter) {
      ctx.fill();
      for(const p of points)if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.yError)&&p.yError>0){
        const x=axes.X(p.x),lo=axes.Y(p.y-p.yError),hi=axes.Y(p.y+p.yError);
        line(ctx,x,lo,x,hi,color,1);line(ctx,x-3,lo,x+3,lo,color,1);line(ctx,x-3,hi,x+3,hi,color,1);
      }
    } else ctx.stroke();
    ctx.setLineDash([]);
    if (arrows && points.length > 3) {
      for (let i = Math.max(1, Math.floor(points.length / 5)); i < points.length; i += Math.max(1, Math.floor(points.length / 4))) {
        const a = points[i - 1], b = points[i];
        if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
        let from = i - 1;
        while (from > 0 && Math.hypot(axes.X(b.x) - axes.X(points[from].x), axes.Y(b.y) - axes.Y(points[from].y)) < 9) from--;
        const p = points[from];
        if (![p.x, p.y].every(Number.isFinite)) continue;
        const x = axes.X(b.x), y = axes.Y(b.y), angle = Math.atan2(y - axes.Y(p.y), x - axes.X(p.x));
        line(ctx, x, y, x - 5 * Math.cos(angle - 0.5), y - 5 * Math.sin(angle - 0.5), color, 1.4);
        line(ctx, x, y, x - 5 * Math.cos(angle + 0.5), y - 5 * Math.sin(angle + 0.5), color, 1.4);
      }
    }
  }
  function setup(canvas) {
    const { width: w, height: h } = canvas.getBoundingClientRect();
    if (!w || !h) return null;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function arrow(ctx, x, y, dx, dy, color, width = 2) {
    if (Math.hypot(dx, dy) < 0.1) return;
    const angle = Math.atan2(dy, dx), endX = x + dx, endY = y + dy;
    line(ctx, x, y, endX, endY, color, width);
    line(ctx, endX, endY, endX - 6 * Math.cos(angle - 0.5), endY - 6 * Math.sin(angle - 0.5), color, width);
    line(ctx, endX, endY, endX - 6 * Math.cos(angle + 0.5), endY - 6 * Math.sin(angle + 0.5), color, width);
  }
  function circle(ctx, x, y, radius, color) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  const palette = ['#397bd1', '#479ac3', '#4caaa6', '#81b78a', '#c4b767', '#db9852', '#d76f47'];
  function chamberCamera(w, h, sim, { maxWidth = 18, tour = null, region = null, area = null } = {}) {
    const baseScale = Math.min((w - 58) / maxWidth, (h - 54) / sim.height);
    const ox = 26, oy = (h - sim.height * baseScale) / 2 + 3;
    const q = tour?.zoom ?? region?.zoom ?? area?.zoom ?? 0, hit = tour?.target || (region ? {x:region.x,y:region.y,wall:'right',radius:0,particleId:null} : null);
    let magnification = Math.max(1, Math.min(12, (h - 70) / (baseScale * 1.4)));
    if(region)magnification=Math.max(1,(h-70)/(baseScale*(region.y1-region.y0+1)));
    if(region?.fit)magnification=Math.max(1,Math.min((h-100)/(baseScale*(region.y1-region.y0)),(w-110)/(baseScale*(region.maxX-region.minX+1.2))));
    if(area)magnification=Math.max(1,Math.min((w-100)/(2*area.half*baseScale),(h-100)/(2*area.half*baseScale)));
    // Fixed laboratory location chosen once, never the current piston position.
    const cameraX = hit ? hit.x + (hit.wall === 'right' ? hit.radius : -hit.radius) : area?.cx??0;
    const cameraY = hit?.y ?? area?.cy ?? 0;
    if (hit && tour?.kind === 'work') {
      const travel = Math.abs(cameraX-tour.startWidth);
      const room = cameraX < tour.startWidth ? .28*w-55 : .72*w-55;
      if (travel>0) magnification = Math.max(1,Math.min(magnification,room/(travel*baseScale)));
    }
    const zoom = 1 + q * (magnification - 1), scale = baseScale * zoom;
    const anchorX = ox + cameraX * baseScale, anchorY = oy + (sim.height - cameraY) * baseScale;
    const tx = q * ((area||region?.fit ? .5 : hit?.wall === 'left' ? .28 : .72) * w - anchorX) + (1 - zoom) * anchorX;
    const ty = q * (h * (region?.fit ? .46 : .51) - anchorY) + (1 - zoom) * anchorY;
    return { q, hit, zoom, scale,
      X: x => (ox + x * baseScale) * zoom + tx,
      Y: y => (oy + (sim.height - y) * baseScale) * zoom + ty };
  }
  function impulseVector(event) {
    // Same reduced mass (=1) and scale as the two momentum arrows.
    return { vx:event.before.vx-event.after.vx, vy:event.before.vy-event.after.vy };
  }
  function stationaryReflection(event) {
    const vx=-event.before.vx, vy=event.before.vy;
    return { vx, vy, speed:Math.hypot(vx,vy), energy:.5*(vx*vx+vy*vy) };
  }
  function chamber(canvas, sim, { initialTemperature = 1.5, vectors = false, focus = null, maxWidth = 18, target = null, tour = null, region = null, area = null, particleOpacity = 1 } = {}) {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    const { q, hit, zoom, scale, X, Y } = chamberCamera(w,h,sim,{maxWidth,tour,region,area});
    const left = X(0), right = X(sim.width), top = Y(sim.height), bottom = Y(0), end = X(maxWidth);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#edf4f9'; ctx.fillRect(left, top, right - left, bottom - top);
    for (let x = 20; x < w; x += 20) for (let y = 16; y < h; y += 20) { ctx.fillStyle = '#dce7ed'; ctx.fillRect(x, y, 1, 1); }
    ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0,left), Math.max(0,top), Math.min(w,right)-Math.max(0,left), Math.min(h,bottom)-Math.max(0,top)); ctx.clip();
    for (const p of sim.particles) {
      const x = X(p.x), y = Y(p.y), selected = hit?.particleId === p.id;
      if (x < -20 || x > w+20 || y < -20 || y > h+20) continue;
      const color = palette[Math.min(6, Math.floor(Math.hypot(p.vx, p.vy) / Math.sqrt(2 * initialTemperature) * 3))];
      ctx.globalAlpha = particleOpacity*(q && !selected && !region && !area ? 1 - q * .7 : 1);
      if (vectors || selected) line(ctx, x, y, x + p.vx * scale * .06, y - p.vy * scale * .06, color + '80');
      circle(ctx, x, y, (sim.radius || .04) * scale, selected ? '#247f91' : color);
      if (selected) { ctx.strokeStyle = '#dc9a3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x,y,(sim.radius || .04)*scale+4,0,2*Math.PI); ctx.stroke(); }
    }
    ctx.restore(); ctx.globalAlpha = 1;
    const wallColor = wall => sim.thermal.mode === 'thermostat' && sim.thermal.walls.includes(wall) && (wall !== 'right' || sim.thermal.pistonThermal) ? '#cf914e' : '#8da3b2';
    const pistonThickness = 8 + 38 * q;
    ctx.fillStyle = '#b7c9d4'; ctx.fillRect(right, top, pistonThickness, bottom-top);
    ctx.fillStyle = '#dae5eb'; ctx.fillRect(right+pistonThickness*.65, top, pistonThickness*.35, bottom-top);
    line(ctx,left,top,end,top,wallColor('top'),3); line(ctx,left,bottom,end,bottom,wallColor('bottom'),3);
    line(ctx,left,top,left,bottom,wallColor('left'),6); line(ctx,right,top,right,bottom,wallColor('right'),8);
    line(ctx,right,(top+bottom)/2,end+12,(top+bottom)/2,'#a9b9c2',5);
    if (target && q < .1 && Math.abs(target-sim.width)>.01) { ctx.setLineDash([4,5]); line(ctx,X(target),top,X(target),bottom,'#95b4c077',1); ctx.setLineDash([]); }
    ctx.font='10px system-ui'; ctx.fillStyle='#617b8d';ctx.textAlign='left';
    if (q < .1) {
      ctx.fillText(sim.thermal.mode==='thermostat' ? 'THERMOSTAT' : 'ISOLÉE',left,top-10);
      ctx.textAlign='center';ctx.fillText('PISTON',right,top-10);ctx.fillText('V = '+U.text('volume', sim.width*sim.height),(left+right)/2,bottom+19);
    }
    if (focus && !tour) {
      const p = focus.kind==='pair' ? focus.before[0] : focus;
      ctx.strokeStyle='#dd9c36';ctx.setLineDash([3,3]);ctx.strokeRect(X(p.x)-8,Y(p.y)-8,16,16);ctx.setLineDash([]);
    }
    if(area){
      if(area.selection>0){
        const x=X(area.cx-area.half),y=Y(area.cy+area.half),side=2*area.half*scale;
        ctx.globalAlpha=area.opacity??1;ctx.strokeStyle='#cb8a37';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);
        let remaining=4*side*area.selection;const corners=[[x+side,y],[x+side,y+side],[x,y+side],[x,y]];let px=x,py=y;
        for(const [nx,ny] of corners){const f=Math.min(1,remaining/side);ctx.lineTo(px+(nx-px)*f,py+(ny-py)*f);remaining-=side;if(remaining<=0)break;px=nx;py=ny;}
        ctx.stroke();ctx.globalAlpha=1;
      }
      return;
    }
    if(region){
      ctx.save();ctx.globalAlpha=region.opacity??1;
      if(region.work){
        const m=region.work,origin=X(m.startWidth),color=m.mode==='compression'||m.velocity<0?'#c77e2f':m.mode==='expansion'||m.velocity>0?'#337fba':'#268b80';
        ctx.globalAlpha=.18*(region.opacity??1);ctx.fillStyle=color;ctx.fillRect(Math.min(origin,right),Math.max(0,top),Math.abs(right-origin),Math.min(h,bottom)-Math.max(0,top));
        ctx.globalAlpha=region.opacity??1;ctx.setLineDash([4,4]);line(ctx,origin,40,origin,h-46,color,1.5);ctx.setLineDash([]);
        arrow(ctx,origin,h-78,right-origin,0,color,3);
        ctx.font='bold 12px system-ui';ctx.fillStyle=color;ctx.textAlign='center';
        ctx.fillText('A',origin,57);
        if(!m.free&&Math.abs(m.endWidth-m.startWidth)>.01){ctx.setLineDash([3,5]);line(ctx,X(m.endWidth),65,X(m.endWidth),h-95,color,1);ctx.setLineDash([]);ctx.fillText('B',X(m.endWidth),57);}

        ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillStyle=color;
        ctx.fillText('u = '+U.text('velocity',m.velocity)+' · ΔV = '+U.text('volume',m.deltaVolume,3),14,36);
      }
      line(ctx,right,Y(region.y0),right,Y(region.y1),'#d18b35',6);
      for(const e of region.events){
        const age=sim.time-e.time;if(age<0||age>.2)continue;
        ctx.globalAlpha=(region.opacity??1)*(1-age/.2);
        arrow(ctx,right,Y(e.y),Math.min(75,e.impulse*14),0,'#ce8b37',2.5);
        ctx.save();ctx.beginPath();ctx.rect(right,0,pistonThickness,h);ctx.clip();
        ctx.beginPath();ctx.arc(right,Y(e.y),3+age*200,0,2*Math.PI);ctx.strokeStyle='#d18b35';ctx.stroke();ctx.restore();
      }
      ctx.globalAlpha=region.opacity??1;ctx.textAlign='left';ctx.font='10px system-ui';ctx.fillStyle='#617b8d';
      ctx.fillText(region.work?'DU CHOC AU DÉPLACEMENT DU PISTON':'MÊME SIMULATION · SURFACE S EN ORANGE',14,19);
      if(q>.5)ctx.fillText(region.work?'Travail reçu par le gaz : '+U.text('energy',region.work.work,3):'Couleur = vitesse · chocs réellement reçus sur cette surface',14,h-12);
      ctx.restore();return;
    }
    if (!hit || q < .2) return;
    const particle=sim.particles.find(p=>p.id===hit.particleId), e=tour.event;
    ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillStyle='#476575';
    ctx.fillText('PARTICULE '+(hit.particleId+1)+' · ZOOM ×'+format(zoom,1),14,19);
    ctx.textAlign='right';ctx.fillText('Référentiel du laboratoire',w-14,19);
    if (tour.kind === 'work') {
      const origin=X(tour.startWidth), u=sim.metrics.pistonVelocity;
      ctx.setLineDash([4,4]); line(ctx,origin,48,origin,h-62,'#7f939e',1.2); ctx.setLineDash([]);
      ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillStyle='#617987';
      ctx.fillText('Position initiale · repère fixe',14,38);
      arrow(ctx,right,60,Math.sign(u)*37,0,'#647f91',2);
      ctx.textAlign='right';ctx.fillText('u = '+U.text('velocity', u)+' · Δx = '+U.text('length', sim.width-tour.startWidth),w-14,38);
      // A laboratory ruler makes the wall translation readable before impact.
      for(let x=Math.floor((tour.startWidth-3)*5)/5;x<tour.startWidth+3;x+=.2) {
        const px=X(x);if(px<8||px>w-8)continue;
        line(ctx,px,h-60,px,h-55,'#91a6b4',1);
      }
    }
    if (!e && particle) {
      const x=X(particle.x),y=Y(particle.y),v=Math.hypot(particle.vx,particle.vy);
      const f=Math.min(60,h*.20)/Math.max(v,.1);
      arrow(ctx,x,y,particle.vx*f,-particle.vy*f,'#337db5',2);
      ctx.fillStyle='#337db5';ctx.textAlign='center';ctx.fillText('Vers la paroi',Math.max(65,Math.min(w-65,x)),Math.max(42,Math.min(h-18,y-20)));
      return;
    }
    if (!e) return;
    const cx=X(e.x),cy=Y(e.y);
    // Visual stress pulse in the rigid piston, not an extra physical force.
    // Its age is continuous across the rebound/departure phases.
    if (e.wall === 'right') {
      ctx.save(); ctx.beginPath(); ctx.rect(right,Math.max(0,top),pistonThickness,Math.min(h,bottom)-Math.max(0,top)); ctx.clip();
      for (let i=0;i<3;i++) {
        const age=tour.impactAge-i*.14;
        if(age<0 || age>1.7)continue;
        ctx.strokeStyle='rgba(221,143,45,'+(.85*(1-age/1.7))+')';ctx.lineWidth=4-i*.7;
        ctx.beginPath();ctx.arc(right,cy,3+age*135,0,2*Math.PI);ctx.stroke();
      }
      ctx.restore();
    }
    const fixed=stationaryReflection(e);
    const impulse = impulseVector(e);
    const f=Math.min(68,h*.22)/Math.max(fixed.speed,Math.hypot(e.after.vx,e.after.vy),tour.kind==='pressure'?Math.hypot(impulse.vx,impulse.vy):0,.1);
    if (tour.kind==='work'&&!tour.compareIncoming) {
      ctx.setLineDash([5,4]);arrow(ctx,cx,cy,fixed.vx*f,-fixed.vy*f,'#9274ad',2);ctx.setLineDash([]);
      const dt=Math.max(0,sim.time-e.time), gx=X(e.x+fixed.vx*dt), gy=Y(e.y+fixed.vy*dt);
      ctx.setLineDash([3,3]);line(ctx,cx,cy,gx,gy,'#9274ad99',1.5);
      ctx.strokeStyle='#9274ad';ctx.lineWidth=2;ctx.beginPath();ctx.arc(gx,gy,(sim.radius||.04)*scale+2,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.setLineDash([3,3]);arrow(ctx,cx-e.before.vx*f,cy+e.before.vy*f,e.before.vx*f,-e.before.vy*f,'#397fbe',2);ctx.setLineDash([]);
    arrow(ctx,cx,cy,e.after.vx*f,-e.after.vy*f,'#258d79',2.5);
    ctx.strokeStyle='#e3a34e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,12+Math.min(1,tour.impactAge/.6)*16,0,2*Math.PI);ctx.stroke();
    // A common scale and laboratory velocities reveal the work asymmetry.
    ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillStyle=tour.kind==='work'&&!tour.compareIncoming?'#9274ad':'#397fbe';ctx.fillText((tour.compareIncoming?'v entrante · ':tour.kind==='work'?'v sortante si fixe · ':'p avant · ')+U.text(tour.kind==='work'||tour.compareIncoming?'velocity':'momentum', fixed.speed),14,h-35);
    ctx.fillStyle='#258d79';ctx.fillText((tour.compareIncoming?'v sortante · ':tour.kind==='work'?'v sortante si mobile · ':'p après · ')+U.text(tour.kind==='work'||tour.compareIncoming?'velocity':'momentum', Math.hypot(e.after.vx,e.after.vy)),14,h-19);
    const inward=e.wall==='left'?1:-1;
    if (tour.kind==='pressure') {
      arrow(ctx,cx,cy,impulse.vx*f,-impulse.vy*f,'#ce8b37',3);ctx.fillStyle='#aa702e';ctx.textAlign='right';ctx.fillText('J = p avant − p après = '+U.text('momentum', e.impulse),w-14,Math.min(h-55,cy+35));
    } else {
      const energy=tour.kind==='heat'?e.heat:e.work,dx=inward*Math.sign(energy)*65;
      arrow(ctx,cx-dx/2,cy,dx,0,energy>0?'#d48d39':'#497fb9',4);
      const label=tour.kind==='heat' ? (energy>0?'Paroi → gaz':'Gaz → paroi') : (energy>0?'Piston → gaz':'Gaz → piston');
      ctx.fillStyle=energy>0?'#b57b35':'#3c75a5';ctx.textAlign='right';ctx.fillText(label,w-14,h-35);
      ctx.fillText((tour.kind==='heat'?'δQ':'δW reçu')+' = '+(energy>0?'+':'')+U.text('energy', energy, 3),w-14,h-19);

    }
    if (tour.kind==='work' && tour.phase==='compare'&&!tour.compareIncoming) {
      ctx.fillStyle='rgba(255,255,255,.97)';ctx.fillRect(10,h-93,w-20,85);
      ctx.strokeStyle='#d3e2e7';ctx.lineWidth=1;ctx.strokeRect(10,h-93,w-20,85);
      ctx.textAlign='center';ctx.font='600 11px system-ui';ctx.fillStyle='#314f5e';
      ctx.fillText('COMPAREZ LES VITESSES SORTANTES',w/2,h-76);
      for (const [x,label,value,color] of [[w*.27,'Si piston fixe',fixed.speed,'#9274ad'],[w*.73,'Si piston mobile',Math.hypot(e.after.vx,e.after.vy),'#258d79']]) {
        ctx.fillStyle=color;ctx.font='11px system-ui';ctx.fillText(label,x,h-55);
        ctx.font='700 25px system-ui';ctx.fillText(U.text('velocity', value, 0),x,h-23);
      }
    }
  }
  function collision(canvas, event, { kind = 'pressure', pulse = 0 } = {}) {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    ctx.font = '11px system-ui'; ctx.fillStyle = '#6a7e8d'; ctx.textAlign = 'center';
    if (!event) { ctx.fillText('Les prochains chocs apparaîtront ici.', w / 2, h / 2); return; }
    if (event.kind === 'pair') {
      {
        const centerX = w / 2, centerY = h * 0.58;
        ctx.fillStyle = '#3679bd'; ctx.textAlign = 'center';
        ctx.fillText('Disques durs : redistribution des vitesses', centerX, 15);
        const center = { x: (event.before[0].x + event.before[1].x) / 2, y: (event.before[0].y + event.before[1].y) / 2 };
        const radius = 9, scale = radius / event.radius;
        const largest = Math.max(...event.before.concat(event.after).map(p => Math.hypot(p.vx, p.vy)), 1);
        const vectorScale = Math.min(44, w / 11) / largest;
        event.before.forEach((p, i) => {
          const x = centerX + (p.x - center.x) * scale, y = centerY - (p.y - center.y) * scale;
          const after = event.after[i];
          ctx.setLineDash([3, 3]); arrow(ctx, x - p.vx * vectorScale, y + p.vy * vectorScale, p.vx * vectorScale, -p.vy * vectorScale, '#5488bd80', 1.2); ctx.setLineDash([]);
          arrow(ctx, x, y, after.vx * vectorScale, -after.vy * vectorScale, i ? '#bb7b39' : '#258c7a', 2);
          circle(ctx, x, y, radius, i ? '#e2b27580' : '#7cbbd480');
          ctx.strokeStyle = i ? '#bb7b39' : '#3679bd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.stroke();
        });
      }
      return;
    }
    const leftWall = event.wall === 'left', wallX = leftWall ? w * 0.28 : w * 0.70;
    const inward = leftWall ? 1 : -1, cy = h * 0.53;
    ctx.fillStyle = kind === 'heat' && event.thermal ? '#f7e4cb' : '#e0e9ef';
    ctx.fillRect(wallX - (leftWall ? 12 : 0), 25, 12, h - 38);
    line(ctx, wallX, 25, wallX, h - 13, kind === 'heat' ? '#cb8d48' : '#7890a3', 3);
    const before = { vx: event.before.vx - event.wallVelocity, vy: event.before.vy };
    const after = { vx: event.after.vx - event.wallVelocity, vy: event.after.vy };
    const max = Math.max(Math.hypot(before.vx, before.vy), Math.hypot(after.vx, after.vy), 0.1);
    const scale = Math.min(w * 0.23, h * 0.31) / max;
    const cx = wallX + inward * event.radius * 210;
    arrow(ctx, cx - before.vx * scale, cy + before.vy * scale, before.vx * scale, -before.vy * scale, '#397fbe', 2.5);
    arrow(ctx, cx, cy, after.vx * scale, -after.vy * scale, '#258d79', 2.5);
    circle(ctx, cx, cy, 8.4, '#5799bfa0');
    ctx.strokeStyle = '#e8ac47' + (pulse > 0 ? 'aa' : '40'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 12 + 8 * pulse, 0, 2 * Math.PI); ctx.stroke();
    let beforeLabelY = Math.min(h - 8, Math.max(30, cy + before.vy * scale - 7));
    let afterLabelY = Math.min(h - 8, Math.max(30, cy - after.vy * scale + 13));
    if (Math.abs(beforeLabelY - afterLabelY) < 18) {
      const middle = (beforeLabelY + afterLabelY) / 2;
      beforeLabelY = middle - 10; afterLabelY = middle + 10;
    }
    ctx.fillStyle = '#47718f'; ctx.textAlign = 'left'; ctx.fillText('Avant', Math.max(8, cx - before.vx * scale - 35), beforeLabelY);
    ctx.fillStyle = '#217a69'; ctx.fillText('Après', Math.max(8, cx + after.vx * scale - 35), afterLabelY);
    if (kind === 'heat') {
      const sign = Math.sign(event.heat), dx = inward * sign * Math.min(74, w * 0.17), y = cy;
      if (sign) arrow(ctx, wallX - dx / 2, y, dx, 0, sign > 0 ? '#cf8b3899' : '#598ac099', 4);
      ctx.fillStyle = sign > 0 ? '#b1712d' : '#4877a6'; ctx.textAlign = 'center';
      ctx.fillText('δQ = ' + U.text('energy', event.heat), w * 0.72, h * 0.50);
      ctx.fillText(sign > 0 ? 'La paroi donne de l’énergie' : sign < 0 ? 'Le gaz cède de l’énergie' : 'Pas de chaleur échangée', w * 0.72, h * 0.50 + 18);
    } else {
      const dx = -inward * Math.min(75, w * 0.17);
      arrow(ctx, wallX, cy, dx, 0, '#d4913b', 3);
      ctx.fillStyle = '#b07a3b'; ctx.textAlign = 'center'; ctx.fillText('J = ' + U.text('momentum', event.impulse), wallX + dx / 2, cy + 22);
      ctx.fillStyle = '#617c8d'; ctx.fillText('u = ' + U.text('velocity', event.wallVelocity), wallX, 14);
      if (event.wallVelocity) arrow(ctx, wallX, 20, Math.sign(event.wallVelocity) * 30, 0, '#6f98ac', 1.5);
    }
  }
  function plot(canvas, { series, xRange, yRange, xLabel, yLabel, yTicks }) {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    const axes = plotAxes(ctx, w, h, xRange, yRange, xLabel, yLabel, yTicks);
    ctx.save(); ctx.beginPath(); ctx.rect(axes.left, axes.top, axes.right - axes.left, axes.bottom - axes.top); ctx.clip();
    for (const s of series) plotLine(ctx, axes, s.points, s.color, s);
    ctx.restore();
  }
  function histogram(canvas, samples, references, label = 'Valeur') {
    const surface = setup(canvas); if (!surface) return;
    const { ctx, w, h } = surface;
    const max = Math.max(...samples, ...references, 1e-9) * 1.05;
    const actual = root.GasAnalysis.histogram(samples, { bins: 20, max });
    const initial = root.GasAnalysis.histogram(references, { bins: 20, max });
    const axes = plotAxes(ctx, w, h, [0, max], [0, Math.max(...actual.bins.map(b => b.density), ...initial.bins.map(b => b.density), 1e-12) * 1.15], label, label.includes('m/s') ? 'Densité (s/m)' : 'Densité (J⁻¹)');
    for (const b of actual.bins) { ctx.fillStyle = '#4b92c080'; ctx.fillRect(axes.X(b.min) + 1, axes.Y(b.density), Math.max(0, axes.X(b.max) - axes.X(b.min) - 2), axes.Y(0) - axes.Y(b.density)); }
    plotLine(ctx, axes, initial.bins.flatMap(b => [{ x: b.min, y: b.density }, { x: b.max, y: b.density }]), '#bd843e', { dashed: true });
  }
  root.LabGraphics = { setup, chamberCamera, impulseVector, stationaryReflection, chamber, collision, plot, histogram, dataRange };
})(typeof globalThis !== 'undefined' ? globalThis : window);
