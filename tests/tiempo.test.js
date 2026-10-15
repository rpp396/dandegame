// Tiempo y audio: alineación de toques, evaluación de punta a punta, modo piano, cuenta previa, hora del toque, volumen en vivo,
// planificador con margen y latencia (medida y leída en cada toque)
const { suite } = require('./lib');

// Registra cada fuente de audio que se arranca: {w: hora pedida, now: currentTime al pedirla, buf: es de ruido (redoblante)}
const recordStarts = () => {
  window.__starts = [];
  [AudioScheduledSourceNode, AudioBufferSourceNode].forEach(C => { const st = C.prototype.start;
    C.prototype.start = function (w) { window.__starts.push({ w: w || 0, now: this.context.currentTime, buf: this instanceof AudioBufferSourceNode }); return st.apply(this, arguments); }; });
};
// Escena de prueba a medida: se cambian los datos de la 1-1 (figuras, compases, tempo) y se genera
const setRhythm = (p, o) => p.evaluate(o => { if (__t.view !== 'escena') selectScene(0); Object.assign(SCENES[0], { sig: '4/4', sync: false, ties: false, rests: [], need: [], ...o }); generate(); }, o);

suite('Tiempo y audio', async ({ b, URL, ok, page, open, until, wf, scheduleTaps, waitRunning, waitResults, waitStopped }) => {
  // 1) alineación óptima (función pura)
  let p = await page(b); await open(p, URL);
  const al = await p.evaluate(() => {
    const mk = (gap, n) => { const ns = Array.from({ length: n }, (_, j) => ({ t: 1 + j * gap })); ns.forEach(x => { x.win = Math.max(0.05, Math.min(0.18, gap / 2)); }); return ns; };
    const own = m => m.every((j, k) => j === k);
    const semi = mk(0.0625, 16), trip = mk(1 / 12, 12), semi160 = mk(60 / 160 / 4, 16);
    const r = {};
    r.semi35 = own(__t.alignTaps(semi, semi.map(n => n.t + 0.035)));
    r.trip45 = own(__t.alignTaps(trip, trip.map(n => n.t + 0.045)));
    r.semi160 = own(__t.alignTaps(semi160, semi160.map(n => n.t + 0.048)));
    const m = __t.alignTaps(semi, semi.filter((_, k) => k !== 5).map(n => n.t - 0.020));
    r.skip = m.filter(j => j < 0).length === 1 && m[5] === -1 && m.every((j, k) => k === 5 || j === (k < 5 ? k : k - 1));
    const q = mk(0.5, 4), m2 = __t.alignTaps(q, [1, 1.25, 1.5, 2, 2.5]);
    r.extra = JSON.stringify(m2) === '[0,2,3,4]';
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ei = mk(0.25, 64), m3 = __t.alignTaps(ei, ei.map(n => n.t + 0.010 + (rnd() + rnd() + rnd() - 1.5) * 0.05));
    r.human = own(m3);
    const big = mk(0.0625, 1024), a = performance.now(); __t.alignTaps(big, big.map(n => n.t + 0.02)); r.ms = performance.now() - a;
    return r;
  });
  ok(al.semi35, 'semicorcheas a 240 ppm, 35 ms tarde: cada toque con su nota');
  ok(al.trip45, 'tresillos a 240 ppm, 45 ms tarde: cada toque con su nota');
  ok(al.semi160, 'semicorcheas a 160 ppm, 48 ms tarde: cada toque con su nota');
  ok(al.skip, 'saltarse una nota (toques 20 ms antes): solo falla esa');
  ok(al.extra, 'un golpe de más no desplaza las notas siguientes');
  ok(al.human, 'toques con dispersión humana: cada uno con su nota');
  ok(al.ms < 1500, `alineación de 1024 notas en ${al.ms.toFixed(0)} ms`);

  // 2) de punta a punta: semicorcheas a 240 ppm tocadas 35 ms tarde
  await setRhythm(p, { figs: ['s'], bars: 2, bpm: 240 });
  ok(await p.evaluate(() => __t.score.flat.every(e => e.dur === 3 && !e.rest)), 'ritmo de semicorcheas');
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [35], null);
  await waitResults(p);
  const r240 = await p.evaluate(() => ({ pct: parseInt(document.querySelector('#rPct').textContent), miss: +document.querySelector('#cMiss').textContent, extra: +document.querySelector('#cExtra').textContent, trend: document.querySelector('#rTrend').textContent, hearts: __t.run.hearts }));
  ok(r240.pct >= 90 && r240.miss === 0 && r240.extra === 0, `240 ppm +35 ms: ${r240.pct} %, ${r240.miss} fallos, ${r240.extra} de más`);
  ok(r240.hearts === 5, 'y el escenario no quita ningún corazón (la asignación en directo acierta)');
  ok(r240.trend.includes('atrasarte'), 'tendencia «atrasarte»: ' + r240.trend);

  // 3) piano: la alineación también lleva la duración
  await setRhythm(p, { figs: ['q'], bars: 1, bpm: 120 });
  await p.evaluate(() => { __t.set.hold = true; });
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0], null); await waitResults(p);
  ok(await p.evaluate(() => !document.querySelector('#durCounts').hidden && +document.querySelector('#cExact').textContent === 4), 'modo piano: resultados con duraciones');
  await p.evaluate(() => { __t.set.hold = false; });

  // 4) cuenta previa: un compás; el filtro de la cuenta respeta la corrección de latencia
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  ok(await p.evaluate(() => Math.abs(__t.S.passStart - __t.S.t0 - __t.score.L * __t.S.spt) < 1e-6), 'la escena empieza tras un compás de cuenta');
  await p.click('#bStop'); await waitStopped(p);
  await setRhythm(p, { figs: ['q'], bars: 1, bpm: 240 });
  await p.evaluate(() => { __t.set.offset = 200; });
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await p.waitForFunction(() => __t.heardAt() >= __t.S.passStart - __t.S.spt * 12 + 0.2);
  await p.keyboard.press('Space');
  await p.waitForTimeout(30);
  ok(await p.evaluate(() => __t.S.taps.length === 0 && __t.run.hearts === 5), 'toque en el último tiempo de la cuenta (+200 ms) ignorado (ni golpe de más ni corazón)');
  await p.click('#bStop'); await p.evaluate(() => { __t.set.offset = 0; });

  // 5) hora del toque = la del evento, no la del manejador
  await setRhythm(p, { figs: ['q'], bars: 1, bpm: 60 });
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await p.waitForFunction(() => __t.heardAt() >= __t.S.notes[0].t - 0.1);
  const lag = await p.evaluate(() => {
    while (__t.heardAt() < __t.S.notes[0].t);
    const e = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true });
    const end = performance.now() + 80; while (performance.now() < end); // el hilo principal tarda 80 ms en atender el toque
    document.dispatchEvent(e); return (__t.S.taps[0].t - __t.S.notes[0].t) * 1000;
  });
  ok(Math.abs(lag) < 25, `toque atendido 80 ms tarde: desvío ${lag.toFixed(1)} ms`);
  await p.click('#bStop');

  // 6) volumen en vivo
  await p.click('#bPlay'); await waitRunning(p, 'play');
  await p.evaluate(() => { const v = document.querySelector('#metroVol'); v.value = 0.2; v.dispatchEvent(new Event('input')); const r = document.querySelector('#rhythmVol'); r.value = 0.3; r.dispatchEvent(new Event('input')); });
  ok(await until(p, () => Math.abs(__t.S.mBus.gain.value - 0.2) < 0.02 && Math.abs(__t.S.rBus.gain.value - 0.3) < 0.02), 'el volumen del metrónomo y de «Escuchar» cambia mientras suena');
  await p.click('#bStop');
  ok(p.errs.length === 0, 'sin errores ' + p.errs.join('|')); await p.context().close();

  // 7) planificador con margen, «Escuchar» completo, metrónomo durante la escena y compases compuestos
  p = await page(b); await p.addInitScript(recordStarts); await open(p, URL);
  await setRhythm(p, { figs: ['s'], bars: 64, bpm: 30 });
  await p.evaluate(() => { __t.set.hold = false; window.__starts = []; });
  const t = await p.evaluate(() => { const a = performance.now(); __t.start('play'); return performance.now() - a; });
  const nodes = await p.evaluate(() => __t.liveSrc.size);
  ok(nodes < 120, `64 compases: ${nodes} fuentes programadas al empezar (start ${t.toFixed(0)} ms)`);
  await p.waitForTimeout(1500);
  ok(await p.evaluate(() => __t.S.running && __t.liveSrc.size > 0 && __t.liveSrc.size < 120), 'sigue sonando con pocas fuentes vivas: ' + await p.evaluate(() => __t.liveSrc.size));
  await p.click('#bStop');
  ok(await p.evaluate(() => __t.liveSrc.size) === 0, 'al detener no queda ninguna fuente pendiente');
  // «Escuchar» en batería: una nota de redoblante por cabeza
  await setRhythm(p, { figs: ['q', 'e'], bars: 4, bpm: 240 });
  await p.evaluate(() => { window.__starts = []; });
  await p.click('#bPlay'); await waitRunning(p, 'play'); await waitStopped(p);
  const nn = await p.evaluate(() => [__starts.filter(s => s.buf).length, __t.score.flat.filter(e => !e.rest && !e.tie).length]);
  ok(nn[0] === nn[1], '«Escuchar»: suenan todas las notas ' + nn.join('/'));
  // clics por compás: con metrónomo, cuenta + compases; sin él, solo la cuenta
  const clicks = async (metro, o) => {
    await setRhythm(p, o); await p.evaluate(m => { __t.set.metro = m; window.__starts = []; }, metro);
    await p.click('#bPractice'); await waitRunning(p, 'practice');
    await p.waitForFunction(() => __t.heardAt() > __t.S.passStart + __t.S.passDur + 0.1, null, { timeout: 20000 });
    const n = await p.evaluate(() => __starts.filter(s => !s.buf && s.w > 0).length);
    await p.keyboard.press('Escape'); await waitStopped(p); return n;
  };
  ok(await clicks(true, { figs: ['q'], bars: 2, bpm: 240 }) === 12, 'metrónomo durante la escena: 4 de cuenta + 8 clics en 4/4');
  ok(await clicks(false, { figs: ['q'], bars: 2, bpm: 240 }) === 4, 'sin metrónomo: solo los 4 de la cuenta');
  ok(await clicks(false, { sig: '6/8', figs: ['qd'], bars: 1, bpm: 160 }) === 6, '6/8: la cuenta previa marca las 6 corcheas');
  await p.evaluate(() => { __t.set.metro = true; });
  // tras una pausa del hilo principal no suena lo atrasado de golpe
  await setRhythm(p, { figs: ['q'], bars: 8, bpm: 120 });
  await p.evaluate(() => { window.__starts = []; }); await p.click('#bPlay'); await waitRunning(p, 'play');
  await p.evaluate(ms => { const end = performance.now() + ms; while (performance.now() < end); }, 2500); await p.waitForTimeout(600);
  ok(await p.evaluate(() => __starts.filter(s => s.w < s.now - 0.03).length) === 0, '«Escuchar»: tras 2,5 s bloqueado no se amontonan sonidos');
  await p.click('#bStop');
  ok(p.errs.length === 0, 'sin errores ' + p.errs.join('|')); await p.context().close();

  // 8) latencia de salida leída en cada toque, no al crear el audio (cuando aún vale 0).
  // Los toques se disparan con una referencia independiente: currentTime − outputLatency del momento.
  const fireHeard = (p, list) => p.evaluate(list => {
    const c = __t.ctx, key = t => document.dispatchEvent(new KeyboardEvent(t, { code: 'Space', key: ' ', bubbles: true }));
    list.forEach(at => { const iv = setInterval(() => { if (c.currentTime - c.outputLatency >= at) { clearInterval(iv); key('keydown'); setTimeout(() => key('keyup'), 40); } }, 2); });
  }, list);
  p = await page(b); await open(p, URL);
  await setRhythm(p, { figs: ['q'], bars: 2, bpm: 120 });
  ok(await p.evaluate(() => !__t.ctx), 'el audio aún no existe');
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await fireHeard(p, await p.evaluate(() => __t.S.notes.map(n => n.t)));
  await waitResults(p);
  const m1 = await p.evaluate(() => parseInt(document.querySelector('#rPct').textContent));
  ok(m1 >= 90, `primera escena tras abrir la página: ${m1} % (sin desvío por latencia)`);
  await p.context().close();

  // la medición de latencia (desde Ajustes) como primera acción no absorbe la latencia de salida
  p = await page(b); await open(p, URL);
  await p.click('#bSettings'); await p.click('#bCalib'); await waitRunning(p, 'calib');
  ok(await p.evaluate(() => !document.querySelector('#settings').open && __t.view === 'escena'), 'medir latencia cierra los ajustes y mide sobre la escena');
  await fireHeard(p, await p.evaluate(() => Array.from({ length: 16 }, (_, k) => __t.S.passStart + k * __t.S.period)));
  await wf(p, () => !document.querySelector('#calib').hidden, null, 25000);
  const sug = await p.evaluate(() => __t.K.suggest);
  ok(sug != null && Math.abs(sug) <= 10, `medición como primera acción: corrección sugerida ${sug} ms`);
  await p.evaluate(() => { __t.K.suggest = 40; document.querySelector('#kApply').disabled = false; });
  await p.click('#kApply');
  ok(await p.evaluate(() => __t.set.offset === 40 && document.querySelector('.offset-now').textContent === '+40 ms' && JSON.parse(localStorage.getItem('orquesta-desafinada-ajustes-v1')).offset === 40), '«Aplicar corrección» guarda la corrección y la muestra');
  ok(p.errs.length === 0, 'sin errores ' + p.errs.join('|')); await p.context().close();
});
