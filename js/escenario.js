// Orquesta desafinada · El escenario: sprites en pixel art, director y enemigos en <canvas>, marcador (corazones, combo y puntos),
// reglas del juego (aciertos, notas sin tocar, golpes de más, notas largas soltadas antes, telón), bestiario y resultado de la escena.
// Script clásico (no módulo). Su estado interno (sprites, actores, canvas) va en un IIFE; al ámbito global solo salen sus entradas
// (ver el Object.assign del final), a las que llaman el transporte y la evaluación: gameStart, gameStop, gameTap, gameRelease…
(()=>{
'use strict';

/* ---------- Enemigos y golpes ---------- */
// fx: golpe del director (movimiento de la batuta, del cuerpo y su efecto); death: cómo cae el enemigo afinado (ver burst y drawDying)
const FOES={
  negra:{fig:'Negra', name:'Nota gruñona', hit:'Batutazo: salta y la aplasta contra las tablas', fx:'batuta', death:'squash', spr:'o_negra'},
  corchea:{fig:'Corchea', name:'Nota con banderín', hit:'Tajo rápido que la parte en dos (sola; si va unida por barra a otras, forma una banda)', fx:'corte', death:'split', spr:'o_corchea'},
  semicorchea:{fig:'Semicorchea', name:'Nota de dos banderines', hit:'Trémolo eléctrico: un rayo que la hace estallar en pedazos (sola o dentro de una banda)', fx:'tremolo', death:'shatter', spr:'o_semicorchea'},
  tresillo:{fig:'Tresillo', name:'Trío desafinado', hit:'Giro de batuta en cada nota; al tercero sale girando', fx:'giro', death:'spin', spr:'o_tresillo'},
  // grupo de corcheas o semicorcheas unidas por barra: un solo enemigo que recibe un golpe por nota (el de cada figura: tajo o
  // trémolo) y cae con el último, como lo haría esa figura. spr según cuántas notas y barras tiene (o_g<n>_<barras>, ver groupRows)
  grupo:{fig:'Grupo con barra', name:'Banda de banderines', hit:'Un solo enemigo para todo el grupo: un golpe por nota (tajo en las corcheas, trémolo en las semicorcheas); cae con el último', fx:'corte', death:'split', spr:'o_g2_1'},
  blanca:{fig:'Blanca', name:'Nota blanca', hit:'Rayo sostenido: en piano, mantén lo que dura (si sueltas antes, contraataca); al acabar sube convertida en notas', fx:'sost', death:'ascend', spr:'o_blanca'},
  redonda:{fig:'Redonda', name:'Redonda, jefa de la escena', short:'Jefa de la escena', hit:'Calderón largo: como la blanca, mantén lo que dura', fx:'sost', death:'ascend', spr:'o_redonda'},
  silencio:{fig:'Silencio', name:'Silencio fantasma', hit:'No se toca: si lo golpeas, pierdes un corazón (en fácil, solo se ríe)', fx:'', death:'', spr:'o_silencio'},
};
const LONG=new Set(['blanca','redonda']);   // notas que en modo piano hay que sostener
function kindOf(e){ if(e.rest) return 'silencio'; if(e.tuplet) return 'tresillo'; const d=e.dur; return d>=48?'redonda':d>=24?'blanca':d>=12?'negra':d>=6?'corchea':'semicorchea'; }
const dotted=e=>!e.rest && [36,18].includes(e.dur);   // variante con puntillo del mismo enemigo
const figKey=e=>e.rest?'r':e.tuplet?'t':DUR2K[e.dur];
const MULT=c=>Math.min(4,1+Math.floor(c/5));   // multiplicador de combo: ×2 desde 5 aciertos seguidos, ×3 desde 10, ×4 desde 15
const GRACE=0.06;   // margen tras la ventana de la nota antes de darla por no tocada (el toque llega con su e.timeStamp algo después)

/* ---------- Sprites (pixel art 16×16, ambientación «Orquesta desafinada») ---------- */
const PAL={K:'#1b1424',k:'#3a2f4a',W:'#f4f1ea',w:'#cfc9d8',Q:'#3c3c3c',T:'#ffd9b0',R:'#d9413a',E:'#ffffff',Y:'#f2c14e'};
// el director va sin batuta: se dibuja aparte, desde la mano (columna 12, fila 8), para poder moverla
const SPR={
o_heroe:['................','.....KKKKK......','....KkkkkkK.....','....KTTTTTK.....','....KTKTKTK.....','....KTTTTTK.....','.....KTTTK......','....KKRRRKK.....','...KQQWWWQQKT...','...KQQWWWQQK....','...KTQWWWQK.....','....KQQWQQK.....','....KQQKQQK.....','....KQQKQQK.....','...KKKK.KKKK....','................'],
o_negra:['................','..........K.....','..........K.....','..........K.....','..........K.....','..........K.....','..........K.....','..........K.....','......KKKKK.....','....KKKKKKKK....','...KKEEKKEEKK...','...KKERKKERKK...','...KKKKKKKKKK...','....KKRRRRKK....','.....KKKKKK.....','................'],
o_corchea:['................','..........KKK...','..........KKKK..','..........K.KKK.','..........K..KK.','..........K...K.','..........K.....','..........K.....','......KKKKK.....','....KKKKKKKK....','...KKEEKKEEKK...','...KKERKKERKK...','...KKKKKKKKKK...','....KKRRRRKK....','.....KKKKKK.....','................'],
o_semicorchea:['................','..........KKK...','..........KKKK..','..........K.KKK.','..........KKK.K.','..........KKKK..','..........K.KKK.','..........K..KK.','......KKKKK...K.','....KKKKKKKK....','...KKEEKKEEKK...','...KKERKKERKK...','...KKKKKKKKKK...','....KKRRRRKK....','.....KKKKKK.....','................'],
o_tresillo:['......YYY.......','........Y.......','......YYY.......','........Y.......','..KKKKYYYKKKK...','..K....K....K...','..K....K....K...','..K....K....K...','..K....K....K...','.KK...KK...KK...','KKKK.KKKK.KKKK..','KEKE.KEKE.KEKE..','KKKK.KKKK.KKKK..','.KK...KK...KK...','................','................'],
o_blanca:['................','..........K.....','..........K.....','..........K.....','..........K.....','..........K.....','..........K.....','......KKKKK.....','....KKWWWWKK....','...KWWWWWWWWK...','..KWWEKWWEKWWK..','..KWWKKWWKKWWK..','..KWWWWWWWWWWK..','...KWWRRRRWWK...','....KKKKKKKK....','................'],
o_redonda:['................','................','................','....KKKKKKKK....','..KKWWWWWWWWKK..','.KWWWWKKKKWWWWK.','KWWEEWKKKKWEEWWK','KWWEKWK..KWEKWWK','KWWWWWK..KWWWWWK','KWWWWWKKKKWWWWWK','.KWWRRRRRRRRWWK.','..KKWWWWWWWWKK..','....KKKKKKKK....','...YY......YY...','..Y..........Y..','................'],
o_silencio:['................','......K.........','.......K........','......KK........','.....KKK........','....KKK.........','...KKK..........','....KKK.........','.....KKK........','....KK..........','...KK...........','...K.KK.........','....KKK.........','................','................','................'],
};
// Bandas (grupos con barra) de n = 2 a 4 notas con 1 o 2 barras: cabezas con ojos y boca, plicas a la derecha y barras arriba.
// GROUP_HX: centro de cada cabeza (en píxeles del sprite), para marcar las notas ya afinadas y hacerlas saltar
const GROUP_MAX=4, GROUP_HX={o_tresillo:[2,7,12]};
function groupRows(n, beams){
  const w=n<=3?4:3, off=Math.floor((16-(n*w+n-1))/2), rows=Array.from({length:16},()=>[...'.'.repeat(16)]);
  const head=w===4?['.KK.','KKKK','KEKE','KRRK','.KK.']:['.KK','KKK','EKE','KRK','.K.'], hx=[];
  for(let i=0;i<n;i++){ const x0=off+i*(w+1); hx.push(x0+(w-1)/2);
    head.forEach((r,dy)=>{ for(let k=0;k<w;k++) if(r[k]!=='.') rows[9+dy][x0+k]=r[k]; });
    for(let y=3;y<=9;y++) rows[y][x0+w-1]='K'; }
  const a=off+w-1, b=off+(n-1)*(w+1)+w-1;
  for(let x=a;x<=b;x++){ rows[3][x]='K'; if(beams>1) rows[5][x]='K'; }
  return {rows:rows.map(r=>r.join('')), hx};
}
for(let n=2;n<=GROUP_MAX;n++) for(const bm of [1,2]){ const k=`o_g${n}_${bm}`, r=groupRows(n,bm); SPR[k]=r.rows; GROUP_HX[k]=r.hx; }
// Puntillo: un punto a la derecha de la cabeza (fila 11)
function dotRows(rows){ return rows.map((r,y)=>{ if(y!==11) return r; const c=Math.min(15,r.replace(/\.+$/,'').length+1); return r.slice(0,c)+'K'+r.slice(c+1); }); }
const sprC={}, footC={};
const rowsOf=key=>key.endsWith('.') ? dotRows(SPR[key.slice(0,-1)]) : SPR[key];
// mode: '' normal · 'w' silueta clara (borde para que se vea sobre el escenario oscuro) · 'f' blanca (destello) · 'r' roja (herida) · 'g' fantasma
function sprite(key, mode){
  const k=key+'|'+mode; if(sprC[k]) return sprC[k];
  const rows=rowsOf(key);
  const c=document.createElement('canvas'); c.width=16; c.height=16; const x=c.getContext('2d');
  const col=ch=>mode==='w'?'#f2e6c9':mode==='f'?'#ffffff':mode==='r'?'#d9413a':mode==='g'?(ch==='K'?'#d8cfe6':PAL[ch]):PAL[ch];
  rows.forEach((r,y)=>{ for(let i=0;i<16;i++){ const ch=r[i]; if(ch==='.') continue; x.fillStyle=col(ch); x.fillRect(i,y,1,1); } });
  return sprC[k]=c;
}
// fila (en píxeles del sprite) donde acaba el dibujo: para apoyar los pies en el suelo
function foot(key){ if(footC[key]!=null) return footC[key]; const rows=SPR[key.replace(/\.$/,'')]; let f=16; while(f>0 && !/[^.]/.test(rows[f-1])) f--; return footC[key]=f; }
// Miniatura de un sprite como imagen data: (la CSP permite img-src data:), para el bestiario y el mapa
const thumbs={};
function thumb(key){ if(thumbs[key]) return thumbs[key]; const c=document.createElement('canvas'); c.width=c.height=48; const x=c.getContext('2d'); x.imageSmoothingEnabled=false; x.drawImage(sprite(key,''),0,0,48,48); return thumbs[key]=c.toDataURL(); }
const BOSS_SPR={w:'o_redonda',e:'o_corchea',t:'o_tresillo',qd:'o_negra.'};

/* ---------- Letras en pixel art (5 de alto) ---------- */
const GLYPHS={A:'.##.|#..#|####|#..#|#..#',B:'###.|#..#|###.|#..#|###.',C:'.###|#...|#...|#...|.###',D:'###.|#..#|#..#|#..#|###.',E:'####|#...|###.|#...|####',F:'####|#...|###.|#...|#...',G:'.###|#...|#.##|#..#|.###',H:'#..#|#..#|####|#..#|#..#',I:'###|.#.|.#.|.#.|###',J:'..#|..#|..#|#.#|.#.',K:'#..#|#.#.|##..|#.#.|#..#',L:'#...|#...|#...|#...|####',M:'#...#|##.##|#.#.#|#...#|#...#',N:'#..#|##.#|#.##|#..#|#..#',O:'.##.|#..#|#..#|#..#|.##.',P:'###.|#..#|###.|#...|#...',Q:'.##.|#..#|#..#|#.#.|.#.#',R:'###.|#..#|###.|#.#.|#..#',S:'.###|#...|.##.|...#|###.',T:'###|.#.|.#.|.#.|.#.',U:'#..#|#..#|#..#|#..#|.##.',V:'#...#|#...#|.#.#.|.#.#.|..#..',W:'#...#|#...#|#.#.#|##.##|#...#',X:'#..#|#..#|.##.|#..#|#..#',Y:'#...#|.#.#.|..#..|..#..|..#..',Z:'####|..#.|.#..|#...|####',
  'Ó':'..##|....|.##.|#..#|#..#|#..#|.##.','Í':'.##|...|###|.#.|.#.|.#.|###','Á':'..##|....|.##.|#..#|####|#..#|#..#','É':'..##|....|####|#...|###.|#...|####',
  0:'###|#.#|#.#|#.#|###',1:'.#.|##.|.#.|.#.|###',2:'###|..#|###|#..|###',3:'###|..#|###|..#|###',4:'#.#|#.#|###|..#|..#',5:'###|#..|###|..#|###',6:'###|#..|###|#.#|###',7:'###|..#|.#.|.#.|.#.',8:'###|#.#|###|#.#|###',9:'###|#.#|###|..#|###',
  '!':'#|#|#|.|#','¡':'#|.|#|#|#','+':'...|.#.|###|.#.|...','-':'...|...|###|...|...','×':'...|#.#|.#.|#.#|...',' ':'..|..|..|..|..'};
const glyph=ch=>{ const s=GLYPHS[ch]||GLYPHS[' ']; const rows=s.split('|'); return {rows, w:rows[rows.length-1].length}; };
const textW=(s,sc)=>[...s].reduce((w,ch)=>w+(glyph(ch).w+1)*sc,0)-sc;
// texto centrado en cx con sombra; las letras con tilde tienen una fila más arriba
function text(s, cx, y, col, sc=1, alpha=1){
  let x=Math.round(cx-textW(s,sc)/2); g.globalAlpha=alpha;
  for(const ch of s){ const {rows,w}=glyph(ch), top=y-(rows.length-5)*sc;
    for(const [dx,c] of [[sc,'#0f0b16'],[0,col]]){ g.fillStyle=c; rows.forEach((r,ry)=>{ for(let i=0;i<r.length;i++) if(r[i]==='#') g.fillRect(x+i*sc+dx, top+ry*sc+dx, sc, sc); }); }
    x+=(w+1)*sc; }
  g.globalAlpha=1;
}

/* ---------- Escenario ---------- */
const W=240, H=110, FLOOR=77, DX=40, DY=34, HAND=[77,59];   // director a escala 3 (pies en y = 79); la mano sostiene la batuta
let cv=null, g=null, PX=1, raf=0, bgC=null;
function background(){
  if(bgC) return bgC;
  const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const r=(col,a,b,w,h)=>{ x.fillStyle=col; x.fillRect(a,b,w,h); };
  r('#2a1f3a',0,0,W,H);
  // suelo de madera: tablas con juntas al tresbolillo
  r('#8f5a2a',0,FLOOR,W,H-FLOOR); r('#5a3416',0,FLOOR,W,3);
  [[80,91],[92,103],[104,110]].forEach(([a,b],k)=>{ r('#7a4a22',0,a,W,1); for(let i=(k%2)*17;i<W;i+=34) r('#7a4a22',i,a+1,1,b-a-1); });
  // foco dorado sobre el centro (elipse en escalones de un píxel), más intenso en el centro
  [[66,44,.10],[44,30,.07]].forEach(([rx,ry,a])=>{ x.fillStyle=`rgba(242,193,78,${a})`;
    for(let yy=-ry; yy<=ry; yy++){ const hw=Math.round(rx*Math.sqrt(1-(yy/ry)**2)); x.fillRect(120-hw, 50+yy, hw*2, 1); } });
  // telón rojo a los lados, con pliegues, y bambalina arriba con ondas
  [[0,1],[W-23,-1]].forEach(([x0])=>{ r('#8e2222',x0,0,23,H); [3,10,17].forEach((f,k)=>r(k===1?'#6e1818':'#7a1c1c',x0+f,0,k===1?3:2,H)); r('#a52a2a',x0+(x0?0:21),0,2,H); });
  r('#a52a2a',0,0,W,8); for(let i=0;i<W;i+=12){ r('#a52a2a',i+2,8,8,2); r('#a52a2a',i+4,10,4,1); } r('#6e1818',0,7,W,1);
  return bgC=c;
}
// resolución interna: múltiplo entero de 240×110 según el ancho y la densidad de la pantalla (el CSS lo escala pixelado)
function fit(){
  if(!cv) return;
  const w=$('#gStage').clientWidth||W, k=Math.max(1,Math.min(8,Math.round(w*(devicePixelRatio||1)/W)));
  if(k!==PX || cv.width!==W*k){ PX=k; cv.width=W*k; cv.height=H*k; }
}
const reduce=()=>reduceMQ.matches;   // movimiento reducido: sin sacudidas, destellos ni partículas
const now=()=>performance.now()/1000;

/* ---------- Estado de la pasada ---------- */
let run=null;          // pasada en curso o la última: {demo, live, hearts, max, extraHurts, combo, maxCombo, pts, evs, ptr, groups, hits, nHeads, lost, vary}
let actors=[], parts=[], texts=[], dir={a:'idle',t0:0}, shake=-9, curtain={c0:0,c1:0,t0:0,dur:0}, banner=null;
const curtainAt=pn=>{ const c=curtain; if(pn>=c.t0+c.dur || !c.dur) return c.c1; return c.c0+(c.c1-c.c0)*Math.max(0,(pn-c.t0)/c.dur); };
function setCurtain(to, dur){ const pn=now(); curtain={c0:curtainAt(pn), c1:to, t0:pn, dur:reduce()?0:dur}; }
// hora del audio (heardAt) → hora de las animaciones (performance.now): todas las animaciones van en esta
const toPn=(t,h,pn)=>pn-(h-t);

// Cada enemigo: una figura escrita (el tresillo, uno para sus tres notas). st: enter → stand → hit/held → dying, o attack → leave;
// ghost (silencio que pasa flotando) y calm (nota ligada: no se toca, se va sola)
function slotX(big){
  const step=big?26:18, base=big?98:104, used=actors.filter(a=>['enter','stand','hit','held','calm'].includes(a.st)).map(a=>a.x);
  for(let i=0;i<4;i++){ const x=base+i*step; if(!used.includes(x)) return x; }
  return base;
}
function spawn(x, pt){
  if(x.actor) return x.actor;
  if(x.gk && run.groups.has(x.gk)) return x.actor=run.groups.get(x.gk);
  const e=x.e, sc=scene(), big=!!sc.boss && figKey(e)===sc.boss && !e.tie, spt=S.spt, kind=x.gk?x.gkind:x.kind;
  const key=x.gk?x.gkey:FOES[kind].spr+(dotted(e)?'.':''), len=(x.gk?x.glen:e.rest||e.tie?e.dur:e.len)*spt;
  // v: variante del golpe (0/1), alterna entre enemigos seguidos (tajo de ida y de vuelta, batutazo por arriba y por abajo)
  // heads: notas que hay que afinar (más de una en un grupo con barra o un tresillo); marks: 'hit' o 'miss' de cada una, en orden
  const a={kind, key, big, s:big?4:3, x:big?98:104, t0:pt, te:Math.min(0.12,Math.max(0.05,len*0.4)), end:pt+len, st:'enter', heads:x.gk?x.gn:1, done:0, flash:-9, laugh:-9,
    marks:[], hx:GROUP_HX[key]||[], death:FOES[x.gk?x.kind:kind].death, v:(run.vary++)%2};
  if(e.rest){ a.st='ghost'; a.life=Math.max(0.9,len); a.s=3; }
  else { a.x=slotX(big); if(e.tie) a.calm=true; }
  actors.push(a); x.actor=a; if(x.gk) run.groups.set(x.gk,a);
  if(x.gk && kind==='grupo') cap(`Banda de ${x.gn} notas → un golpe por nota`, null);
  else if(x.head) cap(`${FOES[kind].fig}${dotted(e)?' con puntillo':''} → ${FOES[kind].short||FOES[kind].name}`, null);
  else if(e.rest) cap('Silencio → fantasma: no se toca', null);
  return a;
}
// Duración de cada forma de caer (con movimiento reducido, todas son un fundido de 0,35 s sin partículas)
const DIE_T={squash:.4, split:.5, shatter:.04, spin:.5, ascend:.8};
function die(a,pn){ a.st='dying'; a.t1=pn; a.dd=reduce()?.35:(DIE_T[a.death]||.35); if(!reduce()) burst(a,pn); }
// Partículas: px (cuadrado de sz píxeles con gravedad gr), note (corchea de 4×5), ring (onda que crece; ry la aplasta), star (destello en cruz)
const P=o=>parts.push({t0:now(), sz:1, gr:40, vx:0, vy:0, ...o});
const rnd=(a,b)=>a+Math.random()*(b-a);
function burst(a,pn){
  const [x,y]=pos(a,pn), s=a.s, c=center(a,pn);
  switch(a.death){
    case 'squash':   // polvo a los lados y una onda en las tablas
      for(let i=0;i<10;i++){ const d=i%2?1:-1; P({x:c[0]+d*rnd(2,6)*s, y:77, vx:d*rnd(20,55), vy:-rnd(8,28), life:rnd(.35,.55), col:i%3?'#c9a27a':'#f4f1ea', sz:2, gr:70}); }
      P({kind:'ring', x:c[0], y:78, r0:3, r1:9*s, ry:.22, life:.35, col:'#f2c14e'});
      break;
    case 'split':    // chispas a lo largo del tajo
      for(let i=0;i<8;i++){ const k=i/7; P({x:c[0]-12+24*k, y:c[1]+(a.v?6:-6)*(1-2*k), vx:rnd(-20,20), vy:-rnd(10,35), life:rnd(.25,.4), col:i%2?'#ffffff':'#cfc9d8'}); }
      break;
    case 'shatter': {   // estalla: cada píxel del sprite sale despedido
      rowsOf(a.key).forEach((r,ry)=>{ for(let i=0;i<16;i++){ const ch=r[i]; if(ch==='.') continue;
        const px=x+i*s, py=y+ry*s, dx=px-c[0], dy=py-c[1], d=Math.hypot(dx,dy)||1, sp=rnd(35,95);
        P({x:px, y:py, vx:dx/d*sp+rnd(-10,10), vy:dy/d*sp-rnd(20,45), life:rnd(.4,.75), col:PAL[ch], sz:s, gr:170}); } });
      P({kind:'star', x:c[0], y:c[1], r1:10, life:.22, col:'#ffffff'});
      break; }
    case 'spin':     // el trío sale girando y suelta sus tres notas
      for(let k=0;k<3;k++){ const an=-Math.PI/2+(k-1)*0.85; P({kind:'note', x:c[0]-2, y:c[1]-8, vx:Math.cos(an)*50, vy:Math.sin(an)*50, life:.65, col:'#f2c14e', gr:35}); }
      break;
    case 'ascend':   // sube convertida en notas
      for(let k=0;k<7;k++) P({kind:'note', x:c[0]-18+k*6+rnd(0,3), y:c[1]-rnd(0,14), vx:rnd(-6,6), vy:-rnd(22,42), life:rnd(.8,1.1), col:k%2?'#f2c14e':'#f4f1ea', gr:0, sway:1});
      P({kind:'ring', x:c[0], y:c[1], r0:4, r1:12*s, ry:.7, life:.45, col:'#f2c14e'});
      break;
  }
}
// Efecto de un acierto: el director golpea con el movimiento de esa figura
const SAY_EXACT=['¡AFINADA!','¡PERFECTA!','¡EXACTA!'], SAY_GOOD=['¡BIEN!','¡AFINADA!'];
const pick=l=>l[Math.floor(Math.random()*l.length)];
function strike(x, pn, cls, gain){
  const a=x.actor, fx=FOES[x.kind].fx;
  if(a.heads>1){ a.done++; a.flash=pn; a.marks[x.hi]='hit'; a.death=FOES[x.kind].death;   // cae como la figura del último golpe
    if(a.done+(a.missed||0)>=a.heads){ a.st='hit'; a.t1=pn; } }
  else if(LONG.has(x.kind)){ a.st='held'; a.t1=pn; }
  else { a.st='hit'; a.t1=pn; }
  dir={a:'strike', fx, t0:pn, tgt:a, v:a.v};
  const c=center(a,pn);
  if(!reduce()){
    // destello del acierto: anillo dorado y cruz en el exacto, anillo blanco en el bien, nada en el cerca
    if(cls==='exact'){ P({kind:'ring', x:c[0], y:c[1], r0:3, r1:16, life:.3, col:'#f2c14e', t0:pn}); P({kind:'star', x:c[0], y:c[1]-4, r1:7, life:.2, col:'#ffffff', t0:pn}); }
    else if(cls==='good') P({kind:'ring', x:c[0], y:c[1], r0:3, r1:10, life:.25, col:'#f4f1ea', t0:pn});
    // cada nota afinada de un trío o de una banda salta como una corchea dorada
    if(a.heads>1 && a.hx.length){ const [ax,ay]=pos(a,pn), hx=ax+Math.round(a.hx[x.hi]*a.s); P({kind:'note', x:hx-2, y:ay+8*a.s, vx:rnd(-12,12), vy:-55, life:.5, col:'#f2c14e', gr:90, t0:pn}); }
  }
  if(run.demo) return;
  const top=a.big?24:34;
  if(cls==='near') texts.push({s:'CERCA', x:c[0], y:top, col:'#f4f1ea', t0:pn, dur:.6, sc:1});
  else texts.push({s:pick(cls==='exact'?SAY_EXACT:SAY_GOOD), x:Math.min(190,Math.max(60,c[0])), y:top-8, col:cls==='exact'?'#f2c14e':'#f4f1ea', t0:pn, dur:.7, sc:cls==='exact'?2:1});
  texts.push({s:'+'+gain, x:c[0]+14, y:top+(cls==='exact'?6:4), col:'#f4f1ea', t0:pn, dur:.6, sc:1});
  if(cls!=='near' && run.combo>=5 && run.combo%5===0) texts.push({s:`COMBO ×${MULT(run.combo)}`, x:W/2+20, y:14, col:'#f2c14e', t0:pn, dur:.9, sc:2});
}
// La nota (o un silencio, o una nota larga soltada antes) ataca al director: pierde un corazón
function hurt(why, pn, a){
  if(a && a.st!=='ghost'){ a.st='attack'; a.t1=pn; }
  if(a && a.st==='ghost') a.laugh=pn;
  run.hearts=Math.max(0,run.hearts-1); run.combo=0;
  dir={a:'hurt', t0:pn}; shake=pn;
  texts.push({s:'¡AY!', x:DX+24, y:22, col:'#e05a8a', t0:pn, dur:.7, sc:2});
  const what={miss:'Nota sin tocar', extra:'Golpe de más', early:'Soltaste antes la nota larga'}[why];
  cap(null, `${{miss:'Sin tocar',extra:'De más',early:'Soltaste antes'}[why]} · −1 ♥`); hud();
  if(!run.hearts){ defeat(pn); return; }
  say(`${what}: pierdes un corazón. Te ${run.hearts===1?'queda 1 corazón':'quedan '+run.hearts+' corazones'}.`);
}
function center(a,pn){ const p=pos(a,pn); return [p[0]+8*a.s, p[1]+(a.kind==='redonda'?8:11)*a.s]; }

/* ---------- Entradas desde el transporte y la evaluación ---------- */
// start(): pasada de la escena o «Escuchar» (en esta, el director afina él solo cada nota: sirve de demostración)
function gameStart(){
  if(S.mode!=='practice' && S.mode!=='play'){ run=null; return; }
  const demo=S.mode==='play', off=demo?0:S.off, byI=new Map(S.notes.map(n=>[n.i,n]));
  // Grupos (tresillos y notas unidas por barra, e.bg de generate): las notas que se tocan de cada uno; con 2 a GROUP_MAX, un solo enemigo
  const grp=new Map(); score.flat.forEach(e=>{ if(e.bg && !e.rest && !e.tie){ if(!grp.has(e.bg)) grp.set(e.bg,[]); grp.get(e.bg).push(e); } });
  const evs=score.flat.map(e=>{ const kind=kindOf(e), x={e, kind, rel:e.abs*S.spt+off, n:byI.get(e.i)||null, head:!e.rest&&!e.tie, gk:null, hit:false, missed:false, actor:null};
    const g=x.head && e.bg ? grp.get(e.bg) : null;
    if(g && g.length>1 && g.length<=GROUP_MAX){ const last=g[g.length-1], tup=g.some(t=>t.tuplet);
      Object.assign(x, {gk:e.bg, gn:g.length, hi:g.indexOf(e), glen:last.abs+last.len-g[0].abs, gkind:tup?'tresillo':'grupo',
        gkey:tup?'o_tresillo':`o_g${g.length}_${g.some(t=>t.dur===3)?2:1}`}); }
    return x; });
  const D=diff();
  run={demo, live:true, hearts:D.hearts, max:D.hearts, extraHurts:D.extraHurts, vary:0, combo:0, maxCombo:0, pts:0, evs, ptr:0, groups:new Map(), hits:0, nHeads:evs.filter(x=>x.head).length, lost:false};
  actors=[]; parts=[]; texts=[]; banner=null; dir={a:'idle',t0:0};
  if(curtainAt(now())>0) setCurtain(0,.6);
  hud(); cap('', demo?'Escucha: el director afina cada nota':'Toca en cada nota');
  wake();
}
function gameStop(){ if(run) run.live=false; wake(); }
// tap() en directo: n = nota asignada (o null = golpe de más), cls = exact/good/near
function gameTap(n, cls){
  if(!run || !run.live || run.demo) return;
  const pn=now();
  if(!n){ const gh=actors.find(a=>a.st==='ghost');
    if(run.extraHurts){ hurt('extra', pn, gh||null); return; }
    // fácil: el golpe de más solo corta el combo (y resta en la precisión); el fantasma se ríe igual
    if(gh) gh.laugh=pn; run.combo=0;
    texts.push({s:'¡UY!', x:DX+24, y:22, col:'#f4f1ea', t0:pn, dur:.6, sc:2});
    cap(null, 'De más · sin perder corazón'); hud(); wake(); return; }
  const x=run.evs.find(v=>v.n===n);
  if(!x || x.hit || x.missed) return;   // ya dada por no tocada (el toque llegó tarde al manejador): no cuenta dos veces
  x.hit=true; run.hits++;
  spawn(x, pn);   // si se toca un poco antes de su tiempo (dentro de la ventana), sube ya
  let gain;
  if(cls==='near'){ run.combo=0; gain=50; }
  else { run.combo++; run.maxCombo=Math.max(run.maxCombo,run.combo); gain=(cls==='exact'?100:80)*MULT(run.combo); }
  run.pts+=gain;
  strike(x, pn, cls, gain);
  cap(null, `${cls==='exact'?'Crítico':cls==='good'?'Bien':'Cerca'} · +${gain}`); hud(); wake();
}
// release() en modo piano: soltar claramente antes (más de lo aceptable) una blanca o una redonda hace que contraataque
function gameRelease(rec){
  if(!run || !run.live || run.demo || !rec || !rec.n) return;
  const x=run.evs.find(v=>v.n===rec.n); if(!x || !x.actor || !LONG.has(x.kind) || x.actor.st!=='held') return;
  const n=x.n, tol=Math.max(0.14,0.3*n.dsec);
  if(rec.rel < n.t+n.dsec-tol){ const pn=now(); x.actor.countered=true; hurt('early', pn, x.actor); }
}
// Esc o «Detener» en mitad de la escena: se abandona (sin resultados); si se llegó a tocar, cuenta como intento
function gameAbandon(played){
  if(played) addTry();
  setHeld(false);
  say('Escena abandonada. Pulsa «Empezar la escena» para empezarla de nuevo.');
  cap('', 'Escena abandonada'); wake();
}
function addTry(){ const id=scene().id, v=sceneSt(sceneIdx); prog.scenes[id]={...v, tries:v.tries+1}; commitProg(); refreshScene(); }
// 0 corazones: telón. Se detiene la escena sin los resultados de precisión, pero suma un intento
function defeat(pn){
  run.live=false; run.lost=true;
  const bar=Math.min(score.bars, Math.max(1, Math.floor((heardAt()-S.passStart-S.off)/(score.L*S.spt))+1));
  addTry();
  stop(); setHeld(false);
  setCurtain(1,.8); banner={s:'TELÓN', t0:pn};
  const r=$('#results'); r.classList.add('lost');
  $('#gResHead').textContent='Telón'; $('#gResStars').hidden=true;
  $('#gResText').textContent=`Te has quedado sin corazones en el compás ${bar}. Escucha la escena con «Escuchar», lee la partitura y vuelve a intentarlo.`;
  stats([['Puntos',fmtN(run.pts)],['Combo máximo','×'+run.maxCombo],['Notas afinadas',`${run.hits} de ${run.nHeads}`]]);
  $('#gNext').hidden=!nextOK(); $('#gNext').classList.remove('primary'); $('#gRetry').classList.add('primary');
  r.hidden=false; updateFab();
  say(`Telón: te has quedado sin corazones en el compás ${bar}. ${fmtN(run.pts)} puntos. Pulsa «Reintentar» para volver a empezar la escena.`);
  r.focus({preventScroll:true}); revealBlock($('#gRes'),$('#gRes'));
  wake();
}
function stats(list){ $('#gResStats').innerHTML=list.map(([k,v])=>`<li>${esc(k)}: <b>${esc(v)}</b></li>`).join(''); }
// showResults(): la escena acabó sin perder los corazones. Guarda el avance (prog.scenes) y pinta el bloque de arriba
function gameAfter(pct){
  const res=$('#results'); res.classList.remove('lost');
  // se llegó al final con vida: la escena queda superada (clear) y se abre la siguiente, con estrellas o sin ellas
  const s=scene(), prev=sceneSt(sceneIdx), stars=starsOf(s,pct), wasLocked=sceneIdx<SCENES.length-1 && !openAt(sceneIdx+1), pts=run?run.pts:0;
  const hearts=run?run.hearts:diff().hearts, maxH=run?run.max:diff().hearts;
  prog.scenes[s.id]={best:Math.max(prev.best,pct), stars:Math.max(prev.stars,stars), tries:prev.tries+1, pts:Math.max(prev.pts,pts), clear:1};
  commitProg(); refreshScene();
  $('#gResHead').textContent = '¡Escena superada!';
  $('#gResStars').hidden=false; $('#gResStars').innerHTML=starStr(stars); $('#gResStars').setAttribute('aria-label',starsTxt(stars));
  const last=sceneIdx===SCENES.length-1;
  const lead = last ? '¡Has completado la gira de conciertos!' : wasLocked ? 'Se abre la siguiente escena.' : stars ? 'La orquesta suena afinada.' : 'Llegaste al final con vida.';
  $('#gResText').textContent = lead + (stars===3 ? ' Tres estrellas: ¡ovación!'
    : stars ? ` Para ${stars===1?'dos':'tres'} estrellas necesitas ${stars===1?s.s2:s.s3}% de precisión.`
    : ` Para la primera estrella te faltan ${s.goal-pct} puntos de precisión (objetivo ${s.goal}%).`);
  stats([['Precisión',pct+'%'],['Puntos',fmtN(pts)+(pts>prev.pts&&prev.pts?' (récord)':'')],['Combo máximo','×'+(run?run.maxCombo:0)],['Corazones',`${hearts} de ${maxH}`],['Dificultad',diff().name]]);
  $('#gNext').hidden=!nextOK(); $('#gNext').classList.add('primary'); $('#gRetry').classList.remove('primary');
  banner={s:stars?'¡BRAVO!':'¡SUPERADA!', t0:now()}; wake();
}
// alto que tapa el escenario, que queda fijo abajo (sticky): followScore deja la línea actual y la siguiente por encima
const stageReserve=()=>{ const s=$('#gStage'); return $('#sceneView').hidden ? 0 : s.offsetHeight+8; };

/* ---------- Bucle de animación ---------- */
// requestAnimationFrame solo mientras hay pasada o algo que animar; en reposo el escenario queda dibujado (estático)
function wake(){ if(!raf && g) raf=requestAnimationFrame(tick); }
function tick(){
  raf=0; if(!g || $('#sceneView').hidden) return;
  const pn=now();
  if(run && run.live && S.running && ctx){ const h=heardAt(); due(h,pn); if(!run.demo) misses(h,pn); }
  update(pn); draw(pn);
  if((run && run.live && S.running) || actors.length || parts.length || texts.length || dir.a!=='idle' || pn<curtain.t0+curtain.dur || (banner && pn<banner.t0+1)) wake();
}
// Cada enemigo sube justo en el tiempo de su nota (no antes)
function due(h, pn){
  while(run.ptr<run.evs.length){
    const x=run.evs[run.ptr], t=S.passStart+x.rel;
    if(t>h) return;
    run.ptr++;
    const pt=toPn(t,h,pn); spawn(x, pt);
    if(run.demo && x.head){ x.hit=true; strike(x, pt, 'exact', 0); }
  }
}
// Nota no tocada: su ventana (más un margen, GRACE) pasó sin toque asignado. La evaluación no lo detecta en directo, así que se mira aquí
function misses(h, pn){
  for(const x of run.evs){
    if(!x.head || !x.n || x.hit || x.missed || x.n.done) continue;
    if(h <= x.n.t+x.n.win+GRACE) break;   // en orden de tiempo: las siguientes aún están a tiempo
    x.missed=true;
    const a=spawn(x, toPn(x.n.t,h,pn));
    if(a.heads>1){ a.missed=(a.missed||0)+1; a.marks[x.hi]='miss'; }
    hurt('miss', pn, a);
    if(!run.live) return;
  }
}
function update(pn){
  const live=run && run.live;
  actors.forEach(a=>{
    switch(a.st){
      case 'enter': if(pn>=a.t0+a.te) a.st=a.calm?'calm':'stand'; break;
      case 'stand': if(pn>a.end+(live?1:0.3)){ a.st='leave'; a.t1=pn; } break;   // sin resolver (pasada detenida): se va
      case 'hit': if(pn>=a.t1+0.12) die(a,pn); break;
      case 'held': if(pn>=a.end) die(a,pn); break;
      case 'dying': if(pn>=a.t1+(a.dd||0.35)) a.gone=true; break;
      case 'attack': if(pn>=a.t1+0.2){ const more=a.heads>1 && a.done+(a.missed||0)<a.heads && !a.countered; if(more){ a.st='stand'; } else { a.st='leave'; a.t1=pn; } } break;
      case 'leave': if(pn>=a.t1+0.7) a.gone=true; break;
      case 'calm': if(pn>=a.end){ a.st='leave'; a.t1=pn; } break;
      case 'ghost': if(pn>=a.t0+a.life) a.gone=true; break;
    }
  });
  actors=actors.filter(a=>!a.gone);
  parts=parts.filter(p=>pn<p.t0+p.life); texts=texts.filter(t=>pn<t.t0+t.dur);
  if(dir.a==='strike'){ const d=dir.fx==='sost' ? (dir.tgt.st==='held'?1e9:0.2) : 0.24; if(pn>dir.t0+d) dir={a:'idle',t0:pn}; }
  else if(dir.a==='hurt' && pn>dir.t0+0.4) dir={a:'idle',t0:pn};
}

/* ---------- Dibujo ---------- */
const lerp=(a,b,p)=>a+(b-a)*Math.max(0,Math.min(1,p));
// posición (esquina superior izquierda) del enemigo en el instante pn
function pos(a, pn){
  const S0=79-foot(a.key)*a.s; let x=a.x, y=S0;
  if(a.st==='ghost'){ const p=(pn-a.t0)/a.life; return [Math.round(212-p*175), 30+(reduce()?0:Math.round(Math.sin(pn*6)*2))]; }
  const pe=(pn-a.t0)/a.te;   // subida de un salto (también si se golpea en el aire)
  if(pe<1){ x+=Math.round((1-pe)*52); y-=reduce()?0:Math.round(14*4*pe*(1-pe)); }
  if(a.st==='attack'){ const p=Math.min(1,(pn-a.t1)/0.2); x=Math.round(a.x-(a.x-74)*Math.sin(Math.PI*p)); }
  else if(a.st==='leave'){ const p=(pn-a.t1)/0.7; x=Math.round(a.x+p*160); y-=reduce()?0:Math.abs(Math.round(Math.sin(p*18)*2)); }
  else if(a.st==='hit' && !reduce()){ const d=pn-a.t1;
    if(a.death==='shatter') x+=Math.floor(pn*70)%2?1:-1;            // tiembla con el trémolo
    else if(a.death==='split') x+=Math.round(3*Math.min(1,d/0.06));  // retrocede con el tajo
    else if(d<0.06) y+=1; }
  else if(a.st==='hit' && pn-a.t1<0.06) y+=1;
  return [x,y];
}
function drawSpr(key, x, y, sc, o={}){
  const a=o.alpha??1, w=16*sc;
  if(o.rim!==false){ g.globalAlpha=a*0.9; const r=sprite(key,'w'); for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) g.drawImage(r,x+dx,y+dy,w,w); }
  g.globalAlpha=a; g.drawImage(sprite(key,o.mode||''),x,y,w,w);
  if(o.over){ g.globalAlpha=a*o.over[1]; g.drawImage(sprite(key,o.over[0]),x,y,w,w); }
  g.globalAlpha=1;
}
// línea de píxeles (batuta, rayos, cortes)
function pline(x0,y0,x1,y1,col,th=1,every=1){ g.fillStyle=col; const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0; for(let i=0;i<=n;i+=every){ const p=n?i/n:0; g.fillRect(Math.round(x0+(x1-x0)*p),Math.round(y0+(y1-y0)*p),th,th); } }
// Batutazo: por arriba (de −105° a 30°) o de abajo arriba (de 70° a −80°); tajo: de ida (arriba → abajo) o de vuelta
const SWING={batuta:[[-105,30],[70,-80]], corte:[[-80,25],[40,-70]]};
// Movimiento del cuerpo del director en cada golpe [dx, dy]: salto (batutazo), estocada (tajo), temblor (trémolo), brinco (giro), echarse atrás (sostenida)
function dirBody(pn){
  if(dir.a!=='strike' || reduce()) return [0,0];
  const d=pn-dir.t0;
  switch(dir.fx){
    case 'batuta': return [Math.round(3*Math.sin(Math.PI*Math.min(1,d/0.16))), -Math.round(5*Math.sin(Math.PI*Math.min(1,d/0.14)))];
    case 'corte': return [Math.round(8*(d<0.05 ? d/0.05 : Math.max(0,1-(d-0.05)/0.15))), 0];
    case 'tremolo': return [d<0.24 ? (Math.floor(d*50)%2?1:-1) : 0, 0];
    case 'giro': return [0, -Math.round(3*Math.abs(Math.sin(Math.PI*Math.min(1,d/0.22)*2)))];
    case 'sost': return [-2, dir.tgt && dir.tgt.st==='held' ? -Math.round(Math.abs(Math.sin(pn*4))) : 0];
  }
  return [0,0];
}
// destello en cruz de radio k y corchea de 4×5 píxeles (partículas y efectos)
function pstar(x,y,k,col){ g.fillStyle=col; g.fillRect(x-k,y,2*k+1,1); g.fillRect(x,y-k,1,2*k+1); g.fillRect(x-1,y-1,3,3); }
const NOTE_PX=['..##','..#.','..#.','###.','##..'];
function pnote(x,y,col){ g.fillStyle=col; NOTE_PX.forEach((r,ry)=>{ for(let i=0;i<4;i++) if(r[i]==='#') g.fillRect(x+i,y+ry,1,1); }); }
function batonAngle(pn){
  const d=pn-dir.t0, deg=Math.PI/180;
  if(dir.a==='hurt') return -125*deg;
  if(dir.a!=='strike') return -55*deg;
  const [a0,a1]=SWING[dir.fx]?.[dir.v||0] || [-105,30];
  switch(dir.fx){
    case 'batuta': case 'corte': {   // se arma (a0), descarga (a1) y vuelve al reposo; el tajo es más corto y seco
      const t1=dir.fx==='corte'?0.04:0.06, t2=t1+(dir.fx==='corte'?0.05:0.08);
      return (d<t1 ? lerp(-55,a0,d/t1) : d<t2 ? lerp(a0,a1,(d-t1)/(t2-t1)) : lerp(a1,-55,(d-t2)/0.1))*deg; }
    case 'tremolo': return (-30+(reduce()?0:16*Math.sin(d*70)))*deg;
    case 'giro': return (-55+(dir.v?-360:360)*Math.min(1,d/0.22))*deg;
    case 'sost': { const c=center(dir.tgt,pn); return Math.atan2(c[1]-HAND[1], c[0]-HAND[0]); }
  }
  return -55*deg;
}
function drawDirector(pn){
  const hurtP=dir.a==='hurt' ? pn-dir.t0 : -1, rm=reduce(), [bx,by]=dirBody(pn);
  const x=DX+bx-(hurtP>=0 && !rm ? Math.round(3*Math.max(0,1-hurtP/0.3)) : 0), y=DY+by;
  // herida: con movimiento reducido, tinte rojo fijo; si no, parpadeo rojo y blanco
  const over = hurtP<0 ? null : rm ? ['r',.5] : [Math.floor(hurtP/0.06)%2?'f':'r', .7];
  drawSpr('o_heroe', x, y, 3, {over});
  const a=batonAngle(pn), hx=HAND[0]-(DX-x), hy=HAND[1]-(DY-y), L=17, tx=Math.round(hx+Math.cos(a)*L), ty=Math.round(hy+Math.sin(a)*L);
  pline(hx,hy,tx,ty,'#f4f1ea',2); g.fillStyle='#f2c14e'; g.fillRect(tx-1,ty-1,3,3);
  if(dir.a==='strike') drawFx(pn, hx, hy, tx, ty, a);
}
// el golpe propio de cada figura
function drawFx(pn, hx, hy, tx, ty, ang){
  const d=pn-dir.t0, t=dir.tgt, c=center(t,pn), rm=reduce();
  switch(dir.fx){
    case 'batuta': {   // estela dorada del arco y, al llegar, un golpe en la cabeza de la nota
      const [a0,a1]=SWING.batuta[dir.v||0], cur=ang*180/Math.PI, lo=Math.min(a0,cur), hi=Math.max(a0,cur);
      if(d>0.05 && d<0.24){ g.fillStyle='#f2c14e'; for(let k=lo;k<=hi;k+=6){ const r=k*Math.PI/180; g.fillRect(Math.round(hx+Math.cos(r)*20),Math.round(hy+Math.sin(r)*20),2,2); } }
      if(d>0.12 && d<0.26){ const k=Math.round(lerp(2,6,(d-0.12)/0.14)); pstar(c[0], c[1]-6, k, '#ffffff'); }
      if(a1<a0 && d>0.12 && d<0.22) for(let i=0;i<3;i++) pline(c[0]-6+i*6, c[1]+12, c[0]-6+i*6, c[1]+6-i%2*2, '#f4f1ea');   // de abajo arriba: rayas de impulso
      break; }
    case 'corte': if(d<0.18){   // tajo diagonal que cruza la nota (de ida o de vuelta), con estela gris
      const p=Math.min(1,d/0.07), sgn=dir.v?-1:1, x0=c[0]-18, y0=c[1]-8*sgn, x1=Math.round(x0+36*p), y1=Math.round(y0+16*sgn*p);
      pline(x0,y0+sgn,x1,y1+sgn,'#cfc9d8',1); pline(x0,y0,x1,y1,'#ffffff',2); } break;
    case 'tremolo': if(d<0.26){   // rayo en zigzag de la punta de la batuta a la nota (cambia en cada fotograma)
      let px=tx, py=ty; const seg=5;
      for(let i=1;i<=seg;i++){ const k=i/seg, j=i===seg?0:(rm?(i%2?3:-3):Math.round(rnd(-4,4)));
        const nx=Math.round(lerp(tx,c[0],k)), ny=Math.round(lerp(ty,c[1],k))+j; pline(px,py,nx,ny,i%2?'#ffffff':'#a8d8ff',1); px=nx; py=ny; }
      if(!rm && Math.floor(d*30)%2) pstar(c[0], c[1], 4, '#a8d8ff'); } break;
    case 'giro': if(d<0.3){   // tres notas doradas giran alrededor de la punta y vuelan hacia el trío
      const p=Math.min(1,d/0.3), ox=lerp(tx,c[0],p), oy=lerp(ty,c[1]-6,p), r=6+p*4;
      for(let k=0;k<3;k++){ const an=(dir.v?-1:1)*d*24+k*2.094; pnote(Math.round(ox+Math.cos(an)*r)-2, Math.round(oy+Math.sin(an)*r)-3, '#f2c14e'); } } break;
    case 'sost': if(t.st==='held'){ const on=rm || Math.floor(pn*12)%2; pline(tx,ty,c[0],c[1],on?'#f2c14e':'#c8902a',1,2);
        if(!rm) for(let k=0;k<3;k++){ const q=(pn*1.6+k/3)%1; g.fillStyle='#fff3c4'; g.fillRect(Math.round(lerp(tx,c[0],q))-1, Math.round(lerp(ty,c[1],q))-1, 3, 3); }   // pulsos que viajan por el rayo
        if(t.kind==='redonda'){ const p=pos(t,pn), cx=p[0]+8*t.s, top=p[1]+2*t.s; g.fillStyle='#f2c14e';   // calderón sobre la Redonda
          for(let k=0;k<=180;k+=12){ const r=k*Math.PI/180; g.fillRect(Math.round(cx-Math.cos(r)*8),Math.round(top-Math.sin(r)*7),2,1); } g.fillRect(cx-1,top-2,2,2); } }
      break;
  }
}
function drawActor(a, pn){
  const [x,y]=pos(a,pn);
  if(a.st==='ghost'){ const lg=pn-a.laugh<0.35; drawSpr(a.key,x,y,a.s,{rim:false, mode:'g', alpha:.6, over: lg ? ['r', reduce()?.5:(Math.floor(pn*16)%2?.8:.3)] : null}); return; }
  if(a.st==='dying' && !reduce()){ drawDying(a,x,y,pn); return; }
  let alpha=1, over=null;
  if(a.st==='dying') alpha=1-(pn-a.t1)/(a.dd||0.35);
  if(a.calm) alpha=.75;
  if(!reduce() && (a.st==='hit' && pn-a.t1<0.08 || pn-a.flash<0.08)) over=['f',.8];
  if(a.st==='held') over=['f',reduce()?.25:.15+.1*Math.sin(pn*10)];
  drawSpr(a.key, x, y, a.s, {alpha:Math.max(0,alpha), over});
  if(a.calm && a.st!=='leave'){ g.fillStyle='#f4f1ea'; for(let k=0;k<=180;k+=15){ const r=k*Math.PI/180; g.fillRect(Math.round(x+8*a.s-Math.cos(r)*12), Math.round(y+a.s-Math.sin(r)*4),2,1); } }   // ligadura sobre la nota ligada
  if(a.heads>1 && a.st!=='dying') a.marks.forEach((m,k)=>{ if(m!=='hit' || a.hx[k]==null) return; g.fillStyle='#f2c14e'; g.fillRect(x+Math.round(a.hx[k]*a.s)-1, y+15*a.s, 3, 2); });   // notas del grupo ya afinadas
}
// Cómo cae cada enemigo afinado (sin movimiento reducido): aplastado, partido en dos, girando o subiendo; el que estalla ya es partículas
function drawSprPart(key, sx, sy, sw, sh, dx, dy, dw, dh, alpha){
  g.globalAlpha=alpha*0.9; const r=sprite(key,'w'); for(const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1]]) g.drawImage(r,sx,sy,sw,sh,dx+ox,dy+oy,dw,dh);
  g.globalAlpha=alpha; g.drawImage(sprite(key,''),sx,sy,sw,sh,dx,dy,dw,dh); g.globalAlpha=1;
}
function drawDying(a, x, y, pn){
  const p=Math.max(0,Math.min(1,(pn-a.t1)/a.dd)), s=a.s, w=16*s, fade=p>0.6?(1-p)/0.4:1;
  switch(a.death){
    case 'squash': {   // se aplasta contra las tablas y se ensancha
      const f=foot(a.key), sy=Math.max(0.12,1-p*2.2), sx=1+(1-sy)*0.7, ww=Math.round(w*sx), hh=Math.max(2,Math.round(f*s*sy));
      drawSprPart(a.key,0,0,16,f, Math.round(x+w/2-ww/2), y+f*s-hh, ww, hh, fade); break; }
    case 'split': {    // dos mitades que se separan y caen (la de arriba según el sentido del tajo)
      const d=Math.round(p*16), up=a.v?1:-1, x0=x+3;
      drawSprPart(a.key,0,0,8,16, x0-d, Math.round(y+(up<0?-8*p:0)+30*p*p), 8*s, w, fade);
      drawSprPart(a.key,8,0,8,16, x0+8*s+d, Math.round(y+(up>0?-8*p:0)+30*p*p), 8*s, w, fade); break; }
    case 'spin': {     // gira y encoge mientras sube
      g.save(); g.translate(Math.round(x+w/2), Math.round(y+w/2-22*p)); g.rotate((a.v?-1:1)*p*Math.PI*3); const k=1-p*0.75; g.scale(k,k);
      drawSprPart(a.key,0,0,16,16,-w/2,-w/2,w,w,fade); g.restore(); break; }
    case 'ascend':     // sube flotando, cada vez más clara
      drawSpr(a.key, x, Math.round(y-34*p*p), s, {alpha:1-p, over:['f',0.3+0.5*p]}); break;
  }
}
function drawCurtain(c){
  if(c<=0.01) return;
  const w=Math.round(23+(W/2-23)*c);
  [[0,w],[W-w,w]].forEach(([x0,ww])=>{ g.fillStyle='#8e2222'; g.fillRect(x0,0,ww,H); g.fillStyle='#6e1818'; for(let i=x0+5;i<x0+ww-2;i+=9) g.fillRect(i,0,2,H); g.fillStyle='#a52a2a'; g.fillRect(x0,H-4,ww,4); });
  g.fillStyle='#a52a2a'; g.fillRect(0,0,W,8);
}
function drawPart(p, pn){
  const d=Math.max(0,pn-p.t0), q=d/p.life; g.globalAlpha=Math.max(0,1-q); g.fillStyle=p.col;
  if(p.kind==='ring'){ const r=lerp(p.r0,p.r1,q), ry=p.ry||1, n=Math.max(12,Math.round(r*5));
    for(let i=0;i<n;i++){ const an=i/n*Math.PI*2; g.fillRect(Math.round(p.x+Math.cos(an)*r), Math.round(p.y+Math.sin(an)*r*ry), 1, 1); } return; }
  if(p.kind==='star'){ pstar(Math.round(p.x), Math.round(p.y), Math.max(1,Math.round(p.r1*Math.min(1,q*2))), p.col); return; }
  const x=Math.round(p.x+p.vx*d+(p.sway?Math.sin(d*9+p.x)*3:0)), y=Math.round(p.y+p.vy*d+p.gr*d*d);
  if(p.kind==='note') pnote(x,y,p.col); else g.fillRect(x,y,p.sz,p.sz);
}
function draw(pn=now()){
  if(!g) return;
  fit(); g.setTransform(PX,0,0,PX,0,0); g.imageSmoothingEnabled=false;
  if(!reduce() && pn-shake<0.22) g.translate(Math.round(Math.random()*4-2), Math.round(Math.random()*2-1));   // sacudida al perder un corazón
  g.drawImage(background(),0,0);
  const sc=scene();
  // la jefa espera entre bastidores (escenas de jefa), asomando tras el telón derecho mientras no está en escena
  if(sc.boss && !actors.some(a=>a.big)){ const k=BOSS_SPR[sc.boss]; drawSpr(k, 196, 79-foot(k)*4, 4, {alpha:.45}); g.drawImage(background(),W-23,0,23,H,W-23,0,23,H); }
  drawDirector(pn);
  actors.slice().sort((a,b)=>(a.st==='ghost')-(b.st==='ghost') || b.x-a.x).forEach(a=>drawActor(a,pn));
  parts.forEach(p=>drawPart(p,pn)); g.globalAlpha=1;
  texts.forEach(t=>{ const p=(pn-t.t0)/t.dur; text(t.s, t.x, Math.round(t.y-(reduce()?0:8*p)), t.col, t.sc, p>0.7?Math.max(0,(1-p)/0.3):1); });
  g.setTransform(PX,0,0,PX,0,0);
  drawCurtain(curtainAt(pn));
  if(banner) text(banner.s, W/2, banner.s==='TELÓN'?36:15, banner.s==='TELÓN'?'#f4f1ea':'#f2c14e', 3);   // ¡BRAVO! por encima de las cabezas
}

/* ---------- Marcador y bestiario ---------- */
const HEART='M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z';
let hudLast='';
function hud(){
  const mx=run?run.max:diff().hearts, h=run?run.hearts:mx, c=run?run.combo:0, p=run?run.pts:0;
  if(hudLast!==h+'/'+mx){ hudLast=h+'/'+mx;
    $('#gHearts').innerHTML=Array.from({length:mx},(_,i)=>`<svg viewBox="0 0 7 6" aria-hidden="true"><path class="${i<h?'hf':'he'}" d="${HEART}"/></svg>`).join('');
    $('#gHearts').setAttribute('aria-label',`${h} de ${mx} corazones`); }
  $('#gCombo').textContent = c>=2 ? `Combo ×${c}` : '';
  $('#gPts').textContent = `${fmtN(p)} pts`;
}
function cap(foe, judge){ if(foe!=null) $('#gFoe').textContent=foe; if(judge!=null) $('#gJudge').textContent=judge; }
// Enemigos de la escena (el «bestiario»): figura, enemigo y golpe, con su sprite
const FIGK={w:['redonda'],h:['blanca'],hd:['blanca',1],q:['negra'],qd:['negra',1],e:['corchea'],s:['semicorchea'],t:['tresillo']};
function renderBest(){
  const s=scene(), rows=[];
  FIGS.filter(f=>s.figs.includes(f.k)).forEach(f=>{ const [k,dot]=FIGK[f.k], F=FOES[k];
    rows.push({img:F.spr+(dot?'.':''), fig:f.name, name:F.name+(dot?' con puntillo':'')+(s.boss===f.k?' · jefa':''), hit:F.hit+(dot?' (dura la mitad más)':'')}); });
  if(s.figs.includes('e') || s.figs.includes('s')) rows.push({img:s.figs.includes('s')?'o_g4_2':'o_g2_1', fig:'Notas con barra', name:FOES.grupo.name, hit:FOES.grupo.hit});
  if(restList(s).length) rows.push({img:'o_silencio', fig:'Silencios', name:FOES.silencio.name, hit:FOES.silencio.hit});
  if(s.ties) rows.push({img:'o_negra', fig:'Ligadura', name:'Nota ligada', hit:'No se vuelve a tocar: el enemigo se queda en pie y se va solo'});
  $('#gBest').innerHTML=rows.map(r=>`<li><img src="${thumb(r.img)}" alt="" width="44" height="44"><span><small>${esc(r.fig)}</small><b>${esc(r.name)}</b>${esc(r.hit)}</span></li>`).join('');
}
// Escenario en reposo (al cambiar de escena o de ritmo)
function stageReset(){ run=null; actors=[]; parts=[]; texts=[]; banner=null; dir={a:'idle',t0:0}; curtain={c0:0,c1:0,t0:0,dur:0}; hud(); cap('',''); }
// Al entrar en la pantalla de la escena
function stageEnter(){ if(!run || !S.running) stageReset(); draw(); wake(); }

/* ---------- Arranque ---------- */
cv=$('#gCanvas'); g=cv.getContext('2d');
new ResizeObserver(()=>{ if(!$('#sceneView').hidden) draw(); }).observe($('#gStage'));
reduceMQ.addEventListener('change',()=>draw());

Object.assign(window, {gameStart, gameStop, gameTap, gameRelease, gameAbandon, gameAfter, stageReserve, stageReset, stageEnter,
  stageDraw:()=>draw(), stageHud:()=>{ if(run && run.live) return; const r=run; run=null; hud(); run=r; }, renderBest, bossThumb:k=>thumb(BOSS_SPR[k]), gameRun:()=>run});
})();
