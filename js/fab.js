// Orquesta desafinada · Botón flotante (móvil), botón de tres partes tras la escena y zona de toque.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Botón flotante y zona de toque ---------- */
// Botón flotante: solo en pantallas táctiles (móvil, tableta) y si el ajuste está activo
const touchMQ = matchMedia('(any-pointer: coarse)');
const fabWanted = () => !!set.fab && touchMQ.matches;
// En reposo el botón dice «Empezar» (solo si la partitura está a la vista y el botón «Empezar la escena» no); durante la
// escena o la medición, «Toca aquí»; mientras suena «Escuchar», «Detener». Con los resultados a la vista pasa a ser el
// botón de tres partes (#postFab): Reintentar · Gira · Siguiente
let padInView=false, btnInView=false, postSince=0;
function updateFab(){
  const f=$('#tapFab'), fm=$('#fabMain'), pf=$('#postFab'), live=S.running && (S.mode==='practice'||S.mode==='calib');
  const play=S.running && S.mode==='play';   // «Detener» abajo: el de la escena puede quedar fuera de pantalla
  const inScene=!$('#sceneView').hidden;
  const res=!$('#results').hidden && inScene;
  const post=fabWanted() && !S.running && res;
  // res-on: con resultados se oculta el bloque de botones (táctil) para que queden pegados a la partitura; post-on: no se repiten sus botones
  document.body.classList.toggle('res-on',res); document.body.classList.toggle('post-on',post);
  const on=fabWanted() && inScene && !post && (live || play || (!S.running && padInView && !btnInView));
  if(post){ if(pf.hidden){ pf.hidden=false; postSince=performance.now(); } syncPostFab(); } else pf.hidden=true;
  f.hidden=!on; document.body.classList.toggle('fab-on',on||post); f.classList.toggle('idle',on && !live);
  f.classList.toggle('stopb',on && play);
  f.classList.toggle('split',on && live); $('#fabRestart').hidden=!(on && live);
  if(!(on && live)) restartCancel();
  if(on && play){ fm.textContent='Detener'; fm.classList.remove('count'); }
  else if(on && !live){ fm.textContent='Empezar'; fm.classList.remove('count'); }
  else if(on && (fm.textContent==='Empezar'||fm.textContent==='Detener')) fm.textContent='Toca aquí';
  // espacio inferior que tapan los elementos fijos: el foco de teclado y los desplazamientos de la página lo respetan (scroll-padding-bottom)
  document.documentElement.style.setProperty('--pinB', (pinnedEl() ? fabReserve() : 0)+'px');
}
// «Siguiente» lleva a la escena siguiente (apagado si aún está cerrada)
function syncPostFab(){
  const b=$('#pfNext');
  b.disabled=!nextOK();
  b.setAttribute('aria-label','Siguiente escena');
}
// Elemento fijo que tapa la parte baja de la pantalla: botón flotante o botón de tres partes (si se ve)
const pinnedEl = () => [$('#tapFab'),$('#postFab')].find(x=>!x.hidden) || null;
// Alto de la parte inferior de la pantalla que tapa (para el seguimiento de la partitura)
function fabReserve(){
  const f=pinnedEl();
  return f ? innerHeight-f.getBoundingClientRect().top+12 : 8;
}
// Foco de teclado tapado por el botón flotante (WCAG 2.4.11): se desplaza lo justo para que quede por encima
// (scroll-padding-bottom = --pinB hace que 'nearest' deje ese margen)
function revealFocus(el){
  const p=pinnedEl(); if(!p || !el.getBoundingClientRect || el.closest('#tapFab,#fabRestart,#postFab')) return;
  if(el.getBoundingClientRect().bottom > p.getBoundingClientRect().top-4) el.scrollIntoView({block:'nearest', behavior:'auto'});
}
// Desplaza la página lo justo para que el bloque de topEl a botEl se vea por encima de lo que tapa lo fijo;
// si no cabe entero, deja su principio arriba
function revealBlock(topEl, botEl){
  const room=innerHeight-fabReserve(), t=topEl.getBoundingClientRect().top, b=botEl.getBoundingClientRect().bottom;
  if(t>=8 && b<=room) return;
  const dy = b>room ? Math.min(b-room+10, t-8) : t-8;
  if(dy) scrollTo({top:scrollY+dy, behavior:smooth()});
}
function showPad(){
  updateFab();
  const p=$('#pad'), r=p.getBoundingClientRect();
  p.focus({preventScroll:true});
  const room=innerHeight-fabReserve();
  if(r.top<0 || r.bottom>room) p.scrollIntoView({block:r.height>room?'start':'center',behavior:smooth()});
}
// Textos de la zona de toque en reposo: de teclado solo con puntero fino (en el móvil y la tableta sin ratón, de toque)
function padIdle(){
  $('#pad').classList.remove('live');
  if(kbOn()){
    $('#padMain').textContent='Toca la partitura (o «Empezar la escena») para empezar, y luego toca en cada nota';
    $('#padSub').textContent='Cada nota sube al escenario en su tiempo. Tócala con la barra espaciadora, cualquier tecla o el ratón; los silencios no se tocan. Esc abandona la escena.';
  } else {
    $('#padMain').textContent='Pulsa «Empezar la escena» y toca en cada nota';
    $('#padSub').textContent=`Cada nota sube al escenario en su tiempo. Tócala ${fabWanted()?'con el botón grande de abajo':'sobre la partitura o el escenario'}; los silencios no se tocan.`;
  }
}
