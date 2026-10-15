// Orquesta desafinada · Avance de la gira: guardado en localStorage y validación al leer.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Guardado del avance ---------- */
// prog = {scenes: {G1: {best, stars, tries, pts}, …}}: mejor precisión (%), estrellas (0-3), intentos y récord de puntos por escena
const PKEY='orquesta-desafinada-progreso-v1';
let prog = loadProgLocal();
function emptyProg(){ return {scenes:{}}; }
// Lo guardado no es de fiar (ver «Validación» en datos.js): solo los id de SCENES (nunca las claves del dato), con números en rango
function cleanScenes(o){
  const out={}; if(!isObj(o)) return out;
  SCENES.forEach(s=>{ const v=has(o,s.id) ? o[s.id] : null;
    if(isObj(v)) out[s.id]={best:numIn(v.best,0,100,0,true), stars:numIn(v.stars,0,3,0,true), tries:numIn(v.tries,0,99999,0,true), pts:numIn(v.pts,0,1e7,0,true)}; });
  return out;
}
function cleanProg(p){ const out=emptyProg(); if(isObj(p)) out.scenes=cleanScenes(p.scenes); return out; }
function loadProgLocal(){ try{ return cleanProg(JSON.parse(localStorage.getItem(PKEY)||'null')); }catch(e){} return emptyProg(); }
function commitProg(){ try{ localStorage.setItem(PKEY, JSON.stringify(prog)); }catch(e){ appWarn('store'); } }
