// Orquesta desafinada · Dibujo de la partitura en SVG y su texto para lectores de pantalla.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Dibujo de notación ---------- */
const DOTTED=[36,18];
function evW(e){ let w=13+23*Math.sqrt(e.dur/12); if(DOTTED.includes(e.dur)) w+=5; return w; }
function flag(sx,sy){ return `<path d="M${sx} ${sy}C${sx+1} ${sy+7} ${sx+10} ${sy+10} ${sx+7.5} ${sy+21}C${sx+8.5} ${sy+13} ${sx+3} ${sy+10.5} ${sx} ${sy+9}Z" fill="currentColor"/>`; }
function noteSVG(x,ny,dur,beamed){
  if(dur===48) return `<ellipse cx="${x}" cy="${ny}" rx="7.6" ry="4.9" fill="currentColor"/><ellipse class="hole" cx="${x}" cy="${ny}" rx="3.3" ry="3.1" transform="rotate(55 ${x} ${ny})"/>`;
  let s=`<ellipse cx="${x}" cy="${ny}" rx="6.1" ry="4.3" transform="rotate(-22 ${x} ${ny})" fill="currentColor"/>`;
  if(dur===24||dur===36) s+=`<ellipse class="hole" cx="${x}" cy="${ny}" rx="4.5" ry="1.9" transform="rotate(-32 ${x} ${ny})"/>`;
  const sx=x+5.5, sy=ny-34;
  s+=`<line class="stem" x1="${sx}" y1="${ny-1}" x2="${sx}" y2="${sy}"/>`;
  if(!beamed){ if(dur===6||dur===4) s+=flag(sx,sy); if(dur===3) s+=flag(sx,sy)+flag(sx,sy+7); }
  if(DOTTED.includes(dur)) s+=`<circle cx="${x+11}" cy="${ny-5}" r="1.8" fill="currentColor"/>`;
  return s;
}
function restSVG(x,y0,dur){
  const c='currentColor';
  if(dur===24) return `<rect x="${x-6}" y="${y0+15}" width="12" height="5" fill="${c}"/>`;
  if(dur===12||dur===18){
    let s=`<path d="M${x-3} ${y0+5}L${x+3.5} ${y0+13}L${x-1.5} ${y0+19.5}L${x+3.5} ${y0+26}" fill="none" stroke="${c}" stroke-width="2.1" stroke-linejoin="bevel"/>`+
      `<path d="M${x+3} ${y0+13.5}L${x-1} ${y0+19}" stroke="${c}" stroke-width="4.2" stroke-linecap="round"/>`+
      `<path d="M${x+3.5} ${y0+26}C${x-3} ${y0+22} ${x-5} ${y0+30} ${x+0.5} ${y0+35}" fill="none" stroke="${c}" stroke-width="2.3" stroke-linecap="round"/>`;
    if(dur===18) s+=`<circle cx="${x+10}" cy="${y0+15}" r="1.8" fill="${c}"/>`;
    return s;
  }
  if(dur===3){ // semicorchea: dos ganchos
    const sx=x+5, sy=y0+9, ex=x-0.5, ey=y0+34, at=yy=>sx+(ex-sx)*(yy-sy)/(ey-sy);
    return `<circle cx="${x-1.5}" cy="${y0+11}" r="2.3" fill="${c}"/><path d="M${x-1.5} ${y0+12.8}Q${x+2} ${y0+13.8} ${sx} ${sy}L${ex} ${ey}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`+
      `<circle cx="${x-3.5}" cy="${y0+20}" r="2.3" fill="${c}"/><path d="M${x-3.5} ${y0+21.8}Q${x} ${y0+22.8} ${at(y0+18.5)} ${y0+18.5}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  // corchea
  return `<circle cx="${x-2.5}" cy="${y0+15}" r="2.4" fill="${c}"/><path d="M${x-2.5} ${y0+16.8}Q${x+1} ${y0+17.8} ${x+4} ${y0+13}L${x-0.5} ${y0+30}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
}
// Barras de un grupo. El grupo puede llevar silencios dentro (empieza y acaba en nota): la barra principal pasa por
// encima y la secundaria se corta en el silencio (la semicorchea que queda sola lleva media barra hacia dentro del grupo)
function beamsSVG(run){
  const by=run[0].ny-34, xs=run.map(e=>e.x+5.5), s16=e=>e && !e.rest && e.dur===3;
  let s=`<rect x="${xs[0]-0.7}" y="${by}" width="${xs[xs.length-1]-xs[0]+1.4}" height="4.6" fill="currentColor"/>`;
  run.forEach((e,j)=>{
    if(!s16(e)) return;
    const nx=run[j+1], pv=run[j-1];
    if(s16(nx)) s+=`<rect x="${xs[j]-0.7}" y="${by+7.5}" width="${xs[j+1]-xs[j]+1.4}" height="4.6" fill="currentColor"/>`;
    else if(!s16(pv)){
      const x1 = pv ? xs[j]-9 : xs[j];
      s+=`<rect x="${x1-0.7}" y="${by+7.5}" width="${9+1.4}" height="4.6" fill="currentColor"/>`;
    }
  });
  if(run[0].tuplet) s+=`<text class="tup" x="${(xs[0]+xs[xs.length-1])/2}" y="${by-5}" text-anchor="middle">3</text>`;
  return `<g class="beam">${s}</g>`;
}
function chainEnd(e){ let c=e; while(score.flat[c.i+1] && score.flat[c.i+1].tie) c=score.flat[c.i+1]; return c; }
// Ligadura bajo las cabezas (las plicas van hacia arriba)
function tieSVG(x1,x2,y){
  const w=x2-x1, h=Math.min(7,2.5+w*0.05), c1=x1+w*0.25, c2=x2-w*0.25;
  return `<path class="tie" d="M${x1} ${y}C${c1} ${y+h} ${c2} ${y+h} ${x2} ${y}C${c2} ${y+h-1.8} ${c1} ${y+h-1.8} ${x1} ${y}Z" fill="currentColor"/>`;
}

/* ---------- Texto equivalente de la partitura (lectores de pantalla) ---------- */
// «Compás 1: negra, dos corcheas, negra, negra.»: las figuras iguales y seguidas de un mismo pulso se agrupan («dos corcheas»);
// un tresillo cuenta como una figura; la nota ligada a la anterior lo dice
const TOKNAME={48:'redonda',36:'blanca con puntillo',24:'blanca',18:'negra con puntillo',12:'negra',6:'corchea',3:'semicorchea'};
const NUMW=['','una','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce'];
const plural=n=>n.replace(/^\S+/,w=>w+(/[aeiou]$/.test(w)?'s':'es'));   // «negra con puntillo» → «negras con puntillo»
function measureText(evs, mi){
  const items=[];   // {nom, n, cell, solo}
  evs.forEach(e=>{
    if(e.tuplet){ const last=items[items.length-1]; if(last && last.cell===e.cell && last.tup) return; items.push({nom:'tresillo de corcheas', n:1, cell:e.cell, tup:true, solo:true}); return; }
    const nom = (e.rest?'silencio de ':'')+(TOKNAME[e.dur]||'figura')+(e.tie?' ligada a la anterior':'');
    const last=items[items.length-1];
    if(last && !last.solo && !e.tie && last.nom===nom && last.cell===e.cell) last.n++;
    else items.push({nom, n:1, cell:e.cell, solo:!!e.tie});
  });
  const txt=items.map(x=>x.n===1 ? x.nom : `${NUMW[x.n]||x.n} ${plural(x.nom)}`);
  return `Compás ${mi+1}: ${txt.join(', ')}.`;
}
// Descripción de un sistema para su svg: el compás al principio y cada uno de sus compases
function systemLabel(si, n, mis){
  return (n>1 ? `Sistema ${si+1} de ${n}. ` : '') + (si===0 ? `Ritmo en ${score.key}. ` : '') + mis.map(mi=>measureText(score.measures[mi], mi)).join(' ');
}

/* ---------- Partitura: sistemas y compases ---------- */
const PF=76, PO=34, Y0=40, SH=124;
let evEls=[];
function renderScore(){
  const host=$('#score');
  const W=Math.max(280, Math.floor(host.clientWidth));
  const k=W<560?0.8:1;
  const {L,measures}=score;
  const base=measures.map(evs=>{ const inner=sum(evs.map(evW)); return Math.max(inner*k, L*2.9*k)+26; });
  const systems=[]; let cur=[], used=0;
  base.forEach((w,mi)=>{
    const avail=W-(systems.length===0?PF:PO)-4;
    if(cur.length && used+w>avail){ systems.push({mis:cur,used}); cur=[]; used=0; }
    cur.push(mi); used+=w;
  });
  if(cur.length) systems.push({mis:cur,used});
  let html='';
  systems.forEach((sys,si)=>{
    const pre=si===0?PF:PO, avail=W-pre-4;
    let f=avail/sys.used;
    if(si===systems.length-1 && systems.length>1 && sys.used/avail<0.7) f=1;
    if(systems.length===1 && sys.used/avail<0.55) f=Math.min(f, 1.6);
    const endX=pre+sys.used*f;
    let s=`<svg class="sys" viewBox="0 0 ${W} ${SH}" width="${W}" height="${SH}" role="img" aria-label="${esc(systemLabel(si,systems.length,sys.mis))}">`;
    for(let l=0;l<5;l++) s+=`<line class="staff" x1="2" y1="${Y0+l*10}" x2="${endX}" y2="${Y0+l*10}"/>`;
    s+=`<rect class="clef" x="10" y="${Y0+10}" width="3.2" height="20"/><rect class="clef" x="17" y="${Y0+10}" width="3.2" height="20"/>`;
    if(si===0){ const [n,d]=score.key.split('/'); s+=`<text class="ts" x="50" y="${Y0+19}" text-anchor="middle">${n}</text><text class="ts" x="50" y="${Y0+39}" text-anchor="middle">${d}</text>`; }
    else s+=`<text class="mn" x="2" y="${Y0-12}">${sys.mis[0]+1}</text>`;
    let x=pre;
    sys.mis.forEach(mi=>{
      const MW=base[mi]*f;
      s+=measureSVG(mi,x,MW);
      x+=MW;
      if(mi===measures.length-1) s+=`<line class="bar" x1="${x-6}" y1="${Y0}" x2="${x-6}" y2="${Y0+40}"/><rect class="barthick" x="${x-3.5}" y="${Y0}" width="3.5" height="40"/>`;
      else s+=`<line class="bar" x1="${x}" y1="${Y0}" x2="${x}" y2="${Y0+40}"/>`;
    });
    // ligaduras: si la nota de destino está en el sistema siguiente, se corta al final del pentagrama y se retoma al principio
    const inSys=new Set(sys.mis), ty=Y0+27;
    sys.mis.forEach(mi=>measures[mi].forEach(e=>{
      const nx=score.flat[e.i+1];
      if(e.tie && !inSys.has(score.flat[e.i-1].m)) s+=tieSVG(pre-6,e.x-4,ty);
      if(nx && nx.tie) s+=tieSVG(e.x+4, inSys.has(nx.m) ? nx.x-4 : endX-2, ty);
    }));
    html+=s+'</svg>';
  });
  host.innerHTML=html;
  evEls=[];
  host.querySelectorAll('.ev').forEach(g=>{ evEls[+g.dataset.i]=g; });
  if(S.running && S.nowI>=0 && evEls[S.nowI]) evEls[S.nowI].classList.add('now');
}
function measureSVG(mi,mx,MW){
  const evs=score.measures[mi], ny=Y0+20;
  const inner=sum(evs.map(evW)), sc=(MW-28)/inner;
  let cum=0;
  evs.forEach(e=>{ e.x=mx+14+cum*sc+6; e.ny=ny; cum+=evW(e); });
  // barras: un grupo por celda (pulso); dentro del grupo, las figuras con barra se unen por encima de los silencios cortos que tengan en medio
  const beamed=new Set(), runs=[];
  let run=[], cell=null;
  const flush=()=>{ while(run.length && run[run.length-1].rest) run.pop(); if(run.filter(e=>!e.rest).length>1){ runs.push(run); run.forEach(e=>{ if(!e.rest) beamed.add(e); }); } run=[]; };
  evs.forEach(e=>{
    if(e.cell!==cell){ flush(); cell=e.cell; }
    if(e.dur<12 && (run.length || !e.rest)) run.push(e); else if(!(e.rest && e.dur<12)) flush();
  });
  flush();
  let s='';
  evs.forEach(e=>{
    const j=judg[e.i], jc=judg[e.head];
    s+=`<g class="ev${e.rest?' rest':''}${e.tie?' tied':''}${jc?' j-'+jc.cls:''}" data-i="${e.i}">`;
    s+= e.rest ? restSVG(e.x+1,Y0,e.dur) : noteSVG(e.x,ny,e.dur,beamed.has(e));
    s+='</g>';
    if(j){
      const my=Y0+56;
      s+=`<line class="ref" x1="${e.x}" y1="${my-6}" x2="${e.x}" y2="${my+6}"/>`;
      if(j.cls==='miss') s+=`<path class="mkx" d="M${e.x-3.5} ${my-3.5}L${e.x+3.5} ${my+3.5}M${e.x+3.5} ${my-3.5}L${e.x-3.5} ${my+3.5}"/>`;
      else {   // exacto = círculo lleno, bien = anillo, cerca = rombo: se distinguen sin depender del color
        const cx=e.x+Math.max(-14,Math.min(14,j.err*0.12));
        s+= j.cls==='near' ? `<path class="mk j-near" d="M${cx} ${my-4.4}L${cx+4.4} ${my}L${cx} ${my+4.4}L${cx-4.4} ${my}Z"/>` : `<circle class="mk j-${j.cls}" cx="${cx}" cy="${my}" r="${j.cls==='good'?3:3.3}"/>`;
      }
      if(j.dur){   // modo piano: cuánto se mantuvo la nota (color) frente a lo que debía durar (gris)
        const lk=evs.indexOf(chainEnd(e));
        const nx = lk>=0 && lk<evs.length-1 ? evs[lk+1].x : mx+MW-8;
        const ew=Math.max(10,nx-e.x-5), hw=Math.min(ew*1.6, ew*j.dur.ratio), dy=my+11;
        s+=`<rect class="dtrack" x="${e.x-3}" y="${dy}" width="${ew}" height="4" rx="2"/>`;
        s+=`<rect class="dbar d-${j.dur.cls}" x="${e.x-3}" y="${dy}" width="${Math.max(2,hw)}" height="4" rx="2"/>`;
        s+=`<line class="dtick" x1="${e.x-3+ew}" y1="${dy-3}" x2="${e.x-3+ew}" y2="${dy+7}"/>`;
      }
    }
  });
  runs.forEach(r=>{ s+=beamsSVG(r); });
  // golpes de más: triángulo gris en la fila de los marcadores, en su posición dentro del compás
  const m0=mi*score.L;
  extraTks.forEach(tk=>{
    if(tk<m0 || tk>=m0+score.L) return;
    const t=tk-m0, k=evs.findIndex(e=>t>=e.start && t<e.start+e.dur); if(k<0) return;
    const e=evs[k], nx = k<evs.length-1 ? evs[k+1].x : mx+MW-8, x=e.x+(t-e.start)/e.dur*(nx-e.x), my=Y0+56;
    s+=`<path class="mkextra" d="M${x} ${my-4.5}L${x+4.5} ${my+3.5}L${x-4.5} ${my+3.5}Z"><title>Golpe de más</title></path>`;
  });
  return s;
}
