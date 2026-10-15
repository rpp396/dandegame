// Orquesta desafinada · Eventos: botones de la escena y de los resultados, zona de toque, «Reiniciar», teclado y bienvenida.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Escena y resultados ---------- */
// Otro ritmo de la misma escena: el escenario vuelve al reposo
function newRhythm(){ stop(); stageReset(); generate(); stageDraw(); say('Otro ritmo de la escena'); }
$('#bPlay').addEventListener('click',()=>start('play'));
$('#bPractice').addEventListener('click',()=>start('practice'));
$('#bStop').addEventListener('click',()=>{ if(S.running && S.mode==='practice') finish(true); else stop(); });
$('#bNew').addEventListener('click',newRhythm);
$('#bMap').addEventListener('click',goMap);
$('#lvPrev').addEventListener('click',()=>selectScene(sceneIdx-1));
$('#lvNext').addEventListener('click',()=>selectScene(sceneIdx+1));
$('#gNext').addEventListener('click',()=>{ if(nextOK()) selectScene(sceneIdx+1); });
$('#gRetry').addEventListener('click',()=>start('practice'));
$('#gMapBtn').addEventListener('click',goMap);
$('#kAgain').addEventListener('click',()=>startCalib());
$('#kApply').addEventListener('click',()=>{
  if(K.suggest==null) return;
  set.offset=K.suggest; $('#offset').value=set.offset; updOutputs(); save();
  $('#kApply').disabled=true; $('#kApply').textContent='Corrección aplicada'; $('#kAgain').focus();
});
// Vuelve al mapa de la gira con el foco en la escena abierta
function goMap(){
  setView('mapa');
  const b=$(`#gMap .sc[data-lv="${sceneIdx}"]`); if(b) b.focus({preventScroll:true});
}

/* ---------- Zona de toque ---------- */
// La partitura (con el escenario dentro) y el botón flotante son zonas de toque, pero solo durante la escena o la medición:
// en reposo se puede desplazar la página con normalidad
function bindTapZone(el,pre){
  // En reposo, un clic (no un arrastre para desplazar la página) empieza la escena. Se ignora el clic que
  // cierra un toque empezado durante la escena, para no volver a empezar al soltar después del final.
  let downWhileRunning=false;
  el.addEventListener('click',()=>{
    // mientras suena «Escuchar», el botón flotante es «Detener»
    if(S.running && S.mode==='play'){ if(el.id==='tapFab'){ stop(); say('Detenido'); } downWhileRunning=false; return; }
    if(!S.running && !downWhileRunning) start('practice');
    downWhileRunning=false;
  });
  el.addEventListener('pointerdown',e=>{
    downWhileRunning=S.running;
    if(!S.running || (S.mode!=='practice' && S.mode!=='calib')) return;
    if(e.button>0) return;
    e.preventDefault(); try{ el.setPointerCapture(e.pointerId); }catch(_){} tap(pre+e.pointerId,e.timeStamp);
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>el.addEventListener(t,e=>release(pre+e.pointerId,e.timeStamp)));
  el.addEventListener('contextmenu',e=>{ if(S.running) e.preventDefault(); });
}
bindTapZone($('#pad'),'p'); bindTapZone($('#tapFab'),'f');
// «Reiniciar» del botón flotante: hay que mantenerlo pulsado medio segundo (la animación dura lo mismo)
let restartTimer=0;
function restartCancel(){ clearTimeout(restartTimer); restartTimer=0; $('#fabRestart').classList.remove('arming'); }
function restartNow(){
  const m=S.running && S.mode;
  if(m==='practice'){ start('practice'); say('Escena reiniciada'); }
  else if(m==='calib'){ startCalib(); say('Medición reiniciada'); }
}
$('#fabRestart').addEventListener('pointerdown',e=>{
  e.preventDefault(); if(!S.running || e.button>0) return;
  try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
  restartCancel(); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('arming');
  restartTimer=setTimeout(()=>{ restartTimer=0; restartNow(); restartCancel(); },500);
});
// Con teclado (o lector de pantalla) no hace falta mantener: Intro o Espacio reinician al instante (el clic del puntero tiene detail>0 y no cuenta)
$('#fabRestart').addEventListener('click',e=>{ if(e.detail===0 && S.running) restartNow(); });
['pointerup','pointercancel','lostpointercapture'].forEach(t=>$('#fabRestart').addEventListener(t,restartCancel));
$('#fabRestart').addEventListener('contextmenu',e=>e.preventDefault());
// Botón de tres partes tras la escena. Se ignoran los toques del primer instante: puede ser el dedo que seguía tocando al terminar
const postOk=()=>performance.now()-postSince>700;
$('#pfAgain').addEventListener('click',()=>{ if(postOk()) start('practice'); });
$('#pfMap').addEventListener('click',()=>{ if(postOk()) goMap(); });
$('#pfNext').addEventListener('click',()=>{ if(postOk() && nextOK()) selectScene(sceneIdx+1); });

/* ---------- Teclado ---------- */
// Durante la escena o la medición, Espacio, Intro o cualquier tecla de un carácter tocan; Esc abandona la escena (o detiene).
// En reposo, Espacio o Intro sobre la partitura empiezan la escena. No hay atajos de una letra fuera de la escena.
const isField=el=>el && (el.tagName==='INPUT'||el.tagName==='SELECT'||el.tagName==='TEXTAREA');
let kbdNav=false;   // el foco llegó con el teclado (Tab): revealFocus lo saca de debajo del botón flotante
addEventListener('pointerdown',()=>{ kbdNav=false; },true);
addEventListener('keydown',e=>{ if(e.key==='Tab') kbdNav=true; },true);
document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||e.repeat || dlg.open) return;
  if(e.key==='Escape' && S.running){ e.preventDefault(); if(S.mode==='practice') finish(true); else stop(); return; }
  // «Reiniciar» enfocado: Intro o Espacio lo activan (su clic), no cuentan como toque
  if(e.target===$('#fabRestart') && (e.code==='Space'||e.code==='Enter')) return;
  const playing=S.running && (S.mode==='practice'||S.mode==='calib');
  if(playing && (e.code==='Space'||e.code==='Enter'||(e.key.length===1 && !isField(e.target)))){
    if(isField(e.target) && e.code!=='Space') return;
    e.preventDefault(); tap('k'+e.code,e.timeStamp); return;
  }
  if((e.code==='Space'||e.code==='Enter') && e.target===$('#pad')){ e.preventDefault(); if(S.running) tap('k'+e.code,e.timeStamp); else start('practice'); }
});
document.addEventListener('keyup',e=>{ if(S.running && (S.mode==='practice'||S.mode==='calib') && e.code==='Space' && e.target!==$('#fabRestart')) e.preventDefault(); release('k'+e.code,e.timeStamp); });
window.addEventListener('blur',()=>{ if(S.running && S.hold) [...S.holds.keys()].forEach(k=>release(k)); [...tapVoices.keys()].forEach(tapSoundOff); });
document.addEventListener('focusin',e=>{ if(kbdNav) revealFocus(e.target); });

/* ---------- Bienvenida ---------- */
// Sale la primera vez (sin avance); se cierra con «¡A escena!», «Medir latencia ahora» o al terminar la primera escena.
// «Cómo se juega» (cabecera) la vuelve a abrir.
function dismissWelcome(){ if(!set.seen){ set.seen=true; save(); } $('#welcome').hidden=true; $('#bHelp').setAttribute('aria-expanded','false'); }
function showWelcome(){ $('#welcome').hidden=false; $('#bHelp').setAttribute('aria-expanded','true'); }
$('#welOk').addEventListener('click',()=>{ dismissWelcome(); if(view==='mapa') $('#bContinue').focus(); else $('#pad').focus(); });
$('#welCalib').addEventListener('click',()=>{ dismissWelcome(); if(view!=='escena') setView('escena'); startCalib(); });
$('#bHelp').addEventListener('click',()=>{
  if(!$('#welcome').hidden){ dismissWelcome(); return; }
  showWelcome(); $('#welcome').scrollIntoView({block:'start', behavior:smooth()}); $('#welTitle').focus({preventScroll:true});
});

// Red de seguridad (WCAG 2.4.3): si tras activar un control con el teclado el foco se pierde (el control se ocultó o se apagó al
// actuar, y el foco cae en <body>), vuelve a la partitura (en la escena) o al contenido principal (en el mapa)
document.addEventListener('click',e=>{
  if(e.detail!==0 || !e.target.closest || !e.target.closest('button')) return;
  setTimeout(()=>{ const a=document.activeElement; if(!a || a===document.body || a.disabled || a.closest('[hidden]')) (view==='escena' ? $('#pad') : $('#main')).focus({preventScroll:true}); },80);
});

let rz=0;
new ResizeObserver(()=>{ cancelAnimationFrame(rz); rz=requestAnimationFrame(()=>{ if(score && view==='escena') renderScore(); }); }).observe($('#score'));
