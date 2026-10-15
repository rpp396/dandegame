// Orquesta desafinada · La gira: escenas y actos, estrellas y desbloqueo, ficha de la escena, mapa y cambio de pantalla.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Escenas ---------- */
// Cada escena: compás, compases, figuras y silencios que deben salir (generate() los cubre todos), tempo (ppm de la unidad del
// metrónomo: negra en 2/4, 3/4 y 4/4; negra con puntillo en 6/8 y 9/8), objetivo de precisión para la primera estrella, y si lleva
// síncopas (sync), ligaduras (ties) o celdas que enseña (need: rasgos de las plantillas, p. ej. 'sinc' = corchea-negra-corchea).
// La 4.ª de cada acto es de jefa (boss): más compases y esa figura sale en grande (y espera asomada tras el telón).
// Los id son fijos (el avance se guarda por id): se pueden insertar escenas con un id nuevo sin mover el de las demás.
const ACTS=['Ensayo','Corcheas rebeldes','Semicorcheas y tresillos','Compases compuestos','Gran concierto'];
const SCENES=[
  {id:'G1',act:0,title:'Afinando la orquesta',desc:'Las notas gruñonas suben al escenario, una en cada tiempo. Tócalas justo con el clic y quedarán afinadas.',sig:'4/4',bars:2,figs:['q'],rests:[],bpm:60,goal:70},
  {id:'G2',act:0,title:'Notas largas',desc:'La nota blanca dura dos tiempos: tócala una vez y, en modo piano, mantén hasta que acabe o contraatacará.',sig:'4/4',bars:2,figs:['q','h'],rests:[],bpm:60,goal:70},
  {id:'G3',act:0,title:'Fantasmas en el vals',desc:'En 3/4 aparecen los silencios fantasma: déjalos pasar sin tocar. La blanca con puntillo ocupa el compás entero.',sig:'3/4',bars:3,figs:['q','h','hd'],rests:['q'],bpm:66,goal:70},
  {id:'G4',act:0,title:'La Redonda',desc:'La jefa del ensayo: cuatro tiempos en una sola nota. Tócala en el 1 y sostenla mientras sigues contando.',sig:'4/4',bars:4,figs:['q','h','w'],rests:['q'],bpm:66,goal:72,boss:'w'},
  {id:'G5',act:1,title:'De dos en dos',desc:'Las notas con banderín llegan por parejas: dos corcheas en cada tiempo. Cuenta «1-y, 2-y».',sig:'2/4',bars:3,figs:['q','e'],rests:[],bpm:66,goal:72},
  {id:'G6',act:1,title:'Banderines y fantasmas',desc:'Un silencio de corchea deja la nota en la «y» del tiempo: espera a su sitio y no te adelantes.',sig:'4/4',bars:2,figs:['q','h','e'],rests:['q','e'],bpm:70,goal:72},
  {id:'G7',act:1,title:'El puntillo',desc:'La negra con puntillo dura tiempo y medio y casi siempre la sigue una corchea.',sig:'4/4',bars:2,figs:['q','qd','e','h'],rests:[],bpm:72,goal:72},
  {id:'G8',act:1,title:'La Gran Corchea',desc:'La jefa de los banderines llega en grande, entre negras con puntillo y silencios.',sig:'4/4',bars:4,figs:['q','qd','e','h'],rests:['q','e'],bpm:72,goal:74,boss:'e'},
  {id:'G9',act:2,title:'Cuatro por tiempo',desc:'Las notas de dos banderines llegan de cuatro en cuatro: «1-i-y-a», con trémolo de batuta.',sig:'2/4',bars:3,figs:['q','e','s'],rests:[],bpm:60,goal:72},
  {id:'G10',act:2,title:'Mezclas rápidas',desc:'Corcheas y semicorcheas mezcladas, con silencios de corchea que hay que dejar pasar.',sig:'2/4',bars:3,figs:['q','e','s'],rests:['e'],bpm:63,goal:72},
  {id:'G11',act:2,title:'El trío desafinado',desc:'Tres corcheas iguales en un tiempo: el trío sube junto y se afina con un giro de batuta en cada nota.',sig:'4/4',bars:2,figs:['q','e','t'],rests:[],bpm:66,goal:72},
  {id:'G12',act:2,title:'Trío gigante',desc:'La jefa del acto: el trío en grande, entre semicorcheas, corcheas y silencios.',sig:'4/4',bars:4,figs:['q','e','s','t'],rests:['q'],bpm:66,goal:74,boss:'t'},
  {id:'G13',act:3,title:'El 6/8',desc:'Dos pulsos de negra con puntillo por compás, cada uno con tres corcheas.',sig:'6/8',bars:2,figs:['qd','q','e'],rests:[],bpm:50,goal:72},
  {id:'G14',act:3,title:'Fantasmas en 6/8',desc:'Silencios dentro del pulso de negra con puntillo: cuenta las tres corcheas por dentro.',sig:'6/8',bars:3,figs:['qd','q','e'],rests:['q','e'],bpm:50,goal:72},
  {id:'G15',act:3,title:'El 9/8',desc:'Tres pulsos de negra con puntillo: no pierdas dónde empieza el compás.',sig:'9/8',bars:2,figs:['qd','q','e'],rests:['e'],bpm:44,goal:74},
  {id:'G16',act:3,title:'La Negra con puntillo gigante',desc:'La jefa del 6/8 llega en grande, con blancas con puntillo que ocupan el compás entero.',sig:'6/8',bars:4,figs:['qd','q','e','hd'],rests:['qd','e'],bpm:50,goal:74,boss:'qd'},
  {id:'G17',act:4,title:'Ligaduras',desc:'La nota ligada no se vuelve a tocar: su enemigo se queda en pie y se va solo.',sig:'4/4',bars:2,figs:['q','h','e'],rests:[],ties:true,bpm:66,goal:72},
  {id:'G18',act:4,title:'Síncopas',desc:'Corchea, negra, corchea: la negra empieza entre dos tiempos. Tócala en la «y» y deja pasar el pulso.',sig:'2/4',bars:3,figs:['q','e'],rests:[],sync:true,bpm:60,goal:72,need:['sinc']},
  {id:'G19',act:4,title:'Ensayo general',desc:'Un poco de todo en 3/4: tresillos, semicorcheas, blancas y silencios.',sig:'3/4',bars:3,figs:['q','h','e','s','t'],rests:['q','e'],bpm:66,goal:74},
  {id:'G20',act:4,title:'La Redonda Suprema',desc:'El gran concierto final: todas las figuras, ligaduras y síncopas. La Redonda vuelve, más grande que nunca.',sig:'4/4',bars:4,figs:['w','h','q','e','s','t'],rests:['q','e'],sync:true,ties:true,bpm:66,goal:75,boss:'w'},
];
// Estrellas: 1 = objetivo, 2 = objetivo + 12 (máx. 90 %), 3 = 95 %; n = número dentro del acto
SCENES.forEach((s,i)=>{ s.s2=Math.min(s.goal+12,90); s.s3=95; s.n=i%4+1; });
const sceneById=id=>SCENES.findIndex(s=>s.id===id);
let sceneIdx=Math.max(0, sceneById(set.gameId||'G1'));
let view='mapa';   // pantalla visible: 'mapa' (la gira) o 'escena'
const scene=()=>SCENES[sceneIdx];
// Configuración activa (la usan la generación y el transporte): la escena abierta
function cfg(){ return scene(); }
function curBpm(){ return scene().bpm; }
// Avance guardado (prog.scenes, validado por cleanScenes en progreso.js): siempre números
function sceneSt(i){ const v=prog.scenes[SCENES[i].id]||{}; return {best:+v.best||0, stars:+v.stars||0, tries:+v.tries||0, pts:+v.pts||0}; }
// Abierta: la primera, la que sigue a una con estrella y la que ya se superó o se intentó (aunque se inserten escenas antes)
const openAt=i=>i===0 || sceneSt(i-1).stars>0 || sceneSt(i).stars>0 || sceneSt(i).tries>0;
function firstOpen(){ for(let i=0;i<SCENES.length;i++) if(!sceneSt(i).stars) return i; return SCENES.length-1; }
const starsOf=(s,p)=>p>=s.s3?3:p>=s.s2?2:p>=s.goal?1:0;
const sceneName=s=>`${s.act+1}-${s.n} ${s.title}`;
const nextOK=()=>sceneIdx<SCENES.length-1 && openAt(sceneIdx+1);
const fmtN=n=>Math.round(n).toLocaleString('es-ES');

/* ---------- Tempo ---------- */
// Los ppm van a la unidad del metrónomo (que en estos compases es también el pulso): negra o negra con puntillo
const UNIT_NAMES = {12:'negra',18:'negra con puntillo'};
function unitName(sig,cap){ const n=UNIT_NAMES[sig.click]; return cap ? n[0].toUpperCase()+n.slice(1) : n; }
const tempoLabel=(b,sig)=>`${unitName(sig,true)} = ${b}`;
// Término italiano según los ppm del pulso
function tempoMark(b){
  if(b<40) return 'Grave'; if(b<60) return 'Largo'; if(b<66) return 'Larghetto'; if(b<76) return 'Adagio';
  if(b<108) return 'Andante'; if(b<120) return 'Moderato'; if(b<168) return 'Allegro'; if(b<200) return 'Presto'; return 'Prestissimo';
}

/* ---------- Estrellas ---------- */
// Ganadas llenas (★) y las que faltan vacías (☆): se distinguen por la forma, no solo por el color; el nombre accesible va en quien las contiene
function starStr(n){ return [0,1,2].map(i=>i<n?'<span class="on">★</span>':'<span>☆</span>').join(''); }
const starsTxt = n => `${n} de 3 estrellas`;
const STAR_SR = '<span aria-hidden="true">★</span><span class="sr-only"> estrellas</span>';
const LOCK='<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="5.5" rx="1" fill="currentColor"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

/* ---------- Ficha de la escena y mapa de la gira ---------- */
function renderBar(){
  const s=scene(), v=sceneSt(sceneIdx), SG=SIGS[s.sig];
  $('#lvEyebrow').innerHTML=`<span class="lv-ch">${esc(ACTS[s.act])} — </span>Acto ${s.act+1} · Escena ${s.n} de 4${s.boss?' · Jefa':''}`;
  $('#lvTitle').textContent=s.title; $('#lvDesc').textContent=s.desc;
  $('#lvMeta').innerHTML=`<span>${s.sig}</span><span>${s.bars} compases</span><span>${tempoLabel(s.bpm,SG)} · ${tempoMark(s.bpm)}</span><span>Objetivo ${s.goal}%</span><span><span aria-hidden="true">★★</span><span class="sr-only">Dos estrellas: </span>${s.s2}%</span><span><span aria-hidden="true">★★★</span><span class="sr-only">Tres estrellas: </span>${s.s3}%</span>${v.best?`<span>Mejor: ${esc(v.best)}%</span>`:''}${v.pts?`<span>Récord: ${esc(fmtN(v.pts))} pts</span>`:''}`;
  $('#lvStars').innerHTML=starStr(v.stars); $('#lvStars').setAttribute('aria-label',starsTxt(v.stars));
  const a=document.activeElement;
  $('#lvPrev').disabled=sceneIdx===0; $('#lvNext').disabled=!nextOK();
  // si el botón que tenía el foco se apaga (primera o última escena abierta), el foco pasa al otro
  if(a && a.disabled && (a.id==='lvPrev'||a.id==='lvNext')) $(a.id==='lvPrev'?'#lvNext':'#lvPrev').focus({preventScroll:true});
}
function renderMap(){
  let passed=0, stars=0, pts=0; SCENES.forEach((s,i)=>{ const v=sceneSt(i); if(v.stars) passed++; stars+=v.stars; pts+=v.pts; });
  $('#gTotal').innerHTML=`<b>${esc(passed)}</b> de ${SCENES.length} escenas superadas · <b>${esc(stars)}</b> de ${SCENES.length*3} ${STAR_SR}${pts?` · <b>${esc(fmtN(pts))}</b> puntos`:''}`;
  const nx=firstOpen(), ns=SCENES[nx], played=SCENES.some((s,i)=>sceneSt(i).tries);
  $('#bContinueLbl').textContent=`${played?'Continuar':'Empezar la gira'}: ${sceneName(ns)}`;
  $('#bContinue').dataset.go=nx;
  // nombre accesible completo («Escena 1-1: título, 2 de 3 estrellas, superada»); las bloqueadas siguen enfocables (aria-disabled)
  keepFocus($('#gMap'),()=>{ $('#gMap').innerHTML=ACTS.map((ac,ai)=>{
    let st=0; const boss=SCENES.find(s=>s.act===ai && s.boss);
    const btns=SCENES.map((s,i)=>({s,i})).filter(o=>o.s.act===ai).map(({s,i})=>{
      const v=sceneSt(i), un=openAt(i); st+=v.stars;
      const nm=`Escena ${s.act+1}-${s.n}: ${s.title}${s.boss?' (jefa)':''}, ${un ? starsTxt(v.stars)+(v.best?`, mejor ${v.best}%, ${fmtN(v.pts)} puntos`:'')+', '+(v.stars?'superada':'sin superar') : 'bloqueada'}`;
      return `<button type="button" class="sc${v.stars?' done':''}${s.boss?' boss':''}" data-lv="${i}" ${un?'':'aria-disabled="true"'} aria-current="${i===sceneIdx}" aria-label="${esc(nm)}">`
        + `<span class="sc-n">${s.act+1}-${s.n}${s.boss?' <span class="g-crown">♛</span>':''}</span><span class="sc-t">${esc(s.title)}</span>`
        + `<span class="sc-f"><span class="stars">${un?starStr(v.stars):LOCK}</span>${un&&v.pts?`<span class="sc-p">${esc(fmtN(v.pts))} pts</span>`:''}</span></button>`;
    }).join('');
    return `<section class="act" aria-labelledby="act${ai}"><div class="act-head"><img src="${bossThumb(boss.boss)}" alt="" width="40" height="40">`
      + `<h3 id="act${ai}"><small>Acto ${ai+1}</small>${esc(ac)}</h3><span class="act-st">${esc(st)}/12 ${STAR_SR}</span></div><div class="g-grid">${btns}</div></section>`;
  }).join(''); });
}
function refreshScene(){ renderBar(); renderMap(); }
// Centra la partitura en la parte visible (descontando el botón flotante en móvil) si no se ve entera
function centerScore(){
  const r=$('.score-card').getBoundingClientRect();
  // el botón flotante en reposo aparece al quedar la partitura a la vista: se reserva su sitio aunque aún esté oculto
  const reserve = fabWanted() ? Math.max(fabReserve(), 100) : 8, room=innerHeight-reserve;
  if(r.top>=8 && r.bottom<=room) return;
  const top = r.height<room-16 ? r.top-(room-r.height)/2 : r.top-8;
  scrollTo({top:scrollY+top, behavior:smooth()});
}
// Abre la escena i (si está abierta): la ficha, el bestiario, una partitura nueva y el escenario en reposo
function selectScene(i){
  if(i<0 || i>=SCENES.length || !openAt(i)) return false;
  stop(); sceneIdx=i; set.gameId=SCENES[i].id; save();
  if(view!=='escena') setView('escena');   // pinta la ficha, el bestiario y la partitura (nueva si cambia la escena)
  else { stageReset(); renderBar(); renderBest(); generate(); stageDraw(); }
  renderMap();
  const s=SCENES[i];
  say(`Acto ${s.act+1}, escena ${s.n}: ${s.title}. ${s.bpm} ppm de ${unitName(SIGS[s.sig])}, objetivo ${s.goal}%.`);
  requestAnimationFrame(centerScore);
  return true;
}
// Cambia de pantalla: 'mapa' (la gira) o 'escena'
function setView(v){
  stop();
  view=v; if(set.view!==v){ set.view=v; save(); }
  $('#mapView').hidden=v!=='mapa'; $('#sceneView').hidden=v!=='escena';
  $('#calib').hidden=true;
  if(v==='escena'){
    if(!openAt(sceneIdx)) sceneIdx=firstOpen();
    if(set.gameId!==scene().id){ set.gameId=scene().id; save(); }
    renderBar(); renderBest();
    if(!score || score.sid!==scene().id) generate(); else { hideResults(); renderScore(); }
    stageEnter();
  } else { hideResults(); renderMap(); }
  scrollTo({top:0, behavior:'auto'});
  updateFab();
}
