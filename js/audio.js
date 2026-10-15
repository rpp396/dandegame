// Orquesta desafinada · Audio (Web Audio): contexto, hora de lo que se oye, clic del metrónomo, notas y toques.
// Script clásico (no módulo): comparte el ámbito global con los demás de js/; el orden de carga está en index.html.

/* ---------- Audio ---------- */
let ctx=null, master=null, noiseBuf=null;
function ensureAudio(){
  if(!ctx){
    // iOS (Safari 17+): sin esto Web Audio enmudece con el interruptor de silencio del iPhone
    try{ if(navigator.audioSession) navigator.audioSession.type='playback'; }catch(e){}
    const AC=window.AudioContext||window.webkitAudioContext;
    try{ ctx=new AC({latencyHint:'interactive'}); }catch(e){ ctx=null; appWarn('audio'); return false; }
    master=ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
    noiseBuf=ctx.createBuffer(1, Math.floor(ctx.sampleRate*0.3), ctx.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    // una llamada, Siri o bloquear la pantalla detienen el reloj del audio: la escena o la medición en curso ya no valen
    ctx.addEventListener('statechange',()=>{ if(ctx.state!=='running') stopTimed(); });
  }
  // iOS deja el contexto en 'interrupted' (no solo 'suspended') tras una interrupción
  if(ctx.state!=='running') ctx.resume().catch(()=>{});
  return true;
}
function stopTimed(){ if(S.running && (S.mode==='practice'||S.mode==='calib')) stop(); }
// Al salir de la página se corta la escena o la medición; al volver, el audio se reanuda
document.addEventListener('visibilitychange',()=>{ if(document.hidden) stopTimed(); else if(ctx && ctx.state!=='running') ctx.resume().catch(()=>{}); });
addEventListener('pageshow',()=>{ if(ctx && ctx.state!=='running') ctx.resume().catch(()=>{}); });
// Hora del audio (reloj de ctx) que sonaba por el altavoz en el instante ts (ms de performance.now(), p. ej. e.timeStamp;
// por defecto, ahora). getOutputTimestamp ya descuenta la latencia de salida (leída en cada momento, no al crear el contexto,
// cuando aún vale 0) y no va a saltos como currentTime; si no da datos, currentTime menos la latencia de salida.
function heardAt(ts){
  const pn=performance.now(); let p=+ts; if(!(p>pn-1000 && p<=pn)) p=pn; // sin hora del evento o en otra base: ahora
  try{ const o=ctx.getOutputTimestamp && ctx.getOutputTimestamp();
    if(o && o.contextTime>0 && o.performanceTime>0 && Math.abs(pn-o.performanceTime)<500) return o.contextTime+(p-o.performanceTime)/1000; }catch(e){}
  return ctx.currentTime-(pn-p)/1000-(ctx.outputLatency||ctx.baseLatency||0);
}
// Fuentes programadas y aún sin terminar: stop() las para (desconectar el bus no basta: seguirían gastando CPU hasta su hora)
const liveSrc=new Set();
function track(...ns){ ns.forEach(n=>{ liveSrc.add(n); n.onended=()=>liveSrc.delete(n); }); }
function stopSources(){ const t=ctx.currentTime+0.03; liveSrc.forEach(n=>{ try{ n.stop(t); }catch(e){} }); liveSrc.clear(); }
// lo que ya pasó no se programa (tras una pausa del hilo principal sonaría todo de golpe)
const tooLate=t=>t<ctx.currentTime-0.02;
const CLICK_F={accent:1760,beat:1250,weak:1040}, CLICK_V={accent:1,beat:0.7,weak:0.45};
function click(bus,t,level,vol){
  const v=CLICK_V[level]*(vol==null?set.metroVol:vol); if(v<=0.001 || tooLate(t)) return;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(CLICK_F[level],t);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v*0.9,t+0.002); g.gain.exponentialRampToValueAtTime(0.0001,t+0.055);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t+0.07); track(o);
}
// Golpe de redoblante: la bordonera (ruido con paso alto y un poco de cuerpo en banda) más el parche (tono corto que baja).
// v ≈ volumen (0–1); devuelve las fuentes para poder pararlas
function snare(dest,t,v){
  const n=ctx.createBufferSource(); n.buffer=noiseBuf;
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1200;
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=3200; bp.Q.value=0.7;
  const gn=ctx.createGain(); gn.gain.setValueAtTime(0.0001,t); gn.gain.exponentialRampToValueAtTime(0.9*v,t+0.002); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.19);
  n.connect(hp); hp.connect(bp); bp.connect(gn); gn.connect(dest); n.start(t); n.stop(t+0.22);
  const o=ctx.createOscillator(), o2=ctx.createOscillator(), gb=ctx.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(230,t); o.frequency.exponentialRampToValueAtTime(165,t+0.06);
  o2.type='sine'; o2.frequency.setValueAtTime(340,t); o2.frequency.exponentialRampToValueAtTime(280,t+0.05);
  gb.gain.setValueAtTime(0.0001,t); gb.gain.exponentialRampToValueAtTime(0.75*v,t+0.002); gb.gain.exponentialRampToValueAtTime(0.0001,t+0.1);
  o.connect(gb); o2.connect(gb); gb.connect(dest); o.start(t); o2.start(t); o.stop(t+0.12); o2.stop(t+0.12);
  return [n,o,o2];
}
// Una nota de «Escuchar»: tono sostenido en modo piano (se oye la duración) o golpe de redoblante en modo batería
function noteSound(bus,t,dsec,vol){
  const v=vol==null?set.rhythmVol:vol; if(v<=0.001 || tooLate(t)) return;
  if(set.hold){
    const o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain(), g2=ctx.createGain();
    o.type='triangle'; o.frequency.value=440; o2.type='sine'; o2.frequency.value=880; g2.gain.value=0.25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
    const end=t+Math.max(0.06,dsec*0.86), mid=Math.min(end,t+0.1);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.5*v,t+0.006);
    g.gain.linearRampToValueAtTime(0.32*v,mid); g.gain.setValueAtTime(0.32*v,end); g.gain.linearRampToValueAtTime(0,end+0.035);
    o.start(t); o2.start(t); o.stop(end+0.05); o2.stop(end+0.05); track(o,o2);
  } else {
    track(...snare(bus,t,v));
  }
}

// Sonido del toque del jugador: un tono sostenido hasta soltar en modo piano, un golpe de redoblante en modo batería.
// Va a master (no al bus de la pasada) para que siga sonando mientras se mantiene aunque la escena termine.
const tapVoices=new Map();
function tapSoundOn(src){
  if(!set.tapSound || !ensureAudio()) return;
  tapSoundOff(src);
  const v=set.tapVol; if(v<=0.001) return;
  const t=ctx.currentTime, g=ctx.createGain(); g.connect(master);
  if(set.hold){
    const o=ctx.createOscillator(), o2=ctx.createOscillator(), g2=ctx.createGain();
    o.type='triangle'; o.frequency.value=523.25; o2.type='sine'; o2.frequency.value=1046.5; g2.gain.value=0.2;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.45*v,t+0.006); g.gain.linearRampToValueAtTime(0.3*v,t+0.1);
    o.start(t); o2.start(t);
    tapVoices.set(src,{g,oscs:[o,o2]});
  } else {
    snare(g,t,v);
  }
}
function tapSoundOff(src){
  const vc=tapVoices.get(src); if(!vc) return;
  tapVoices.delete(src);
  const t=ctx.currentTime;
  vc.g.gain.cancelScheduledValues(t); vc.g.gain.setValueAtTime(vc.g.gain.value,t); vc.g.gain.linearRampToValueAtTime(0,t+0.03);
  vc.oscs.forEach(o=>o.stop(t+0.05));
}
