// Orquesta desafinada · Generación de ritmos según la escena.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Generación ---------- */
let score = null, judg = [], extras = 0, extraTks = []; // extraTks: posición (en ticks) de cada golpe de más
const sum = a => a.reduce((s,x)=>s+x,0);
// Una celda vale si usa solo figuras y silencios de la escena (y las síncopas, solo si la escena las tiene)
function allowed(c){ const C=cfg(), R=restList(C); if(c.sync && !C.sync) return false; return c.req.every(k=>C.figs.includes(k)) && c.rreq.every(k=>R.includes(k)); }
function weighted(a){ const t=sum(a.map(x=>x.w)); let r=Math.random()*t; for(const x of a){ r-=x.w; if(r<=0) return x; } return a[a.length-1]; }
// Un compás: celdas elegidas al azar (con peso) pulso a pulso, sin ocultar el pulso ni la mitad del compás
function genMeasure(sig, L){
  const G = sig.groups, R = restList(cfg()); let last = null;
  // 4/4: se piensa por mitades; ahí la blanca, la negra con puntillo + corchea y la blanca con puntillo empiezan en tiempo impar
  const pairs = sig.kind==='simple' && L===48;
  const isQR = c => c.ev.length===1 && c.ev[0][0]===12 && !!c.ev[0][1];
  for(let attempt=0; attempt<40; attempt++){
    const evs=[]; let gi=0, pos=0, cid=0, fb=false, prevQR=false;
    while(gi<G.length){
      const len=G[gi], cands=[];
      (len===12 ? SIMPLE_BEAT : COMP_BEAT).filter(allowed).forEach(c=>{
        // dos silencios de negra en la misma mitad del compás son uno de blanca: si no se puede usar, no se juntan
        if(pairs && gi%2 && prevQR && isQR(c) && !R.includes('h')) return;
        cands.push({c,span:1,w:c.rest?0.45:1});
      });
      (len===12?SIMPLE_MULTI:COMP_MULTI).filter(allowed).forEach(c=>{
        const clen=sum(c.ev.map(e=>e[0])), span=clen/len;
        if(gi+span>G.length) return;
        if(c.wholeBar && !(gi===0 && L===clen)) return;
        if(pairs && gi%2 && (clen===24 || clen===36)) return;
        // silencio de blanca solo en tiempo impar (en 3/4, los tiempos 2-3 son dos silencios de negra)
        if(len===12 && c.rest && clen===24 && gi%2) return;
        cands.push({c,span,w:c.rest?0.4:0.9});
      });
      let pick;
      if(!cands.length){ fb=true; pick={c:{ev:[[len,1]]},span:1}; }
      else pick=weighted(cands);
      if(pairs && gi%2 && prevQR && isQR(pick.c)){ evs[evs.length-1].dur=24; pos+=12; gi++; prevQR=false; continue; }
      prevQR = gi%2===0 && pick.span===1 && isQR(pick.c);
      pick.c.ev.forEach(([d,r])=>{ evs.push({dur:d,rest:!!r,tuplet:!!pick.c.tuplet,trait:pick.c.trait,cell:cid,start:pos}); pos+=d; });
      cid++; gi+=pick.span;
    }
    last={evs,fb};
    if(evs.some(e=>!e.rest)) return last;   // un compás sin ninguna nota no vale
  }
  return last;
}
// Figuras escritas en un ritmo: clave de FIGS para las notas y 'r' + clave para los silencios; '~' + rasgo para las celdas que se enseñan
function figsUsed(measures){ const k=new Set(); measures.forEach(evs=>evs.forEach(e=>{ k.add((e.rest?'r':'')+DUR2K[e.dur]); if(e.trait) k.add('~'+e.trait); })); return k; }
const hasNote = ms => ms.some(m=>m.evs.some(e=>!e.rest));
// La partitura de la escena: debe usar todas sus figuras, silencios y celdas pedidas (need). Se cambia un compás al azar y el
// cambio se queda si no pierde ninguna (máx. 3000 intentos; si alguna no puede salir, se queda lo logrado)
function generate(){
  const C=cfg(), sig=SIGS[C.sig], L=sum(sig.groups);
  const newBars=()=>Array.from({length:C.bars},()=>genMeasure(sig,L));
  let ms=newBars();
  for(let a=0; a<50 && !hasNote(ms); a++) ms=newBars();
  const want = [...C.figs, ...restList(C).map(k=>'r'+k), ...(C.need||[]).map(k=>'~'+k)];
  const cover = t => { const u=figsUsed(t.map(m=>m.evs)); return want.filter(k=>u.has(k)).length; };
  let n=cover(ms);
  for(let it=0; it<3000 && n<want.length; it++){
    const r=genMeasure(sig,L); if(r.fb) continue;
    const t=ms.slice(); t[Math.floor(Math.random()*t.length)]=r;
    const tn=cover(t);
    if(tn>=n && hasNote(t)){ ms=t; n=tn; }
  }
  const measures=ms.map(m=>m.evs), fb=ms.some(m=>m.fb);
  const flat=[];
  measures.forEach((evs,mi)=>evs.forEach(e=>{ e.m=mi; e.abs=mi*L+e.start; e.i=flat.length; flat.push(e); }));
  if(C.ties) addTies(flat);
  chainTies(flat);
  score={sid:C.id,key:C.sig,bars:C.bars,sig,L,measures,flat,fb};
  judg=[]; extras=0; extraTks=[]; hideResults();
  renderScore(); updateFab();
}
// e.len = duración que suena (la nota ligada suma las que le siguen); e.head = nota que se toca
function chainTies(flat){ flat.forEach(e=>{ e.len=e.dur; e.head=e.i; if(e.tie){ const h=flat[flat[e.i-1].head]; e.head=h.i; h.len+=e.dur; } }); }
// Liga la última nota de una celda con la primera de la siguiente (también a través de la barra de compás).
// Si la primera nota acaba a contratiempo sale una síncopa; si no, una nota prolongada.
function addTies(flat){
  for(let i=1;i<flat.length;i++){
    const a=flat[i-1], b=flat[i];
    if(a.rest || b.rest || a.tuplet || b.tuplet || a.tie) continue;
    if(a.m===b.m && a.cell===b.cell) continue;
    const offbeat = i>1 && flat[i-2].m===a.m && flat[i-2].cell===a.cell;
    if(Math.random() < (offbeat?0.35:0.15)) b.tie=true;
  }
}
// Oculta los resultados (y el bloque de la escena: superada o telón)
function hideResults(){ const r=$('#results'); r.hidden=true; r.classList.remove('lost'); }
