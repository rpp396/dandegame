// Orquesta desafinada · Análisis fino del resultado: regularidad, tendencia a lo largo de la pasada, error según la posición y un consejo.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Análisis del resultado ---------- */
// Posición de una nota: on = en el pulso (en simple, la unidad del metrónomo; en compuesto, el inicio de cada grupo),
// si no, a contratiempo o en la subdivisión; after = viene justo tras un silencio
function notePos(e, sc){
  const sig=sc.sig, p=e.abs%sc.L; let on=false;
  if(sig.kind==='simple') on = p%sig.click===0;
  else { let a=0; for(const g of sig.groups){ if(p===a){ on=true; break; } a+=g; } }
  const prev=sc.flat[e.i-1];
  return {on, after:!!prev && !!prev.rest};
}
const meanOf=a=>a.length?sum(a)/a.length:0;
// items: [{err (ms, + = tarde), bar (posición en compases desde el inicio), on, after}] de las notas tocadas.
// Devuelve null con menos de 4. sd: desviación típica; drift: cambio del desvío entre la primera y la última nota según la
// recta de regresión (− = aceleras); r2: cuánto explica esa recta; on/off/after: {n, mean, abs, v} por posición.
function analyzeTaps(items){
  const n=items.length; if(n<4) return null;
  const errs=items.map(x=>x.err), mean=meanOf(errs), ss=sum(errs.map(e=>(e-mean)**2)), sd=Math.sqrt(ss/(n-1));
  const xs=items.map(x=>x.bar), mx=meanOf(xs), sxx=sum(xs.map(x=>(x-mx)**2)), sxy=sum(xs.map((x,i)=>(x-mx)*(errs[i]-mean)));
  const slope=sxx>0?sxy/sxx:0, drift=slope*(Math.max(...xs)-Math.min(...xs)), r2=sxx>0&&ss>0?sxy*sxy/(sxx*ss):0;
  const grp=f=>{ const a=items.filter(f).map(x=>x.err); if(!a.length) return null; const m=meanOf(a);
    return {n:a.length, mean:m, abs:meanOf(a.map(Math.abs)), v:a.length>1?sum(a.map(e=>(e-m)**2))/(a.length-1):0}; };
  // tendencia clara: al menos 6 notas, 25 ms de cambio y una recta que explique buena parte del desvío
  const trend = n>=6 && Math.abs(drift)>=25 && r2>=0.35 ? (drift<0?'acc':'drag') : '';
  return {n, mean, sd, drift, r2, trend, on:grp(x=>x.on), off:grp(x=>!x.on), after:grp(x=>x.after)};
}
const regLabel=sd=>sd<=15?'muy regular':sd<=30?'regular':sd<=50?'algo irregular':'irregular';
const biasTxt=m=>Math.abs(m)<10?'centrado':m<0?`tiende a ir ${Math.round(-m)} ms antes`:`tiende a ir ${Math.round(m)} ms tarde`;
// Un consejo concreto, para el patrón más claro (o null si no hay ninguno)
function analysisTip(a, sig){
  const r=v=>Math.round(Math.abs(v));
  if(a.trend==='acc') return `Aceleras: al final tocas unos ${r(a.drift)} ms antes que al principio. Escucha el clic sobre todo en la segunda mitad y no corras en lo que ya te sabes.`;
  if(a.trend==='drag') return `Te vas retrasando: al final tocas unos ${r(a.drift)} ms más tarde que al principio. Piensa en el pulso siguiente antes de que llegue.`;
  const {on,off,after}=a, cnt = sig.kind==='simple' ? '«1-y-2-y»' : '«1-2-3» en cada pulso';
  // solo si las notas en el tiempo van bien y la diferencia no es cosa del azar (más de 2 errores típicos)
  const se=on&&off?Math.sqrt(on.v/on.n+off.v/off.n):0;
  if(on && off && on.n>=2 && off.n>=3 && on.abs<=30){
    if(off.mean<=on.mean-20 && on.mean-off.mean>=2*se) return `Te adelantas en los contratiempos (${r(off.mean-on.mean)} ms antes que en el tiempo): cuenta la subdivisión en voz alta (${cnt}) y espera a su sitio.`;
    if(off.mean>=on.mean+20 && off.mean-on.mean>=2*se) return `Llegas tarde a los contratiempos (${r(off.mean-on.mean)} ms más que en el tiempo): cuenta la subdivisión (${cnt}) para tenerlos preparados.`;
    if(off.abs>=on.abs+20) return `Los contratiempos te salen menos precisos que las notas en el tiempo: cuenta la subdivisión (${cnt}) y tócalos con ella.`;
  }
  if(after && after.n>=3 && Math.abs(after.mean-a.mean)>=Math.max(25,2*Math.sqrt(after.v/after.n))) return after.mean<a.mean
    ? 'Tras los silencios te adelantas: cuenta el silencio entero antes de volver a tocar (el fantasma tiene que pasar).'
    : 'Tras los silencios entras tarde: cuenta el silencio y prepara el golpe antes de que acabe.';
  if(a.sd>=40) return `Tus toques varían bastante (±${r(a.sd)} ms): escucha la escena con «Escuchar», cuenta el pulso en voz alta y vuelve a intentarlo.`;
  if(Math.abs(a.mean)>=30 && a.sd<=25) return a.mean>0
    ? `Vas siempre unos ${r(a.mean)} ms tarde, pero con regularidad: si usas auriculares Bluetooth, mide la latencia (en Ajustes); si no, adelanta un poco el golpe.`
    : `Vas siempre unos ${r(a.mean)} ms antes, pero con regularidad: espera un poco más cada nota.`;
  return null;
}
// Análisis de la pasada que acaba de evaluar showResults (notas con judg[n.i]); pinta #rAnal y lo devuelve
function resultAnalysis(notes){
  const items=[];
  notes.forEach(n=>{ const j=judg[n.i]; if(!j || j.cls==='miss') return; const e=score.flat[n.i];
    items.push({err:j.err, bar:e.abs/score.L, ...notePos(e,score)}); });
  const a=analyzeTaps(items), box=$('#rAnal');
  box.hidden=!a; if(!a) return null;
  a.tip=analysisTip(a, score.sig);
  const sd=Math.round(a.sd), dr=Math.round(a.drift);
  $('#aTip').hidden=!a.tip; $('#aTip').textContent=a.tip||'';
  $('#aSd').textContent=`±${sd} ms`; $('#aSdTxt').textContent=regLabel(sd);
  $('#aDrift').textContent = a.trend==='acc' ? 'Aceleras' : a.trend==='drag' ? 'Te retrasas' : 'Estable';
  $('#aDriftTxt').textContent = a.trend ? `${Math.abs(dr)} ms ${dr<0?'antes':'más tarde'} al final` : 'sin tendencia clara';
  // error medio por posición (barra = error medio absoluto, hasta 100 ms)
  const rows=[['En el tiempo',a.on],['A contratiempo',a.off],['Tras un silencio',a.after]].filter(r=>r[1]);
  $('#aPos').innerHTML=rows.map(([l,g])=>`<li><span class="ap-l">${l} <small>(${g.n})</small></span><span class="ap-bar" aria-hidden="true"><i></i></span><span class="ap-v">${Math.round(g.abs)} ms · ${biasTxt(g.mean)}</span></li>`).join('');
  $('#aPos').querySelectorAll('.ap-bar i').forEach((el,k)=>{ el.style.width=Math.min(100,rows[k][1].abs)+'%'; });   // por CSSOM (CSP)
  driftChart(items, a);
  return a;
}
// Mini gráfica: desvío de cada nota (arriba = tarde) a lo largo de la pasada, con la recta de tendencia
function driftChart(items, a){
  const W=320, H=84, pl=34, pr=6, pt=6, pb=6, lim=100, nb=Math.max(1,score.bars);
  const X=b=>pl+(W-pl-pr)*b/nb, Y=v=>pt+(H-pt-pb)*(1-(Math.max(-lim,Math.min(lim,v))+lim)/(2*lim));
  const desc = a.trend==='acc' ? 'cada vez antes (aceleras)' : a.trend==='drag' ? 'cada vez más tarde (te retrasas)' : 'sin tendencia clara';
  let g=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Desvío de cada nota a lo largo de la pasada: ${desc}">`;
  g+=`<line class="ad-zero" x1="${pl}" y1="${Y(0)}" x2="${W-pr}" y2="${Y(0)}"/><text class="ad-ax" x="${pl-4}" y="${Y(lim)+8}" text-anchor="end">tarde</text><text class="ad-ax" x="${pl-4}" y="${Y(-lim)}" text-anchor="end">antes</text>`;
  items.forEach(x=>{ g+=`<circle class="ad-dot" cx="${X(x.bar).toFixed(1)}" cy="${Y(x.err).toFixed(1)}" r="2.6"/>`; });
  // recta de regresión entre la primera y la última nota
  const b0=items[0].bar, b1=items[items.length-1].bar, mx=meanOf(items.map(x=>x.bar)), sl=b1>b0?a.drift/(b1-b0):0;
  g+=`<line class="ad-fit${a.trend?' on':''}" x1="${X(b0).toFixed(1)}" y1="${Y(a.mean+sl*(b0-mx)).toFixed(1)}" x2="${X(b1).toFixed(1)}" y2="${Y(a.mean+sl*(b1-mx)).toFixed(1)}"/></svg>`;
  $('#aChart').innerHTML=g;
}
