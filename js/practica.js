// Orquesta desafinada · La escena: toques, evaluación, alineación y resultados de precisión.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Toques ---------- */
const tapZones=()=>[$('#pad'),$('#tapFab')];
function flashPad(cls){
  tapZones().forEach(p=>{ p.classList.remove('hit','miss'); void p.offsetWidth; p.classList.add(cls); });
}
function setHeld(on){ tapZones().forEach(p=>p.classList.toggle('held',on)); }
// ts: e.timeStamp del evento (la hora real del toque, no la de este manejador, que en un móvil lento llega decenas de ms después)
function tap(src,ts){
  if(set.vibrate && S.running && (S.mode==='practice'||S.mode==='calib') && src && src[0]!=='k' && navigator.vibrate) navigator.vibrate(12);
  if(S.running && S.mode==='calib'){ calibTap(ts); return; }
  tapSoundOn(src||'x');
  if(!S.running || S.mode!=='practice'){ flashPad('hit'); return; }
  const now=heardAt(ts);
  if(now < S.tapFrom) return; // durante la cuenta
  const rec={t:now,rel:null}; S.taps.push(rec);
  if(S.hold){ S.holds.set(src||'x',rec); setHeld(true); }
  // En directo (para los colores y el escenario): entre las notas pendientes cuya ventana contiene el toque, la que mejor encaja con
  // el desvío reciente del jugador, y dejar atrás una nota pendiente cuesta 30 ms. Al terminar, alignTaps lo recalcula todo.
  const bias=S.recent.length ? Math.max(-0.06,Math.min(0.06,sum(S.recent)/S.recent.length)) : 0;
  let best=null, bestErr=0, bestC=Infinity, skipped=0;
  for(const n of S.notes){
    if(n.done) continue;
    if(n.t-n.win>now) break;
    const err=now-n.t; if(Math.abs(err)>n.win) continue;
    const c=Math.abs(err-bias)+skipped*0.03; skipped++;
    if(c<bestC){ best=n; bestErr=err; bestC=c; }
  }
  if(!best){ extras++; flashPad('miss'); updateLive(); gameTap(null); return; }   // golpe de más: el escenario quita un corazón
  best.done=true; rec.n=best; S.recent.push(bestErr); if(S.recent.length>4) S.recent.shift();
  const cls=hitCls(bestErr*1000);
  judg[best.i]={cls,err:bestErr*1000};
  score.flat.forEach(e=>{ if(e.head===best.i && evEls[e.i]) evEls[e.i].classList.add('j-'+cls); });
  flashPad(cls==='near'?'miss':'hit');
  updateLive();
  gameTap(best, cls);   // el director golpea la nota
}
const hitCls=ms=>{ const a=Math.abs(ms); return a<=40?'exact':a<=90?'good':'near'; };
const TP={exact:100,good:80,near:50,miss:0}, DP={exact:100,ok:70,short:30,long:30};
function release(src,ts){
  tapSoundOff(src||'x');
  if(!S.running || S.mode!=='practice' || !S.hold) return;
  const h=S.holds.get(src||'x'); if(!h) return;
  S.holds.delete(src||'x');
  if(!S.holds.size) setHeld(false);
  h.rel=heardAt(ts);
  gameRelease(h);   // soltar antes una blanca o una redonda
}
// Modo piano: cuándo se suelta respecto al final de la figura. Justa ±max(70 ms, 15 %), aceptable ±max(140 ms, 30 %)
function judgeRelease(n, tPress, tRel){
  const re=tRel-(n.t+n.dsec);
  const tol1=Math.max(0.07,0.15*n.dsec), tol2=Math.max(0.14,0.3*n.dsec);
  const a=Math.abs(re);
  const cls = a<=tol1?'exact':a<=tol2?'ok':re<0?'short':'long';
  const j=judg[n.i]; if(!j) return;
  j.dur={cls, ratio:Math.max(0,(tRel-tPress)/n.dsec), re:re*1000};
}

/* ---------- Alineación ---------- */
// Alineación óptima de toques (ts, horas ordenadas) y notas, en orden y cada toque a lo sumo con una nota dentro de su
// ventana: maximiza los puntos (exacto 100, bien 80, cerca 50, fallo 0, golpe de más −40) del desvío medido respecto a una
// tendencia constante del jugador (se prueba de −80 a +80 ms y gana la que más puntos da; a igualdad, la más cercana a 0).
// Así, con notas muy juntas, ir siempre algo tarde no se confunde con adelantarse a la nota siguiente, y saltarse una nota
// no desplaza las demás. Devuelve, para cada nota, el índice de su toque o −1.
function alignTaps(notes, ts){
  let best=-Infinity, bb=0;
  const tryB=b=>{ const v=alignDP(notes, ts, b/1000, false); if(v>best+0.5){ best=v; bb=b; } };
  [0,20,-20,40,-40,60,-60,80,-80].forEach(tryB); // de 20 en 20 y luego ±10 alrededor de la mejor
  const c=bb; [c-10,c+10].sort((x,y)=>Math.abs(x)-Math.abs(y)).forEach(tryB);
  return alignDP(notes, ts, bb/1000, true);
}
function alignDP(notes, ts, bias, full){
  const n=notes.length, m=ts.length, W=m+1, D=new Float64Array(full?(n+1)*W:2*W), B=full?new Uint8Array((n+1)*W):null;
  for(let j=1;j<=m;j++){ D[j]=D[j-1]-40; if(full) B[j]=2; }
  for(let i=1;i<=n;i++){
    const nt=notes[i-1], r=full?i*W:(i&1)*W, q=full?r-W:W-r; D[r]=D[q]; if(full) B[r]=1;
    for(let j=1;j<=m;j++){
      let best=D[q+j], b=1;                            // nota sin tocar
      const x=D[r+j-1]-40; if(x>best){ best=x; b=2; }   // golpe de más
      const err=ts[j-1]-nt.t;
      if(Math.abs(err)<=nt.win){ const e=err-bias, y=D[q+j-1]+TP[hitCls(e*1000)]-Math.abs(e)*0.001; if(y>best){ best=y; b=3; } }
      D[r+j]=best; if(full) B[r+j]=b;
    }
  }
  if(!full) return D[(n&1)*W+m];
  const match=new Array(n).fill(-1);
  for(let i=n, j=m; i>0||j>0;){ const b=B[i*W+j]; if(b===3){ match[i-1]=j-1; i--; j--; } else if(b===2) j--; else i--; }
  return match;
}
function updateLive(){
  const hits=S.notes.filter(n=>n.done).length;
  $('#padSub').textContent=`Notas afinadas: ${hits} de ${S.notes.length}${extras?` · Golpes de más: ${extras}`:''}`;
}

/* ---------- Resultados ---------- */
// r = {notes, taps, hold, endT, passStart, off, spt} de la pasada que acaba de terminar sola. Devuelve el porcentaje.
function showResults(r){
  const {notes, taps, endT}=r, holdMode=r.hold;
  // la evaluación definitiva sale de la alineación óptima (la de directo solo pintaba los colores y movía el escenario)
  const match=alignTaps(notes, taps.map(t=>t.t)), used=new Set();
  judg=[];
  notes.forEach((n,k)=>{ const j=match[k]; if(j<0){ judg[n.i]={cls:'miss'}; return; }
    const tp=taps[j], ms=(tp.t-n.t)*1000; used.add(j); judg[n.i]={cls:hitCls(ms),err:ms};
    if(holdMode) judgeRelease(n, tp.t, tp.rel==null?endT:tp.rel); });
  // golpes de más: los toques sin nota, en ticks desde el inicio (con la misma corrección que las notas)
  extraTks=taps.filter((t,j)=>!used.has(j)).map(t=>Math.max(0,Math.min(score.bars*score.L-0.01,(t.t-r.passStart-r.off)/r.spt)));
  extras=extraTks.length;
  renderScore();
  const c={exact:0,good:0,near:0,miss:0}; const errs=[];
  notes.forEach(n=>{ const j=judg[n.i]; c[j.cls]++; if(j.cls!=='miss') errs.push(j.err); });
  const N=notes.length, dc={exact:0,ok:0,short:0,long:0};
  let pts=0;
  notes.forEach(n=>{ const j=judg[n.i]; let p=TP[j.cls];
    if(holdMode && j.cls!=='miss'){ const d=j.dur; if(d) dc[d.cls]++; p = 0.6*p + 0.4*(d?DP[d.cls]:0); }
    pts+=p; });
  // cada golpe de más resta 40 puntos (como en el escenario, donde cuesta un corazón)
  const pct = N ? Math.max(0,Math.round((pts-extras*40)/(N*100)*100)) : 0;
  $('#rPct').textContent=pct+'%';
  $('#rHead').textContent = pct>=90?'Excelente precisión':pct>=75?'Muy bien':pct>=55?'Vas bien, sigue ensayando':'Escucha la escena antes de volver a intentarlo';
  let trend;
  if(errs.length){
    const mean=Math.round(sum(errs)/errs.length);
    trend = Math.abs(mean)<12 ? 'Vas centrado en el pulso.' : mean<0 ? `Tiendes a adelantarte: ${-mean} ms de media.` : `Tiendes a atrasarte: ${mean} ms de media.`;
  } else trend='No se registró ningún golpe a tiempo. Empieza a tocar justo después de la cuenta.';
  if(extras) trend+=` Tocaste ${extras} ${extras===1?'vez':'veces'} donde no había nota (en un silencio, en la parte sostenida de una figura larga o en una nota ligada).`;
  if(holdMode){
    const judged=dc.exact+dc.ok+dc.short+dc.long;
    if(judged){ if(dc.short>dc.long && dc.short>=judged*0.3) trend+=' Sueles soltar las notas antes de tiempo: mantenlas hasta el final de la figura.';
      else if(dc.long>dc.short && dc.long>=judged*0.3) trend+=' Sueles mantener las notas de más: suelta al final de cada figura, sobre todo antes de un silencio.';
      else trend+=' Las duraciones van bien.'; }
  }
  $('#durCounts').hidden=!holdMode; $('#durNote').hidden=!holdMode;
  $('#dExact').textContent=dc.exact; $('#dOk').textContent=dc.ok; $('#dShort').textContent=dc.short; $('#dLong').textContent=dc.long;
  $('#rTrend').textContent=trend;
  $('#cExact').textContent=c.exact; $('#cGood').textContent=c.good; $('#cNear').textContent=c.near; $('#cMiss').textContent=c.miss; $('#cExtra').textContent=extras;
  const an=resultAnalysis(notes);   // análisis fino (analisis.js): regularidad, tendencia y error por posición
  gameAfter(pct);   // escenario.js: avance de la escena y bloque «¡Escena superada!»
  // el detalle de precisión se pliega en las pantallas táctiles (es largo); con ratón, abierto
  $('#rSum').textContent=` · ${pct} %`;
  $('#rDetail').open=!touchMQ.matches;
  $('#results').hidden=false;
  updateFab();
  if(!set.seen) dismissWelcome();
  const hd=$('#gResHead').textContent;
  say(`${hd}${/[!.]$/.test(hd)?'':'.'} ${$('#gResText').textContent} Precisión: ${pct}%. ${$('#rHead').textContent}. ${trend}${an&&an.tip?' '+an.tip:''}`);
  $('#results').focus({preventScroll:true});
  // que el bloque de la escena (estrellas, puntos y botones) quede a la vista por encima de lo fijo, con la partitura lo más cerca posible
  revealBlock($('#gRes'),$('#gRes'));
  return pct;
}
