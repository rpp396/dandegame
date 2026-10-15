// Orquesta desafinada · Transporte: planificador, «Escuchar» (demostración), escena (práctica), cuenta previa y cursor.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Transporte ---------- */
// S: estado de la pasada en curso (o de la última). mode: 'practice' (la escena), 'play' («Escuchar») o 'calib' (latencia.js)
let S={running:false,nowI:-1};
// Clics de un compás que empieza en tb. countIn: compás de cuenta previa (suena siempre y numera la cuenta)
function barClicks(tb,spt,countIn){
  const sig=score.sig, L=score.L, starts=new Set(); let a=0; sig.groups.forEach(g=>{ starts.add(a); a+=g; });
  // Cuenta previa en compases compuestos: suena cada corchea; el pulso (inicio de cada grupo) con su clic y el resto, más suave.
  // El número de la cuenta solo avanza en cada pulso.
  if(countIn && sig.kind!=='simple'){
    let pulse=0;
    for(let tk=0; tk<L; tk+=6){
      const t=tb+tk*spt, isPulse=starts.has(tk);
      if(isPulse){ pulse++; S.vis.push({t,count:pulse}); }
      click(S.mBus,t, tk===0 ? 'accent' : isPulse ? 'beat' : 'weak', 1);
    }
    return;
  }
  const audible = countIn || set.metro;
  let n=0;
  for(let tk=0; tk<L; tk+=sig.click){
    const t=tb+tk*spt;
    if(audible) click(S.mBus,t,tk===0?'accent':'beat',1);
    S.vis.push({t,count:countIn?n+1:0});
    n++;
  }
}
const AHEAD=1; // s que se programan por adelantado: el resto, compás a compás (pocos nodos vivos aunque el ritmo sea largo)
// Inicio del compás g, contado desde el primero de la cuenta previa
function barAt(g){
  const c=S.countBars, bl=score.L*S.spt; if(g<c) return S.t0+g*bl;
  return S.passStart+(g-c)*bl;
}
function schedBar(g){
  const t=barAt(g); if(g<S.countBars){ barClicks(t,S.spt,true); return; }
  barClicks(t,S.spt,false);
  // «Escuchar» hace sonar el ritmo; en la escena solo suenan el metrónomo y los toques del jugador
  if(S.mode==='play') S.byBar[g-S.countBars].forEach(e=>noteSound(S.rBus,S.passStart+e.abs*S.spt,e.len*S.spt,1));
}
// Volumen en vivo: el metrónomo y el ritmo van por su propio bus (las envolventes, a volumen 1)
function liveVol(){
  if(!S.running || !S.mBus) return; const t=ctx.currentTime;
  S.mBus.gain.setTargetAtTime(set.metroVol,t,0.02); S.rBus.gain.setTargetAtTime(set.rhythmVol,t,0.02);
}
function start(mode){
  stop(); if(!ensureAudio()) return;
  const L=score.L, spt=60/(curBpm()*score.sig.click);
  const bus=ctx.createGain(); bus.connect(master);
  const mBus=ctx.createGain(), rBus=ctx.createGain(); mBus.gain.value=set.metroVol; rBus.gain.value=set.rhythmVol; mBus.connect(bus); rBus.connect(bus);
  const t0=ctx.currentTime+0.15, countBars=1;   // un compás de cuenta previa: sin ella la primera nota llegaría 150 ms después de pulsar
  S={mode,running:true,bus,mBus,rBus,spt,t0,countBars,passStart:t0+countBars*L*spt,passDur:score.bars*L*spt,off:set.offset/1000,
     vis:[],visPtr:0,nextG:0,endG:countBars+score.bars,nowI:-1,notes:[],taps:[],byBar:score.measures.map(()=>[])};
  score.flat.forEach(e=>{ if(!e.rest && !e.tie) S.byBar[e.m].push(e); });
  judg=[]; extras=0; extraTks=[]; hideResults(); $('#calib').hidden=true;
  renderScore();
  const pad=$('#pad');
  if(mode==='practice'){
    // n.t: hora (en el reloj del audio) en que se oye la nota, más la corrección del jugador; la latencia de salida
    // la descuenta heardAt() en cada toque
    const ns=score.flat.filter(e=>!e.rest && !e.tie).map(e=>({i:e.i,t:S.passStart+e.abs*spt+S.off,dsec:e.len*spt,done:false}));
    S.hold=!!set.hold; S.holds=new Map(); S.recent=[];
    ns.forEach((n,j)=>{ const pg=j>0?n.t-ns[j-1].t:1, ng=j<ns.length-1?ns[j+1].t-n.t:1; n.win=Math.max(0.05,Math.min(0.18,Math.min(pg,ng)/2)); });
    S.notes=ns;
    // antes de esto los toques son de la cuenta previa y no cuentan (con la corrección del jugador y sin pisar la ventana de la primera nota)
    const beat=score.sig.click*spt;
    S.tapFrom=Math.min(ns.length?ns[0].t-ns[0].win:Infinity, S.passStart+S.off-Math.min(0.25,beat/2));
    pad.classList.add('live'); $('#padMain').textContent=set.hold?'Pulsa en cada nota y mantén mientras dure':'Toca en cada nota'; $('#padSub').textContent='Escucha la cuenta y empieza en el primer tiempo.';
    say(`Escena${set.hold?' en modo piano':''}: escucha la cuenta y toca en cada nota.${kbOn()?' Esc para abandonar.':''}`);
    showPad();
  } else {
    $('#padMain').textContent='Escucha: el director afina cada nota'; $('#padSub').textContent='Lee la partitura mientras suena.';
  }
  schedTick();
  S.timer=setInterval(schedTick,40);
  S.raf=requestAnimationFrame(frame);
  updateTransport();
  gameStart();   // escenario: enemigos y marcador de la pasada
}
function schedTick(){
  if(!S.running) return;
  const now=ctx.currentTime, bl=score.L*S.spt;
  while(S.nextG<S.endG){
    const t=barAt(S.nextG); if(t>=now+AHEAD) break;
    if(t+bl>now) schedBar(S.nextG); // un compás ya pasado entero se salta (pausa del hilo principal); de uno empezado solo suena lo que falta
    S.nextG++;
  }
}
function setNow(i){
  if(i===S.nowI) return;
  if(i>=0) followScore(i);
  if(S.nowI>=0 && evEls[S.nowI]) evEls[S.nowI].classList.remove('now');
  S.nowI=i;
  if(i>=0 && evEls[i]) evEls[i].classList.add('now');
}
// Desplaza la página cuando la nota actual cambia de sistema, para que se vean ese sistema y el siguiente (por encima del
// botón flotante y del escenario, que queda fijo abajo)
function followScore(i){
  const el=evEls[i], sys=el && el.closest('svg.sys'); if(!sys || sys===S.sysEl) return;
  S.sysEl=sys;
  const nxt=sys.nextElementSibling, top=sys.getBoundingClientRect().top, bottom=(nxt||sys).getBoundingClientRect().bottom;
  if(top<8 || bottom>innerHeight-fabReserve()-stageReserve()) scrollTo({top:scrollY+top-16, behavior:smooth()});
}
function showCount(c){
  const fm=$('#fabMain'), ft=c?String(c):'Toca aquí';
  if(S.mode!=='play' && fm.textContent!==ft){ fm.textContent=ft; fm.classList.toggle('count',!!c); }   // en «Escuchar» el botón es «Detener» (la cuenta va en la partitura)
  const el=$('#padCount');
  if(c){ el.textContent=c; el.hidden=false; } else el.hidden=true;
}
function frame(){
  if(!S.running) return;
  const heard=heardAt();
  if(S.mode==='calib'){ calibFrame(heard); return; }
  while(S.visPtr+1<S.vis.length && S.vis[S.visPtr+1].t<=heard) S.visPtr++;
  const v=S.vis[S.visPtr];
  if(heard<S.passStart) showCount(v && v.t<=heard ? v.count : '');
  else {
    showCount('');
    const rel=heard-S.passStart;
    if(rel>=S.passDur){
      setNow(-1);
      if(rel>S.passDur+0.35){ finish(); return; }
    } else {
      const tk=rel/S.spt;
      let idx=-1; for(const e of score.flat){ if(tk>=e.abs && tk<e.abs+e.dur){ idx=e.i; break; } }
      setNow(idx);
    }
  }
  if(S.visPtr>256){ S.vis.splice(0,S.visPtr); S.visPtr=0; }
  S.raf=requestAnimationFrame(frame);
}
function stop(){
  if(S.running){
    clearInterval(S.timer); cancelAnimationFrame(S.raf);
    const bus=S.bus;
    try{ bus.gain.setTargetAtTime(0,ctx.currentTime,0.01); setTimeout(()=>{ try{bus.disconnect();}catch(e){} },300); }catch(e){}
    stopSources();
  }
  setNow(-1); showCount('');
  const was=S.running; S.running=false;
  if(was) gameStop();
  padIdle();
  updateTransport();
}
// manual: «Detener» o Esc. En la escena, abandonarla (sin resultados); al acabar la pasada sola, resultados
function finish(manual){
  const wasPractice=S.mode==='practice';
  const r={notes:S.notes, taps:S.taps, hold:!!S.hold, endT:ctx?heardAt():0, passStart:S.passStart, off:S.off, spt:S.spt};
  stop();
  setHeld(false);
  if(!wasPractice) return;
  if(manual){ gameAbandon(r.taps.length>0); return; }
  showResults(r);
}
function updateTransport(){
  updateFab();
  const r=S.running, m=S.mode;
  $('#bStop').disabled=!r;
  $('#bPlay').classList.toggle('active',r&&m==='play');
  $('#bPractice').classList.toggle('active',r&&m==='practice');
  // en pantallas táctiles «Empezar» no responde mientras se juega o se mide (un toque desviado la reiniciaría)
  $('#bPractice').disabled = touchMQ.matches && r && (m==='practice'||m==='calib');
}
