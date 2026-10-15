// Experiencia en el móvil: botón flotante («Empezar», «Toca aquí», «Detener»), resultados encuadrados con el botón de tres partes,
// textos sin teclado, latencia a la vista, tamaños táctiles de 44 px y sin desplazamiento horizontal (320–390 px y horizontal)
const { suite } = require('./lib');

suite('Experiencia en el móvil', async ({ b, URL, ok, MOB, page, open, until, wf, settle, postReady, scheduleTaps, openScene, waitRunning, waitResults, waitStopped }) => {
  const SM = { ...MOB, viewport: { width: 360, height: 640 } }, LAND = { ...MOB, viewport: { width: 844, height: 390 } }, XS = { ...MOB, viewport: { width: 320, height: 640 } };
  const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const mob = async o => { const p = await page(b, o); await open(p, URL); return p; };
  const playAll = async p => {
    await p.tap('#bPractice'); await waitRunning(p, 'practice');
    await scheduleTaps(p, [-6, 12, -20, 8, 30, -14, 4, -9], null);
    await waitResults(p); await settle(p);
  };

  // 1) sin desplazamiento horizontal y objetivos de 44 px
  for (const [name, o] of [['320x640', XS], ['360x640', SM], ['390x844', MOB], ['844x390', LAND]]) {
    const p = await mob(o);
    ok(await overflow(p) <= 0, `${name}: mapa sin desplazamiento horizontal`);
    await p.tap('#bContinue'); await wf(p, () => __t.view === 'escena'); await p.waitForTimeout(200);
    ok(await overflow(p) <= 0, `${name}: escena sin desplazamiento horizontal`);
    const small = await p.evaluate(() => [...document.querySelectorAll('#sceneView button, .top button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5); }).map(e => e.id || e.className));
    ok(!small.length, `${name}: botones de al menos 44 px ` + small.join(','));
    await p.tap('#bSettings'); await p.waitForTimeout(200);
    const dl = await p.evaluate(() => { const r = document.querySelector('#settings').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, small: [...document.querySelectorAll('#settings button, #settings .sw, #settings input[type=range]')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height < 43.5; }).map(e => e.id || e.className) }; });
    ok(dl.l >= 0 && dl.r <= dl.w && !dl.small.length, `${name}: los ajustes caben y sus controles miden 44 px ` + dl.small.join(','));
    ok(p.errs.length === 0, `${name}: sin errores ` + p.errs.join('|'));
    await p.context().close();
  }

  // 2) botón flotante: «Empezar» con la partitura a la vista (y el botón de la escena no), «Toca aquí» al jugar, «Detener» al escuchar
  let p = await mob(MOB);
  await p.tap('#bContinue'); await wf(p, () => __t.view === 'escena');
  await p.evaluate(() => document.querySelector('#bPractice').scrollIntoView({ block: 'center' })); await settle(p);
  ok(await until(p, () => document.querySelector('#tapFab').hidden), 'con «Empezar la escena» a la vista no sale el flotante');
  await p.evaluate(() => scrollTo(0, 0)); await settle(p);
  ok(await until(p, () => !document.querySelector('#tapFab').hidden && document.querySelector('#fabMain').textContent === 'Empezar'), 'con la partitura a la vista y el botón no, sale «Empezar»');
  const pt = await p.evaluate(() => document.querySelector('#padMain').textContent + ' ' + document.querySelector('#padSub').textContent);
  ok(!/tecla|teclado|\bEsc\b|espaciadora/i.test(pt) && /botón grande/.test(pt), 'textos de la partitura sin teclado: ' + pt);
  await p.tap('#tapFab'); await waitRunning(p, 'practice');
  ok(await until(p, () => document.querySelector('#tapFab').classList.contains('split') && !document.querySelector('#fabRestart').hidden), 'tocar «Empezar» empieza la escena: «Toca aquí» con «Reiniciar» a la izquierda');
  ok(await p.evaluate(() => document.querySelector('#bPractice').disabled), 'durante la escena «Empezar la escena» no responde (un toque desviado la reiniciaría)');
  // un toque en el botón cuenta
  await p.waitForFunction(() => __t.heardAt() > __t.S.tapFrom + 0.05);
  await p.tap('#tapFab');
  ok(await until(p, () => __t.S.taps.length >= 1), 'tocar el botón flotante es tocar');
  await p.evaluate(() => stop()); await waitStopped(p);
  await p.tap('#bPlay'); await waitRunning(p, 'play');
  await p.evaluate(() => scrollTo(0, 99999)); await settle(p);
  ok(await until(p, () => !document.querySelector('#tapFab').hidden && document.querySelector('#fabMain').textContent === 'Detener' && document.querySelector('#tapFab').classList.contains('stopb')), '«Escuchar»: el flotante dice «Detener»');
  await p.waitForTimeout(400);
  ok(await p.textContent('#fabMain') === 'Detener', 'la cuenta previa de «Escuchar» no pisa «Detener»');
  await p.tap('#tapFab');
  ok(await until(p, () => !__t.S.running), '…y lo para');
  ok(p.errs.length === 0, 'sin errores ' + p.errs.join('|')); await p.context().close();
  // escritorio: sin botón flotante y con ayudas de teclado
  p = await page(b); await open(p, URL); await p.click('#bContinue'); await wf(p, () => __t.view === 'escena');
  await p.click('#bPlay'); await waitRunning(p, 'play');
  ok(await p.evaluate(() => document.querySelector('#tapFab').hidden), 'escritorio: sin botón flotante');
  await p.keyboard.press('Escape'); await waitStopped(p);
  ok(/barra espaciadora/.test(await p.textContent('#padSub')), 'escritorio: la ayuda habla del teclado');
  await p.context().close();

  // 3) resultados encuadrados con el botón de tres partes
  for (const [name, o] of [['390x844', MOB], ['360x640', SM], ['844x390', LAND]]) {
    p = await mob(o);
    await openScene(p, 0, 100);
    await playAll(p); await postReady(p); await settle(p);
    const r = await p.evaluate(() => { const g = s => document.querySelector(s).getBoundingClientRect();
      return { t: g('#gRes').top, stats: g('#gResStats').bottom, pf: g('#postFab').top, card: g('.score-card').bottom, res: g('#results').top,
        practice: getComputedStyle(document.querySelector('.practice')).display, act: getComputedStyle(document.querySelector('.g-res-act')).display, det: document.querySelector('#rDetail').open, fab: document.querySelector('#tapFab').hidden }; });
    ok(r.t >= 0 && r.stats <= r.pf, `${name}: estrellas y puntos por encima del botón de tres partes (${Math.round(r.t)}–${Math.round(r.stats)} < ${Math.round(r.pf)})`);
    ok(r.res - r.card < 30 && r.practice === 'none', `${name}: resultados pegados a la partitura y sin el bloque de botones de la escena`);
    ok(r.act === 'none' && r.fab, `${name}: los botones del bloque no se repiten (están en el de tres partes)`);
    ok(!r.det, `${name}: el detalle de precisión empieza plegado`);
    ok(await overflow(p) <= 0, `${name}: sin desplazamiento horizontal`);
    if (name === '390x844') {
      ok(await p.evaluate(() => !document.querySelector('#pfNext').disabled), '«Siguiente» activo tras superar la escena');
      await p.tap('#pfNext');
      ok(await until(p, () => __t.sceneIdx === 1 && document.querySelector('#postFab').hidden && getComputedStyle(document.querySelector('.practice')).display !== 'none'), '«Siguiente» abre la escena siguiente y vuelve el bloque de botones');
      await openScene(p, 1, 100); await playAll(p); await postReady(p);
      await p.tap('#pfMap');
      ok(await until(p, () => __t.view === 'mapa' && document.querySelector('#postFab').hidden), '«Gira» vuelve al mapa');
    }
    ok(p.errs.length === 0, `${name}: sin errores ` + p.errs.join('|')); await p.context().close();
  }
  // sin el botón flotante (ajuste apagado) los botones del bloque sí se ven
  p = await page(b, MOB);
  await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('orquesta-desafinada-ajustes-v1', JSON.stringify({ seen: true, hold: false, fab: false })); } });
  await open(p, URL); await openScene(p, 0, 100); await playAll(p);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.g-res-act')).display !== 'none' && document.querySelector('#postFab').hidden), 'sin botón flotante: «Siguiente escena» y «Reintentar» siguen en el bloque');
  await p.context().close();

  // 4) pantallas bajas: botones fijos más bajos
  for (const [name, o, h] of [['390x844', MOB, 96], ['360x640', SM, 72], ['844x390', LAND, 72]]) {
    p = await mob(o); await openScene(p, 0, 100);
    await p.tap('#bPractice'); await waitRunning(p, 'practice'); await p.waitForFunction(() => !document.querySelector('#tapFab').hidden);
    const r = await p.evaluate(() => ({ fab: document.querySelector('#tapFab').getBoundingClientRect().height, rs: document.querySelector('#fabRestart').getBoundingClientRect().height }));
    ok(r.fab === h && r.rs === h, `${name}: botón flotante de ${h} px (${r.fab})`);
    await p.context().close();
  }

  // 5) resultado de «Medir latencia» a la vista
  p = await mob(MOB);
  await p.evaluate(() => { setView('escena'); startCalib(); S.taps = []; for (let k = 2; k < 16; k++) S.taps.push({ k, err: 30 + (k % 3) * 4 }); finishCalib(); });
  await settle(p);
  const cb = await p.evaluate(() => { const r = document.querySelector('#calib').getBoundingClientRect(); return { t: r.top, b: r.bottom, ih: innerHeight, vis: !document.querySelector('#calib').hidden }; });
  ok(cb.vis && cb.t >= 0 && cb.b <= cb.ih, 'medir latencia: el resultado queda a la vista ' + JSON.stringify({ t: Math.round(cb.t), b: Math.round(cb.b) }));
  ok(await p.$eval('#kVal', e => e.textContent) === '+35 ms', 'corrección sugerida +35 ms');
  ok(p.errs.length === 0, 'sin errores ' + p.errs.join('|')); await p.context().close();
});
