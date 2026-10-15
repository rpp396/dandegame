// Orquesta desafinada · Inicio: mapa de la gira, observadores y arranque del juego (debe cargarse el último).
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Mapa de la gira ---------- */
$('#gMap').addEventListener('click',e=>{
  const b=e.target.closest('.sc'); if(!b) return;
  if(b.getAttribute('aria-disabled')==='true'){ say(b.getAttribute('aria-label')+'. Consigue una estrella en la escena anterior para abrirla.'); return; }
  selectScene(+b.dataset.lv); $('#pad').focus({preventScroll:true});
});
$('#bContinue').addEventListener('click',()=>{ selectScene(+$('#bContinue').dataset.go||0); $('#pad').focus({preventScroll:true}); });
$('#skip').addEventListener('click',e=>{ e.preventDefault(); (view==='escena' ? $('#pad') : $('#main')).focus(); });

/* ---------- Observadores ---------- */
// Botón flotante «Empezar» en reposo: solo si la partitura está a la vista. Se observa aquí, con todos los scripts ya cargados,
// porque updateFab usa estado de varios de ellos
new IntersectionObserver(es=>{ padInView=es[es.length-1].isIntersecting; updateFab(); }).observe($('#pad'));
// …y no si el botón «Empezar la escena» ya se ve (no se duplican): cuenta como visto si queda al menos medio botón por encima del sitio del flotante
new IntersectionObserver(es=>{ const e=es[es.length-1]; btnInView=e.isIntersecting && e.intersectionRatio>=.5; updateFab(); },{threshold:[0,.5,1],rootMargin:'0px 0px -100px 0px'}).observe($('#bPractice'));
fineMQ.addEventListener('change',()=>{ if(!S.running) padIdle(); });
touchMQ.addEventListener('change',()=>{ updateFab(); if(!S.running) padIdle(); });

/* ---------- Arranque ---------- */
syncControls(); padIdle(); renderMap();
setView(set.view==='escena' ? 'escena' : 'mapa');
if(!set.seen && !Object.keys(prog.scenes).length) showWelcome();
