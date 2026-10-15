// El juego: mapa de la gira, cobertura de figuras de las 20 escenas, corazones, puntos y combo, derrota, victoria y avance,
// Esc, «Escuchar», recarga y validación del avance guardado
const { suite } = require('./lib');

// genera ritmos de la escena hasta que cumplan la condición f (código; la CSP no deja usar new Function dentro de la página)
const regen = (p, f) => p.evaluate(`(()=>{ for (let k = 0; k < 200; k++) { generate(); if (${f}) return true; } return false; })()`);

suite('Juego', async ({ b, URL, ok, MOB, page, open, until, wf, scheduleTaps, openScene, waitRunning, waitResults, waitStopped }) => {
  let p = await page(b);
  await open(p, URL);

  // 1) arranque: el mapa de la gira
  let r = await p.evaluate(() => ({ map: !document.querySelector('#mapView').hidden, scene: document.querySelector('#sceneView').hidden, n: document.querySelectorAll('#gMap .sc').length,
    acts: document.querySelectorAll('#gMap .act').length, lock: document.querySelector('#gMap .sc[data-lv="1"]').getAttribute('aria-disabled'),
    l0: document.querySelector('#gMap .sc[data-lv="0"]').getAttribute('aria-label'), cont: document.querySelector('#bContinue').textContent }));
  ok(r.map && r.scene && r.n === 20 && r.acts === 5, 'al arrancar: mapa con 5 actos y 20 escenas');
  ok(r.lock === 'true' && /^Escena 1-1: Afinando la orquesta, 0 de 3 estrellas, sin superar$/.test(r.l0), 'la 1-1 abierta con nombre completo y la 1-2 bloqueada: ' + r.l0);
  ok(/Empezar la gira: 1-1/.test(r.cont), '«Empezar la gira» lleva a la 1-1');
  await p.evaluate(() => document.querySelector('#gMap .sc[data-lv="1"]').click());   // aria-disabled: Playwright no la pulsa
  ok(await until(p, () => /bloqueada/.test(document.querySelector('#srLive').textContent) && !document.querySelector('#mapView').hidden), 'una escena bloqueada no se abre (se anuncia)');
  await p.click('#bContinue');
  await wf(p, () => !document.querySelector('#sceneView').hidden);
  r = await p.evaluate(() => ({ title: document.querySelector('#lvTitle').textContent, hearts: document.querySelector('#gHearts').getAttribute('aria-label'), best: document.querySelectorAll('#gBest li').length,
    stage: !!document.querySelector('#pad #gCanvas'), svg: document.querySelectorAll('#score svg.sys').length, prev: document.querySelector('#lvPrev').disabled, next: document.querySelector('#lvNext').disabled }));
  ok(r.title === 'Afinando la orquesta' && r.hearts === '5 de 5 corazones' && r.best >= 1 && r.stage && r.svg > 0, 'escena 1-1: ficha, cinco corazones, bestiario, partitura y escenario dentro de la zona de toque');
  ok(r.prev && r.next, 'flechas de escena apagadas en la primera (la siguiente está cerrada)');
  ok(await p.evaluate(() => { const c = document.querySelector('#gCanvas'); return c.width % 240 === 0 && c.height % 110 === 0 && getComputedStyle(c).imageRendering === 'pixelated'; }), 'canvas a 240×110 lógicos, escalado pixelado');

  // cada escena genera todas sus figuras, silencios y celdas pedidas
  const cov = await p.evaluate(() => { const bad = []; SCENES.forEach(s => { prog.scenes[s.id] = { best: 0, stars: 0, tries: 1, pts: 0 }; });
    SCENES.forEach((s, i) => { selectScene(i); for (let k = 0; k < 5; k++) { generate(); const u = figsUsed(score.measures);
      const want = [...s.figs, ...restList(s).map(x => 'r' + x), ...(s.need || []).map(x => '~' + x)]; if (!want.every(w => u.has(w)) || score.fb) bad.push(s.id); } });
    prog.scenes = {}; selectScene(0); return bad; });
  ok(cov.length === 0, 'las 20 escenas generan todas sus figuras y silencios ' + cov.join(','));

  // 2) acierto: puntos y combo; nota sin tocar: pierde un corazón
  let sc = await openScene(p, 0, 120);
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0, 0, null, ...Array(sc.heads).fill(0)].slice(0, sc.heads));
  ok(await until(p, () => __t.run.pts >= 200 && __t.run.combo >= 2, null, 8000), 'dos aciertos exactos: suman puntos y combo');
  ok(await until(p, () => /Combo ×2/.test(document.querySelector('#gCombo').textContent) || __t.run.hearts < 5, null, 8000), 'el marcador muestra el combo');
  ok(await until(p, () => __t.run.hearts === 4, null, 8000), 'nota sin tocar: 4 de 5 corazones');
  ok(await until(p, () => document.querySelector('#gHearts').getAttribute('aria-label') === '4 de 5 corazones' && /pierdes un corazón/.test(document.querySelector('#srLive').textContent)), 'el corazón perdido se anuncia (marcador y aria-live)');
  ok(await p.evaluate(() => __t.run.combo <= 1), 'y corta el combo');
  await waitResults(p);
  r = await p.evaluate(() => ({ g: prog.scenes.G1, pts: __t.run.pts, max: __t.run.maxCombo, stats: document.querySelector('#gResStats').textContent }));
  ok(r.g && r.g.tries === 1 && r.g.pts === r.pts && r.max >= 2, 'pasada completada: prog.scenes guarda intentos y puntos ' + JSON.stringify(r.g));
  ok(/Precisión: \d+%/.test(r.stats) && /Corazones: 4 de 5/.test(r.stats), 'el bloque de la escena da precisión, puntos, combo y corazones: ' + r.stats);

  // 3) victoria: todo exacto → tres estrellas, se abre la siguiente
  await p.click('#gRetry'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0]); await waitResults(p);
  r = await p.evaluate(() => ({ head: document.querySelector('#gResHead').textContent, g: prog.scenes.G1, next: !document.querySelector('#gNext').hidden,
    map: document.querySelector('#gMap .sc[data-lv="1"]').getAttribute('aria-disabled'), hearts: __t.run.hearts, stars: document.querySelector('#gResStars').getAttribute('aria-label'),
    stored: JSON.parse(localStorage.getItem('orquesta-desafinada-progreso-v1')).scenes.G1, det: !document.querySelector('#rDetail').hidden, pct: document.querySelector('#rPct').textContent, foc: document.activeElement.id }));
  ok(r.head === '¡Escena superada!' && r.stars === '3 de 3 estrellas' && r.hearts === 5, 'victoria: «¡Escena superada!» con tres estrellas y cinco corazones');
  ok(r.g.stars === 3 && r.g.best >= 95 && r.g.tries === 2 && r.stored && r.stored.stars === 3, 'el avance se guarda en prog.scenes (y en localStorage)');
  ok(r.next && r.map === null, 'se desbloquea la siguiente escena («Siguiente escena» y el mapa)');
  ok(r.det && r.pct === '100%' && r.foc === 'results', 'el detalle de precisión sale debajo y el foco va a los resultados');
  ok(await until(p, () => /Escena superada/.test(document.querySelector('#srLive').textContent)), 'el fin de escena se anuncia');
  await p.click('#gNext');
  ok(await until(p, () => __t.sceneIdx === 1 && document.querySelector('#lvTitle').textContent === 'Notas largas' && document.querySelector('#results').hidden), '«Siguiente escena» abre la 1-2');
  ok(await p.evaluate(() => !document.querySelector('#lvPrev').disabled), '«Escena anterior» activa en la 1-2');

  // 4) golpe de más en un silencio: pierde un corazón (escena con silencios fantasma)
  await openScene(p, 2, 120);
  ok(await regen(p, "score.flat.some(e=>e.rest && e.abs>0)"), 'ritmo con silencio');
  const restAbs = await p.evaluate(() => { const e = score.flat.find(e => e.rest && e.abs > 0); return e.abs + Math.min(e.dur, 6) / 2; });
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0], restAbs);
  ok(await until(p, () => __t.run.hearts === 4, null, 12000), 'tocar en un silencio (golpe de más): 4 de 5 corazones');
  await waitResults(p);
  ok(await p.evaluate(() => +document.querySelector('#cExtra').textContent === 1 && document.querySelector('#gResHead').textContent !== 'Telón'), 'la escena se termina igual (con el golpe de más contado)');

  // 5) modo piano: soltar antes una blanca hace que contraataque
  await openScene(p, 1, 120);
  ok(await regen(p, "score.flat.some(e=>!e.rest && e.dur===24)"), 'ritmo con blanca');
  const nh = await p.evaluate(() => { set.hold = true; return score.flat.filter(e => !e.rest && !e.tie && e.dur === 24).length; });
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0]);   // suelta a los 120 ms: las negras bien, las blancas antes de tiempo
  await waitResults(p);
  ok(await p.evaluate(nh => __t.run.hearts === 5 - nh, nh), `piano: soltar antes ${nh} blanca(s) cuesta ${nh} corazón(es)`);
  ok(await p.evaluate(() => !document.querySelector('#durCounts').hidden), 'piano: el detalle incluye las duraciones');
  await p.evaluate(() => { set.hold = false; });

  // 6) derrota: con 0 corazones se detiene la escena, sin resultados de precisión pero con un intento más
  await openScene(p, 0, 120);
  const before = await p.evaluate(() => prog.scenes.G1.tries);
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await p.evaluate(() => { __t.run.hearts = 1; });
  await waitStopped(p);
  r = await p.evaluate(() => ({ head: document.querySelector('#gResHead').textContent, lost: document.querySelector('#results').classList.contains('lost'), vis: !document.querySelector('#results').hidden,
    tries: prog.scenes.G1.tries, det: getComputedStyle(document.querySelector('#rDetail')).display, foc: document.activeElement.id, retry: !document.querySelector('#gRetry').hidden }));
  ok(r.head === 'Telón' && r.lost && r.vis && r.det === 'none', 'telón: solo el bloque de la escena, sin el detalle de precisión');
  ok(r.tries === before + 1, `un intento más (${r.tries})`);
  ok(r.foc === 'results' && r.retry, 'el foco va a los resultados y está «Reintentar»');
  ok(await until(p, () => /Telón/.test(document.querySelector('#srLive').textContent)), 'la derrota se anuncia');
  await p.click('#gRetry'); await waitRunning(p, 'practice');
  ok(await p.evaluate(() => __t.run.hearts === 5 && !document.querySelector('#results').classList.contains('lost') && document.querySelector('#results').hidden), '«Reintentar» empieza la escena con cinco corazones');
  await p.keyboard.press('Escape'); await waitStopped(p);
  ok(await p.evaluate(() => document.querySelector('#results').hidden), 'Esc antes de tocar abandona la escena sin resultados');
  // Esc tras tocar: abandona, sin resultados, y cuenta como intento
  const t0 = await p.evaluate(() => prog.scenes.G1.tries);
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0]);
  await until(p, () => __t.S.taps.length > 0, null, 8000);
  await p.keyboard.press('Escape'); await waitStopped(p);
  ok(await p.evaluate(t0 => document.querySelector('#results').hidden && prog.scenes.G1.tries === t0 + 1 && /abandonada/.test(document.querySelector('#gJudge').textContent), t0), 'Esc tras tocar: escena abandonada, sin resultados y con un intento más');

  // 7) Escuchar: demostración sin tocar el marcador
  await p.click('#bPlay'); await waitRunning(p, 'play');
  await p.waitForTimeout(2000);
  ok(await p.evaluate(() => __t.run.demo && __t.run.hearts === 5 && __t.run.pts === 0 && __t.liveSrc.size > 0), '«Escuchar»: suena y el director afina solo, sin puntos ni corazones');
  await p.click('#bStop'); await waitStopped(p);

  // 8) volver a la gira: el mapa refleja el avance y el foco va a la escena
  await p.click('#bMap');
  r = await p.evaluate(() => ({ map: !document.querySelector('#mapView').hidden, foc: document.activeElement.dataset.lv, total: document.querySelector('#gTotal').textContent, l0: document.querySelector('#gMap .sc[data-lv="0"]').getAttribute('aria-label') }));
  ok(r.map && r.foc === '0' && /3 de 3 estrellas/.test(r.l0) && /superada/.test(r.l0), 'de vuelta al mapa: la 1-1 con sus estrellas y el foco en ella ' + r.l0);
  ok(p.errs.length === 0, 'sin errores de consola ' + p.errs.join(' | '));
  ok((await p.csp()).length === 0 && p.ext.length === 0, 'sin violaciones de CSP ni peticiones externas ' + (await p.csp()).join(' | '));

  // 9) al recargar con una escena abierta, vuelve a ella
  await p.evaluate(() => selectScene(1));
  await p.reload(); await wf(p, () => window.__t && __t.view === 'escena');
  ok(await p.evaluate(() => __t.sceneIdx === 1 && !document.querySelector('#sceneView').hidden && document.querySelectorAll('#score svg').length > 0), 'al recargar: la misma escena abierta');
  ok(p.errs.length === 0 && (await p.csp()).length === 0, 'recarga sin errores ni CSP ' + p.errs.join(' | '));

  // 10) validación del avance guardado
  r = await p.evaluate(() => {
    const raw = JSON.parse('{"scenes":{"G1":{"best":150,"stars":9,"tries":-3,"pts":"x"},"__proto__":{"best":1},"constructor":{"best":1},"G99":{"stars":1},"x":{"stars":1},"G2":"mal","G3":{"best":"80","stars":2.4,"tries":3,"pts":1e12}}}');
    return { c: JSON.stringify(cleanProg(raw).scenes), bad: JSON.stringify(cleanProg({ scenes: 'x' })), nul: JSON.stringify(cleanProg(null)), proto: ({}).best === undefined };
  });
  ok(r.c === '{"G1":{"best":100,"stars":3,"tries":0,"pts":0},"G3":{"best":80,"stars":2,"tries":3,"pts":10000000}}', 'cleanProg: solo ids de escenas existentes, con números en rango ' + r.c);
  ok(r.bad === '{"scenes":{}}' && r.nul === '{"scenes":{}}' && r.proto, 'cleanProg: tipos equivocados → vacío, sin contaminar Object.prototype');
  r = await p.evaluate(() => JSON.stringify(cleanProg({ scenes: { G1: { best: 50, stars: 0, tries: 1, pts: 9, clear: 1 }, G2: { clear: 'sí' }, G3: { clear: 7 } } }).scenes));
  ok(r === '{"G1":{"best":50,"stars":0,"tries":1,"pts":9,"clear":1},"G2":{"best":0,"stars":0,"tries":0,"pts":0},"G3":{"best":0,"stars":0,"tries":0,"pts":0,"clear":1}}', 'cleanProg: clear solo se guarda si vale 1 ' + r);

  // 11) llegar al final con vida supera la escena y abre la siguiente, aunque no llegue a la estrella
  await p.evaluate(() => { prog.scenes = {}; commitProg(); });
  sc = await openScene(p, 0, 120);
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0, null, 0, 0, null, 0, 0, null]);
  await waitResults(p);
  r = await p.evaluate(() => ({ head: document.querySelector('#gResHead').textContent, g: prog.scenes.G1, hearts: __t.run.hearts, next: !document.querySelector('#gNext').hidden,
    map: document.querySelector('#gMap .sc[data-lv="1"]').getAttribute('aria-disabled'), cont: document.querySelector('#bContinue').textContent, txt: document.querySelector('#gResText').textContent }));
  ok(r.head === '¡Escena superada!' && r.g.stars === 0 && r.g.clear === 1 && r.hearts > 0, 'con vida y sin estrella: «¡Escena superada!» y clear ' + JSON.stringify(r.g));
  ok(r.next && r.map === null && /1-2/.test(r.cont), 'se abre la siguiente escena («Siguiente escena», el mapa y «Continuar») ' + r.cont);
  ok(/Se abre la siguiente escena\. Para la primera estrella te faltan \d+ puntos/.test(r.txt), 'el texto dice que se abre y lo que falta para la estrella: ' + r.txt);

  // 11b) notas unidas por barra: un solo enemigo por grupo, con un golpe por nota
  await openScene(p, 4, 120);
  ok(await regen(p, "score.flat.some(e=>e.bg)"), 'ritmo con corcheas unidas por barra');
  const ng = await p.evaluate(() => new Set(score.flat.filter(e => e.bg && !e.rest && !e.tie).map(e => e.bg)).size);
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0]);
  await waitResults(p);
  r = await p.evaluate(() => { const g = [...__t.run.groups.values()]; return { n: g.length, ok: g.every(a => a.kind === 'grupo' && a.heads >= 2 && a.done === a.heads && a.marks.length === a.heads && a.marks.every(m => m === 'hit')), h: __t.run.hearts,
    best: [...document.querySelectorAll('#gBest b')].some(b => b.textContent === 'Banda de banderines') }; });
  ok(r.n === ng && r.ok && r.h === 5, `cada grupo con barra es un enemigo que recibe un golpe por nota (${r.n} de ${ng})`);
  ok(r.best, 'el bestiario presenta la banda de banderines');

  // 12) dificultad: corazones, tempo y golpes de más
  await p.click('#diffSeg [data-diff="facil"]');
  r = await p.evaluate(() => ({ h: document.querySelector('#gHearts').getAttribute('aria-label'), bpm: curBpm(), d: set.diff, st: JSON.parse(localStorage.getItem('orquesta-desafinada-ajustes-v1')).diff,
    pr: [...document.querySelectorAll('[data-diff="facil"]')].every(b => b.getAttribute('aria-pressed') === 'true'), meta: document.querySelector('#lvMeta').textContent }));
  ok(r.h === '8 de 8 corazones' && r.bpm === 96 && r.d === 'facil' && r.st === 'facil' && r.pr, 'fácil: 8 corazones, tempo al 80 %, guardado y marcado en los dos selectores ' + JSON.stringify(r));
  ok(/Negra = 96/.test(r.meta) && /Fácil: 8/.test(r.meta), 'la ficha da el tempo y los corazones de la dificultad: ' + r.meta);
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0], 6);
  await waitResults(p);
  r = await p.evaluate(() => ({ h: __t.run.hearts, x: +document.querySelector('#cExtra').textContent, stats: document.querySelector('#gResStats').textContent }));
  ok(r.h === 8 && r.x === 1 && /Corazones: 8 de 8/.test(r.stats) && /Dificultad: Fácil/.test(r.stats), 'fácil: el golpe de más cuenta en la precisión pero no quita corazón ' + JSON.stringify(r));
  await p.click('#diffSeg [data-diff="dificil"]');
  ok(await p.evaluate(() => document.querySelector('#gHearts').getAttribute('aria-label') === '3 de 3 corazones' && curBpm() === 138), 'difícil: 3 corazones y tempo un 15 % más rápido');
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  ok(await p.evaluate(() => __t.run.hearts === 3 && __t.run.max === 3 && Math.abs(__t.S.spt * 12 * 138 - 60) < 1e-6), 'difícil: la pasada empieza con 3 corazones a 138 ppm');
  await p.keyboard.press('Escape'); await waitStopped(p);
  ok(await p.evaluate(() => cleanSettings({ diff: '__proto__' }).diff === 'normal' && cleanSettings({ diff: 'dificil' }).diff === 'dificil'), 'cleanSettings: solo dificultades conocidas');
  await p.click('#diffSeg [data-diff="normal"]');
  ok(p.errs.length === 0 && (await p.csp()).length === 0, 'avance y dificultad sin errores ni CSP ' + p.errs.join(' | '));
  await p.context().close();

  // 13) móvil: sin desplazamiento horizontal, escenario y botón flotante
  for (const w of [360, 390]) {
    const m = await page(b, { ...MOB, viewport: { width: w, height: w === 360 ? 640 : 844 } }); await open(m, URL);
    await m.tap('#bContinue'); await wf(m, () => __t.view === 'escena'); await m.waitForTimeout(300);
    r = await m.evaluate(() => ({ doc: document.documentElement.scrollWidth, cw: document.querySelector('#gCanvas').getBoundingClientRect().width }));
    ok(r.doc <= w && r.cw > 200 && r.cw <= w, `${w} px: el escenario cabe (${Math.round(r.cw)} px) sin desplazamiento horizontal (${r.doc} px)`);
    await m.evaluate(() => start('practice')); await wf(m, () => __t.S.running && __t.S.mode === 'practice');
    ok(await m.evaluate(() => !document.querySelector('#tapFab').hidden && document.querySelector('#fabMain').textContent.length > 0 && document.documentElement.scrollWidth <= innerWidth), `${w} px: botón flotante en la escena, sin desbordar`);
    await m.evaluate(() => stop());
    ok(m.errs.length === 0, `${w} px: sin errores ` + m.errs.join(' | '));
    await m.context().close();
  }
});
