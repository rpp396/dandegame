// Orquesta desafinada · Ajustes: diálogo (forma de tocar, metrónomo, volúmenes, toques, botón flotante, latencia, datos) y su sincronización.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Controles ---------- */
function syncControls(){
  ['metro','tapSound','fab','vibrate'].forEach(id=>{ $('#'+id).checked=!!set[id]; });
  $('#vibrateRow').hidden=!('vibrate' in navigator && touchMQ.matches);
  $('#rhythmVol').value=set.rhythmVol; $('#metroVol').value=set.metroVol; $('#tapVol').value=set.tapVol; $('#offset').value=set.offset;
  syncTapVol(); syncHold(); syncDiff(); updOutputs();
}
function syncTapVol(){ $('#tapVolField').hidden=!set.tapSound; }
function updOutputs(){
  // el texto de cada valor también va a aria-valuetext del deslizador (si no, el lector dice «0.6» o «15» sin unidad)
  const vt=(id,out,txt)=>{ $('#'+out).textContent=txt; $('#'+id).setAttribute('aria-valuetext',txt); };
  vt('rhythmVol','rhythmVolOut',Math.round(set.rhythmVol*100)+'%');
  vt('metroVol','metroVolOut',Math.round(set.metroVol*100)+'%');
  vt('tapVol','tapVolOut',Math.round(set.tapVol*100)+'%');
  const off=(set.offset>0?'+':'')+set.offset+' ms';
  vt('offset','offsetOut',off);
  document.querySelectorAll('.offset-now').forEach(e=>{ e.textContent=off; });
}
// Forma de tocar: hay un selector en la escena y otro en los ajustes (botones con data-hold)
function syncHold(){ document.querySelectorAll('.modeseg button[data-hold]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.hold==='1')===!!set.hold))); }
function setHold(v){ set.hold=!!v; save(); syncHold(); if(S.running && S.mode==='practice') stop(); }
document.querySelectorAll('.modeseg').forEach(m=>m.addEventListener('click',e=>{ const b=e.target.closest('button[data-hold]'); if(b) setHold(b.dataset.hold==='1'); }));
// Dificultad: también un selector en la escena y otro en los ajustes (botones con data-diff). Cambia corazones y tempo: para la pasada
function syncDiff(){ document.querySelectorAll('.diffseg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.diff===set.diff))); }
function setDiff(v){
  const d=oneOf(v,DIFF_IDS,set.diff); if(d===set.diff) return;
  set.diff=d; save(); syncDiff();
  if(S.running && (S.mode==='practice' || S.mode==='play')) stop();
  renderBar(); stageHud();
  say(`Dificultad ${DIFFS[d].name.toLowerCase()}: ${DIFFS[d].long}.`);
}
document.querySelectorAll('.diffseg').forEach(m=>m.addEventListener('click',e=>{ const b=e.target.closest('button[data-diff]'); if(b) setDiff(b.dataset.diff); }));
// el metrónomo vale para los compases que aún no se han programado (no hace falta parar)
$('#metro').addEventListener('change',e=>{ set.metro=e.target.checked; save(); });
$('#tapSound').addEventListener('change',e=>{ set.tapSound=e.target.checked; save(); syncTapVol(); });
['rhythmVol','metroVol','tapVol'].forEach(id=>$('#'+id).addEventListener('input',e=>{ set[id]=numIn(e.target.value,0,1,set[id]); updOutputs(); save(); liveVol(); }));
$('#offset').addEventListener('input',e=>{ set.offset=numIn(e.target.value,-150,250,set.offset,true); updOutputs(); save(); });
$('#fab').addEventListener('change',e=>{ set.fab=e.target.checked; save(); updateFab(); if(!S.running) padIdle(); });
$('#vibrate').addEventListener('change',e=>{ set.vibrate=e.target.checked; save(); });

/* ---------- Diálogo ---------- */
// <dialog> modal: atrapa el foco, Esc lo cierra y al cerrarse el foco vuelve al botón que lo abrió
const dlg=$('#settings');
let dlgFrom=null;
function openSettings(){
  if(S.running){ if(S.mode==='practice') finish(true); else stop(); }
  dlgFrom=document.activeElement;
  syncControls(); dlg.showModal();
}
function closeSettings(){ if(dlg.open) dlg.close(); }
dlg.addEventListener('close',()=>{ const f=dlgFrom; dlgFrom=null; if(f && f.isConnected && !f.closest('[hidden]')) f.focus({preventScroll:true}); });
// un clic fuera de la caja (en el fondo) lo cierra
dlg.addEventListener('click',e=>{ if(e.target===dlg) closeSettings(); });
$('#bSettings').addEventListener('click',openSettings);
$('#setClose').addEventListener('click',closeSettings);
$('#setDone').addEventListener('click',closeSettings);
// Medir latencia: se mide sobre la partitura de la escena abierta
$('#bCalib').addEventListener('click',()=>{ dlgFrom=null; closeSettings(); if(view!=='escena') setView('escena'); startCalib(); });

/* ---------- Datos: restablecer ajustes y borrar el avance ---------- */
const RESET_BTN='<button class="btn" id="resetSet" type="button">Restablecer ajustes</button>';
$('#resetBox').addEventListener('click',e=>{
  const box=$('#resetBox'), id=e.target.closest('button')?.id;
  if(id==='resetSet') askConfirm(box,'¿Volver a los ajustes iniciales? Se conservan tu avance y la corrección de latencia.',['resetYes','Restablecer'],['resetNo','Cancelar']);
  else if(id==='resetYes'){
    const keep={offset:set.offset, seen:set.seen, gameId:set.gameId, view:set.view};
    set={...freshSettings(), ...keep}; save(); syncControls(); updateFab(); renderBar(); stageHud();
    endConfirm(box,RESET_BTN); $('#resetSet').focus(); say('Ajustes restablecidos');
  }
  else if(id==='resetNo'){ endConfirm(box,RESET_BTN); $('#resetSet').focus(); }
});
const CLEAR_BTN='<button class="btn warn" id="pClear" type="button">Borrar el avance</button>';
$('#pClearBox').addEventListener('click',e=>{
  const box=$('#pClearBox'), id=e.target.closest('button')?.id;
  if(id==='pClear') askConfirm(box,'¿Borrar las estrellas, los récords y los intentos de todas las escenas?',['pClearYes','Sí, borrar'],['pClearNo','Cancelar']);
  else if(id==='pClearYes'){
    prog=emptyProg(); commitProg();
    // la escena abierta puede quedar cerrada: se vuelve a la primera
    if(!openAt(sceneIdx)){ if(view==='escena') selectScene(0); else { sceneIdx=0; set.gameId='G1'; save(); } }
    refreshScene(); endConfirm(box,CLEAR_BTN); $('#pClear').focus(); say('Avance borrado');
  }
  else if(id==='pClearNo'){ endConfirm(box,CLEAR_BTN); $('#pClear').focus(); }
});
