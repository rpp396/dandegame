// Seguridad y robustez de datos: lo guardado en localStorage no es de fiar. Datos maliciosos o corruptos no ejecutan nada ni rompen
// el arranque; la CSP está activa; el juego no pide nada fuera de su carpeta (también con file://).
const fs = require('fs');
const path = require('path');
const { suite, REPO } = require('./lib');

const PWN = '<img src=x onerror="window.__pwn=1">';
const KEY = 'orquesta-desafinada-ajustes-v1', PKEY = 'orquesta-desafinada-progreso-v1';

suite('Seguridad y robustez de datos', async ({ b, URL, ok, page, open, wf, waitResults }) => {
  // Página con localStorage sembrado (cadenas tal cual, aunque sean JSON roto) antes de que corra ningún script
  const seeded = async store => {
    const p = await page(b);
    await p.context().addInitScript(o => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const k in o) localStorage.setItem(k, o[k]); } }, store);
    return p;
  };
  // El DOM no contiene nada inyectado: ni <img src=x>, ni atributos on…, ni se ejecutó el payload
  const clean = p => p.evaluate(() => ({ pwn: window.__pwn, imgs: [...document.querySelectorAll('img')].filter(i => !i.src.startsWith('data:image/png')).length,
    on: [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length, polluted: ({}).polluted, map: document.querySelectorAll('#gMap .sc').length }));

  // 0) la página declara su CSP y el referrer, y no depende de nada externo
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8'), css = fs.readFileSync(path.join(REPO, 'styles.css'), 'utf8');
  const csp = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html) || [])[1] || '';
  ok(/script-src 'self'(;|$)/.test(csp) && !/unsafe-eval|unsafe-inline/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && /form-action 'none'/.test(csp) && /connect-src 'self'/.test(csp) && /default-src 'none'/.test(csp), 'index.html: CSP estricta (script-src \'self\', sin unsafe-*)');
  ok(/<meta name="referrer" content="no-referrer">/.test(html), 'index.html: referrer no-referrer');
  ok(!/googleapis|gstatic|https?:\/\//.test(html) && !/googleapis|gstatic|https?:\/\//.test(css), 'sin recursos externos en index.html ni styles.css');
  ok(!/\sstyle="/.test(html) && !/<script>/.test(html) && !/\son[a-z]+="/.test(html), 'index.html: sin style="", scripts ni manejadores en línea');
  ok(['AtkinsonHyperlegible', 'JetBrainsMono', 'YoungSerif'].every(f => fs.existsSync(path.join(REPO, 'fonts', `OFL-${f}.txt`))), 'fonts/: licencias OFL incluidas');
  const js = fs.readdirSync(path.join(REPO, 'js')).map(f => fs.readFileSync(path.join(REPO, 'js', f), 'utf8')).join('\n');
  ok(!/style=\\?"/.test(js) && !/\beval\(|new Function/.test(js) && !/solfeo-ritmico/.test(js), 'js/: sin style="" en cadenas, sin eval y sin claves de almacenamiento de otra app');

  // 1) CSP efectiva y fuentes locales
  {
    const p = await page(b); await open(p, URL);
    const fam = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')); });
    ok(['Atkinson Hyperlegible', 'JetBrains Mono', 'Young Serif'].every(f => fam.includes(f)), 'las tres fuentes locales se cargan: ' + [...new Set(fam)].join(', '));
    ok(p.ext.length === 0, 'sin peticiones fuera de 127.0.0.1 al arrancar: ' + p.ext.join(' '));
    await p.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<img src="x" onerror="window.__pwn2=1">'); const s = document.createElement('script'); s.textContent = 'window.__pwn3=1'; document.body.appendChild(s); document.body.insertAdjacentHTML('beforeend', '<i style="color:red" id="stl"></i>'); fetch('https://example.com/x').catch(() => {}); });
    await p.waitForTimeout(300);
    const v = await p.csp(), c = await p.evaluate(() => [window.__pwn2, window.__pwn3]);
    ok(c[0] === undefined && c[1] === undefined, 'la CSP bloquea un onerror y un script en línea inyectados');
    ok(v.some(x => x.startsWith('script-src-attr')) && v.some(x => x.startsWith('script-src-elem')) && v.some(x => x.startsWith('style-src-attr')) && v.some(x => x.startsWith('connect-src')), 'violaciones registradas (script-src-attr/elem, style-src-attr, connect-src): ' + v.map(x => x.split(' ')[0]).join(', '));
  }

  // 2) ajustes maliciosos o fuera de rango
  {
    const bad = { seen: true, offset: 'NaN', rhythmVol: 'abc', metroVol: -5, tapVol: {}, hold: 'yes', metro: 0, fab: PWN, gameId: PWN, view: PWN };
    const p = await seeded({ [KEY]: JSON.stringify(bad).replace(/^\{/, '{"__proto__":{"polluted":1},') });
    await open(p, URL);
    const r = await p.evaluate(() => { const s = __t.set; return { offset: s.offset, rv: s.rhythmVol, mv: s.metroVol, tv: s.tapVol, hold: s.hold, metro: s.metro, fab: s.fab, gameId: s.gameId, view: s.view, own: Object.keys(s).includes('polluted') }; });
    ok(r.offset === 0 && r.rv === 0.6 && r.mv === 0 && r.tv === 0.6, 'ajustes: corrección y volúmenes finitos y en rango ' + JSON.stringify(r));
    ok(r.hold === true && r.metro === true && r.fab === true && r.gameId === '' && r.view === 'mapa' && !r.own, 'ajustes: booleanos solo booleanos, ids y pantalla de listas cerradas, sin __proto__');
    const c = await clean(p);
    ok(c.map === 20 && c.pwn === undefined && c.imgs === 0 && c.on === 0 && c.polluted === undefined, 'ajustes maliciosos: el juego arranca, pinta el mapa y no ejecuta nada');
    const fixed = await p.evaluate(() => JSON.stringify(__t.cleanSettings({ offset: 9999, gameId: 'G3', view: 'escena', extra: 1 })));
    ok(/"offset":500/.test(fixed) && /"gameId":"G3"/.test(fixed) && !/extra/.test(fixed), 'cleanSettings acota y descarta campos desconocidos ' + fixed);
  }

  // 3) avance malicioso: escenas inventadas, claves heredadas y números absurdos
  {
    const prog = { scenes: { G1: { best: PWN, stars: PWN, tries: PWN, pts: PWN }, G2: { best: 1e9, stars: -3, tries: 'x', pts: 7 }, G3: { best: 80.6, stars: 2, tries: 4, pts: 1234 }, G999: { stars: 3 }, [PWN]: { stars: 3 } }, sessions: [PWN] };
    const p = await seeded({ [KEY]: JSON.stringify({ seen: true, view: 'escena', gameId: 'G4' }), [PKEY]: JSON.stringify(prog).replace('"G999"', '"__proto__":{"polluted":1},"constructor":{"stars":3},"G999"') });
    await open(p, URL);
    const info = await p.evaluate(() => ({ sc: JSON.stringify(__t.prog.scenes), keys: Object.keys(__t.prog), idx: __t.sceneIdx, view: __t.view }));
    ok(info.sc === '{"G1":{"best":0,"stars":0,"tries":0,"pts":0},"G2":{"best":100,"stars":0,"tries":0,"pts":7},"G3":{"best":81,"stars":2,"tries":4,"pts":1234}}', 'avance: solo ids de SCENES, números acotados ' + info.sc);
    ok(info.keys.join() === 'scenes', 'avance: campos desconocidos descartados');
    ok(info.view === 'escena' && info.idx === 3, 'la escena guardada (4: abierta porque la 3 tiene estrella) se reabre');
    const c = await clean(p);
    ok(c.pwn === undefined && c.imgs === 0 && c.on === 0 && c.polluted === undefined, 'arranque con avance malicioso: sin ejecución ni elementos inyectados');
    // segunda barrera: aunque un dato malo llegara a prog sin validar, el pintado lo escapa
    await p.evaluate(([pwn]) => { __t.prog.scenes.G1 = { best: pwn, stars: 1, tries: 1, pts: pwn }; __t.selectScene(0); __t.setView('mapa'); }, [PWN]);
    const c2 = await clean(p);
    ok(c2.imgs === 0 && c2.on === 0 && c2.pwn === undefined && (await p.csp()).length === 0, 'escape en el pintado: ficha y mapa aguantan datos sin validar (sin necesitar la CSP)');
    ok(p.errs.length === 0, 'sin errores de consola ' + p.errs.join(' | '));
  }

  // 4) JSON roto y tipos equivocados
  {
    const p = await seeded({ [KEY]: '{"seen":true,"view":', [PKEY]: '{"scenes":{' });
    await open(p, URL);
    ok((await clean(p)).map === 20 && p.errs.length === 0, 'JSON corrupto en las dos claves: el juego arranca con valores por defecto ' + p.errs.join(' | '));
    const q = await seeded({ [KEY]: 'null', [PKEY]: '[1,2]' });
    await open(q, URL);
    ok((await clean(q)).map === 20 && q.errs.length === 0, 'null / arrays: arranca');
    // localStorage que no deja guardar: aviso visible y el juego sigue
    const w = await page(b);
    await w.context().addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^orquesta/.test(k)) throw new Error('QuotaExceeded'); return o.call(this, k, v); }; });
    await open(w, URL);
    await w.click('#bContinue'); await wf(w, () => __t.view === 'escena');
    ok(await w.evaluate(() => !document.querySelector('#appWarn').hidden && /no deja guardar/.test(document.querySelector('#appWarn').textContent)) && w.errs.length === 0, 'sin poder guardar: aviso visible y sin errores');
  }

  // 5) el juego entero sin violaciones de CSP ni peticiones externas
  {
    const p = await seeded({ [KEY]: JSON.stringify({ seen: true, hold: false }) });
    await open(p, URL);
    await p.click('#bContinue'); await wf(p, () => __t.view === 'escena');
    await p.evaluate(() => { SCENES[0].bpm = 240; SCENES[0].bars = 1; __t.generate(); });
    await p.click('#bPlay'); await p.waitForFunction(() => __t.S.running && __t.S.mode === 'play'); await p.keyboard.press('Escape'); await p.waitForFunction(() => !__t.S.running);
    await p.click('#bPractice'); await waitResults(p);
    ok(await p.isVisible('#results'), 'escena completa con resultados');
    await p.click('#bSettings'); await p.click('#bCalib'); await p.waitForFunction(() => __t.S.running && __t.S.mode === 'calib'); await p.waitForTimeout(700); await p.keyboard.press('Escape'); await p.waitForFunction(() => !__t.S.running);
    await p.click('#bNew'); await p.click('#bMap'); await p.click('#bHelp'); await p.click('#bHelp');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
    const v = await p.csp();
    ok(v.length === 0, 'recorrido completo sin violaciones de CSP ' + v.join(' | '));
    ok(p.ext.length === 0, 'recorrido completo sin peticiones externas ' + p.ext.join(' '));
    ok(p.errs.length === 0, 'recorrido completo sin errores de consola ' + p.errs.join(' | '));
  }

  // 6) con file://: abrir index.html directamente (sin servidor) debe seguir funcionando con la CSP
  {
    const p = await page(b);
    await p.goto('file://' + path.join(REPO, 'index.html'));
    await p.waitForFunction(() => document.readyState === 'complete' && document.querySelectorAll('#gMap .sc').length === 20);
    await p.evaluate(() => document.fonts.ready);
    await p.click('#bContinue'); await p.waitForFunction(() => !document.querySelector('#sceneView').hidden && document.querySelectorAll('#score svg').length > 0);
    await p.click('#bPlay'); await p.waitForTimeout(500); await p.click('#bStop');
    await p.click('#bMap');
    const fam = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').length);
    ok((await p.csp()).length === 0 && p.errs.length === 0, 'file://: el juego arranca y navega sin violaciones de CSP ni errores ' + (await p.csp()).join(' | ') + p.errs.join(' | '));
    ok(fam >= 3 && p.ext.filter(u => !u.startsWith('file://')).length === 0, `file://: fuentes locales cargadas (${fam}) y sin peticiones externas`);
  }
});
