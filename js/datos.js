// Orquesta desafinada · Datos musicales (figuras, compases, celdas rítmicas), ajustes y su guardado, avisos y ayudas de accesibilidad.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

const $ = s => document.querySelector(s);
// Claves de localStorage propias del juego (en github.io todos los proyectos de una cuenta comparten origen y localStorage)
const KEY = 'orquesta-desafinada-ajustes-v1';

/* ---------- Datos musicales (1 negra = 12 ticks) ---------- */
// Solo las figuras y compases que usan las escenas
const FIGS = [
  {k:'w',  name:'Redonda'},
  {k:'h',  name:'Blanca'},
  {k:'hd', name:'Blanca con puntillo'},
  {k:'q',  name:'Negra'},
  {k:'qd', name:'Negra con puntillo'},
  {k:'e',  name:'Corchea'},
  {k:'s',  name:'Semicorchea'},
  {k:'t',  name:'Tresillo de corcheas'},
];
// groups: pulsos del compás (para generar y agrupar barras); click: unidad del metrónomo en ticks; kind: simple o compuesto
const SIGS = {
  '2/4':{groups:[12,12],click:12,kind:'simple'},
  '3/4':{groups:[12,12,12],click:12,kind:'simple'},
  '4/4':{groups:[12,12,12,12],click:12,kind:'simple'},
  '6/8':{groups:[18,18],click:18,kind:'compound'},
  '9/8':{groups:[18,18,18],click:18,kind:'compound'},
};
// Celdas rítmicas: cada una declara sus eventos [duración, 1 si es silencio]; un pulso (BEAT) o varios (MULTI)
const SIMPLE_BEAT = [
  {ev:[[12]]},
  {ev:[[6],[6]]},
  {ev:[[3],[3],[3],[3]]},
  {ev:[[6],[3],[3]]},
  {ev:[[3],[3],[6]]},
  {ev:[[3],[6],[3]]},
  {ev:[[4],[4],[4]], tuplet:true},
  {ev:[[12,1]]},
  {ev:[[6,1],[6]]},
  {ev:[[6],[6,1]]},
  {ev:[[3,1],[3],[3],[3]]},
  {ev:[[3],[3],[3,1],[3]]},
  {ev:[[6,1],[3],[3]]},
  {ev:[[3,1],[3],[6]]},
  {ev:[[6],[3,1],[3]]},
];
const SIMPLE_MULTI = [
  {ev:[[24]]},
  {ev:[[36]]},
  {ev:[[48]], wholeBar:true},
  {ev:[[18],[6]]},
  {sync:true, trait:'sinc', ev:[[6],[12],[6]]},
  {sync:true, trait:'qhq', ev:[[12],[24],[12]], wholeBar:true},
  {ev:[[24,1]]},
];
const COMP_BEAT = [
  {ev:[[18]]},
  {ev:[[6],[6],[6]]},
  {ev:[[12],[6]]},
  {ev:[[6],[12]]},
  {ev:[[3],[3],[6],[6]]},
  {ev:[[6],[3],[3],[6]]},
  {ev:[[6],[6],[3],[3]]},
  {ev:[[3],[3],[3],[3],[3],[3]]},
  {ev:[[18,1]]},
  {ev:[[6,1],[6],[6]]},
  {ev:[[6],[6],[6,1]]},
  {ev:[[12],[6,1]]},
  {ev:[[12,1],[6]]},
  {ev:[[3,1],[3],[3],[3],[3],[3]]},
  {ev:[[3,1],[3],[6],[6]]},
  {ev:[[6],[3,1],[3],[6]]},
  {ev:[[6],[6],[3,1],[3]]},
  {trait:'qss', ev:[[12],[3],[3]]},
  {trait:'qss', ev:[[3],[3],[12]]},
  {ev:[[6],[6,1],[6]]},
];
const COMP_MULTI = [ {ev:[[36]]} ];
// Figuras que usa cada celda, derivadas de sus eventos: req = notas, rreq = silencios
const DUR2K = {48:'w',36:'hd',24:'h',18:'qd',12:'q',6:'e',4:'t',3:'s'};
[SIMPLE_BEAT,SIMPLE_MULTI,COMP_BEAT,COMP_MULTI].flat().forEach(c=>{
  const keys=r=>[...new Set(c.ev.filter(e=>!!e[1]===r).map(e=>DUR2K[e[0]]))];
  c.req=keys(false); c.rreq=keys(true); c.rest=c.rreq.length>0;
});
// Silencios de una escena (claves de DUR2K: q, qd, e…)
const restList = C => C.rests || [];

/* ---------- Ajustes ---------- */
// hold: modo piano (se mide también cuándo se suelta); metro: metrónomo durante la escena (la cuenta previa suena siempre);
// rhythmVol: volumen de «Escuchar»; tapSound/tapVol: oír mis toques; fab: botón flotante en pantallas táctiles;
// offset: corrección de latencia (ms, + si se llega tarde); diff: dificultad (ver DIFFS); gameId: escena abierta; view: pantalla ('mapa' o 'escena')
const DEFAULTS = {hold:true, metro:true, metroVol:0.7, rhythmVol:0.6, tapSound:true, tapVol:0.6, fab:true, vibrate:true,
  offset:0, diff:'normal', seen:false, gameId:'', view:'mapa'};
// Dificultad: corazones de la pasada, tempo (factor sobre el de la escena) y si un golpe de más quita corazón.
// Las estrellas piden la misma precisión en las tres; terminar la escena con vida abre la siguiente en cualquiera.
const DIFFS = {
  facil:  {name:'Fácil',   hearts:8, tempo:0.8,  extraHurts:false, long:'8 corazones, el tempo al 80 % y los golpes de más no quitan corazón'},
  normal: {name:'Normal',  hearts:5, tempo:1,    extraHurts:true,  short:'5 corazones', long:'5 corazones y el tempo de la escena'},
  dificil:{name:'Difícil', hearts:3, tempo:1.15, extraHurts:true,  short:'3 corazones, más rápido', long:'3 corazones y el tempo un 15 % más rápido'},
};
const DIFF_IDS = Object.keys(DIFFS);
const diff = () => DIFFS[oneOf(set.diff, DIFF_IDS, 'normal')];

/* ---------- Validación de lo guardado ---------- */
// Todo lo que se lee de localStorage se trata como no fiable: se copian solo campos conocidos, con su tipo y rango,
// y las claves salen de listas cerradas (nunca de propiedades heredadas como «constructor» o «__proto__»).
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const isObj=x=>!!x && typeof x==='object' && !Array.isArray(x);
// Número finito dentro de [lo,hi] (acepta cadenas numéricas); si no, el valor por defecto d
function numIn(v,lo,hi,d,int){ if(typeof v==='string' && v.trim()!=='') v=+v; if(typeof v!=='number' || !isFinite(v)) return d; v=Math.min(hi,Math.max(lo,v)); return int?Math.round(v):v; }
const oneOf=(v,list,d)=>list.includes(v)?v:d;
const strIn=(v,re,d)=>typeof v==='string' && re.test(v) ? v : d;
function cleanSettings(o){
  const D=DEFAULTS, s=freshSettings(); if(!isObj(o)) return s;
  s.offset = numIn(o.offset,-500,500,D.offset,true);
  ['rhythmVol','metroVol','tapVol'].forEach(k=>{ s[k]=numIn(o[k],0,1,D[k]); });
  ['hold','metro','tapSound','fab','vibrate','seen'].forEach(k=>{ s[k]=typeof o[k]==='boolean' ? o[k] : D[k]; });
  s.gameId = strIn(o.gameId,/^G\d{1,3}$/,'');
  s.view = oneOf(o.view,['mapa','escena'],D.view);
  s.diff = oneOf(o.diff,DIFF_IDS,D.diff);
  return s;
}
function load(){
  try{ const raw = localStorage.getItem(KEY); if(raw) return cleanSettings(JSON.parse(raw)); }catch(e){}
  return freshSettings();
}
function freshSettings(){ return {...DEFAULTS}; }
let set = load();
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(set)); }catch(e){ appWarn('store'); } }

/* ---------- Avisos y accesibilidad ---------- */
// Avisos persistentes arriba de la página (no se puede guardar, no hay audio)
const WARNS={store:'Este navegador no deja guardar datos (modo privado o almacenamiento lleno): tus ajustes y tu avance se perderán al cerrar la página.',
  audio:'Tu navegador no permite reproducir audio, así que no se puede jugar. Prueba con otro navegador actualizado.'};
const warnOn=new Set();
function appWarn(k){ if(warnOn.has(k)) return; warnOn.add(k); const w=$('#appWarn'); w.textContent=[...warnOn].map(x=>WARNS[x]).join(' '); w.hidden=false; }
// Anuncio para lectores de pantalla (se vacía antes para que se repita aunque el texto sea el mismo)
function say(t){ const el=$('#srLive'); el.textContent=''; setTimeout(()=>{ el.textContent=t; },60); }
// Escapa un dato antes de meterlo en innerHTML
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Con «reducir movimiento» los desplazamientos suaves pasan a instantáneos (behavior:smooth() en scrollTo / scrollIntoView)
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const smooth = () => reduceMQ.matches ? 'auto' : 'smooth';
// Ayudas de teclado («Espacio para tocar», «Esc para abandonar») solo si hay puntero fino (ratón o trackpad)
const fineMQ = matchMedia('(any-pointer: fine)');
const kbOn = () => fineMQ.matches;
// Repintar con innerHTML sin perder el foco de teclado: recuerda qué control de box lo tenía (por su data-… o su id) y, tras fn(),
// enfoca el equivalente (si ya no se puede, el primer botón activo)
const FOCUS_KEYS = ['data-lv','data-hold','data-diff','id'];
function keepFocus(box, fn){
  const a=document.activeElement; let sel=null;
  if(a && a!==box && box.contains(a)){ const at=FOCUS_KEYS.find(k=>a.hasAttribute(k)); if(at) sel=`[${at}="${CSS.escape(a.getAttribute(at))}"]`; }
  fn();
  if(!sel) return;
  const n=box.querySelector(sel+':not(:disabled)') || box.querySelector('button:not(:disabled)');
  if(n && n!==document.activeElement) n.focus({preventScroll:true});
}
// Confirmación en línea: la pregunta (HTML ya escapado) y «Sí»/«Cancelar» dentro de box, que pasa a ser un grupo con la pregunta como
// nombre (y descripción de «Cancelar»). El foco va a «Cancelar». yes/no = [id, texto]. endConfirm la cierra y deja el contenido html.
let confirmN=0;
function askConfirm(box, q, yes, no){
  const id='cq'+(++confirmN);
  box.innerHTML=`<span id="${id}">${q}</span><button class="btn warn" id="${yes[0]}" type="button">${yes[1]}</button><button class="btn" id="${no[0]}" type="button" aria-describedby="${id}">${no[1]}</button>`;
  box.setAttribute('role','group'); box.setAttribute('aria-labelledby',id);
  $('#'+no[0]).focus();
}
function endConfirm(box, html){ box.removeAttribute('role'); box.removeAttribute('aria-labelledby'); box.innerHTML=html; }
