// Orquesta desafinada · Medición de latencia.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Medición de latencia ---------- */
// 4 clics de cuenta y 16 a 90 ppm: cada toque se compara con la hora a la que se oye el clic (heardAt, igual que en la escena)
const K_BPM=90, K_LEAD=4, K_N=16;
let K={suggest:null};
function startCalib(){
  stop(); if(!ensureAudio()) return;
  const period=60/K_BPM, bus=ctx.createGain(); bus.connect(master);
  // la corrección sugerida no absorbe la latencia de salida, que la escena ya descuenta por su cuenta
  const t0=ctx.currentTime+0.2;
  S={mode:'calib',running:true,bus,t0,period,passStart:t0+K_LEAD*period,taps:[],vis:[],visPtr:0,nowI:-1};
  const vol=Math.max(set.metroVol,0.6);
  for(let i=0;i<K_LEAD+K_N;i++){
    const t=t0+i*period;
    click(bus,t,i%4===0?'accent':'beat',vol);
    S.vis.push({t,count:i<K_LEAD?i+1:0});
  }
  $('#calib').hidden=true; hideResults();
  $('#pad').classList.add('live');
  $('#padMain').textContent='Toca justo con cada clic';
  $('#padSub').textContent=`Escucha 4 clics de cuenta y luego toca con los ${K_N} siguientes, a ${K_BPM} ppm.`;
  say(`Medición de latencia: escucha 4 clics de cuenta y luego toca con cada uno de los ${K_N} siguientes.`);
  showPad();
  S.raf=requestAnimationFrame(frame);
  updateTransport();
}
function calibFrame(heard){
  while(S.visPtr+1<S.vis.length && S.vis[S.visPtr+1].t<=heard) S.visPtr++;
  const v=S.vis[S.visPtr];
  if(heard<S.passStart) showCount(v && v.t<=heard ? v.count : '');
  else {
    showCount('');
    const n=Math.min(K_N, Math.floor((heard-S.passStart)/S.period)+1);
    $('#padMain').textContent=`Clic ${n} de ${K_N}`;
  }
  if(heard > S.passStart+K_N*S.period+0.2){ finishCalib(); return; }
  S.raf=requestAnimationFrame(frame);
}
function calibTap(ts){
  const rel=heardAt(ts)-S.passStart;
  if(rel < -S.period/2) return; // durante la cuenta
  const k=Math.round(rel/S.period);
  if(k<0 || k>=K_N) return;
  const err=rel-k*S.period;
  if(Math.abs(err) > S.period*0.45) return;
  if(!S.taps.some(t=>t.k===k)) S.taps.push({k,err:err*1000});
  flashPad('hit');
  $('#padSub').textContent=`Toques registrados: ${S.taps.length}`;
}
const median=a=>{ const b=[...a].sort((x,y)=>x-y), m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; };
function finishCalib(){
  const taps=S.taps; stop();
  const box=$('#calib'); box.hidden=false;
  const apply=$('#kApply'); apply.textContent='Aplicar corrección';
  // descartar los dos primeros clics (el oído aún se está ajustando)
  const all=taps.filter(t=>t.k>=2).map(t=>t.err);
  if(all.length<6){
    K.suggest=null; apply.disabled=true;
    $('#kVal').textContent='—';
    $('#kHead').textContent='No hubo suficientes toques';
    $('#kText').textContent=`Se registraron ${all.length} toques válidos y hacen falta al menos 6. Toca con cada clic después de la cuenta de cuatro.`;
    $('#kStrip').innerHTML=''; announceCalib(); return;
  }
  const med=median(all);
  const kept=all.filter(e=>Math.abs(e-med)<=80);
  const mean=kept.reduce((s,x)=>s+x,0)/kept.length;
  const sd=Math.sqrt(kept.reduce((s,x)=>s+(x-mean)**2,0)/kept.length);
  const base=set.offset;
  const suggest=Math.max(-150,Math.min(250,Math.round(mean/5)*5));
  K.suggest=suggest;
  const sgn=v=>(v>0?'+':'')+v;
  $('#kVal').textContent=sgn(suggest)+' ms';
  $('#kHead').textContent = sd>45 ? 'Corrección sugerida (poco fiable)' : 'Corrección sugerida';
  let txt = Math.abs(Math.round(mean))<5 ? 'Tus toques coinciden con el clic; no hace falta corregir casi nada.'
    : `Tus toques llegaron de media ${Math.abs(Math.round(mean))} ms ${mean>0?'después':'antes'} del clic`;
  if(Math.abs(Math.round(mean))>=5) txt+=` (dispersión ±${Math.round(sd)} ms, ${kept.length} toques usados${all.length-kept.length?`, ${all.length-kept.length} descartados por alejados`:''}).`;
  txt += ` La corrección actual es ${sgn(base)} ms.`;
  if(sd>45) txt+=' Tus toques variaron bastante: repite la medición concentrándote en caer justo con el clic.';
  $('#kText').textContent=txt;
  apply.disabled = suggest===base;
  if(suggest===base) apply.textContent='Ya está aplicada';
  // tira de toques: -200..+200 ms
  const W=Math.max(300,Math.min(900,$('#kStrip').clientWidth||600)),H=64,cx=W/2,sc=(W/2-20)/200, X=v=>cx+Math.max(-200,Math.min(200,v))*sc;
  let g=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><line class="kaxis" x1="20" y1="30" x2="${W-20}" y2="30"/><line class="kzero" x1="${cx}" y1="10" x2="${cx}" y2="50"/>`;
  [-200,-100,0,100,200].forEach(v=>{ g+=`<text class="klbl" x="${X(v)}" y="62" text-anchor="middle">${v>0?'+':''}${v}</text>`; });
  all.forEach((e,j)=>{ const out=Math.abs(e-med)>80; g+=`<circle class="kdot${out?' out':''}" cx="${X(e)}" cy="${24+(j%3)*6}" r="4"/>`; });
  g+=`<line class="kmean" x1="${X(mean)}" y1="8" x2="${X(mean)}" y2="52"/><text class="klbl acc" x="${X(mean)}" y="6" text-anchor="middle">media</text>`;
  g+=`<text class="klbl" x="22" y="12">antes</text><text class="klbl" x="${W-22}" y="12" text-anchor="end">después</text></svg>`;
  $('#kStrip').innerHTML=g;
  announceCalib();
}
function announceCalib(){
  say(`${$('#kHead').textContent}: ${$('#kVal').textContent}. ${$('#kText').textContent}`);
  $('#calib').focus({preventScroll:true});
  updateFab();
  revealBlock($('#calib'),$('#calib'));   // en el móvil queda bajo la partitura: se lleva a la vista
}
