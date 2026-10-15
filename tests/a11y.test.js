// Accesibilidad (WCAG 2.2 AA): contraste, estructura, nombres accesibles, foco (mapa, flechas, diálogo, confirmaciones), «Reiniciar» con
// teclado, deslizadores, formas de los marcadores, movimiento reducido y colores forzados
const fs = require('fs');
const path = require('path');
const { suite, REPO } = require('./lib');

/* ---------- Contraste calculado desde styles.css ---------- */
const css = fs.readFileSync(path.join(REPO, 'styles.css'), 'utf8');
const vars = b => { const o = {}; b.replace(/--([\w-]+):\s*([^;]+);/g, (m, k, v) => { o[k] = v.trim(); }); return o; };
const LIGHT = vars(css.match(/:root\{([^}]*)\}/)[1]);
const DARK = { ...LIGHT, ...vars(css.match(/:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/)[1]) };
const rgba = s => { let m;
  if ((m = /^#([0-9a-f]{6})$/i.exec(s))) return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16)).concat(1);
  if ((m = /^rgba?\(([^)]+)\)/.exec(s))) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error('color no reconocido: ' + s); };
const over = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
const lum = c => c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
// [descripción, color del texto o componente, fondo (nombre o [nombre, 'sobre fondo'] para un color translúcido), mínimo]
const PAIRS = [
  ['texto ink/paper', 'ink', 'paper', 4.5], ['texto muted/bg', 'muted', 'bg', 4.5], ['texto muted/panel', 'muted', 'panel', 4.5], ['texto muted/paper', 'muted', 'paper', 4.5],
  ['texto accent/paper', 'accent', 'paper', 4.5], ['botón primario accent-ink/accent', 'accent-ink', 'accent', 4.5],
  ['escena superada (muted sobre accent-soft/panel)', 'muted', ['accent-soft', 'panel'], 4.5], ['título de escena ink sobre accent-soft/panel', 'ink', ['accent-soft', 'panel'], 4.5],
  ['bad/paper', 'bad', 'paper', 4.5], ['aviso ink sobre bad-soft/bg', 'ink', ['bad-soft', 'bg'], 4.5],
  ['borde de controles (ui/paper)', 'ui', 'paper', 3], ['borde de controles (ui/panel)', 'ui', 'panel', 3],
  ['bolita del interruptor sobre la pista (paper/ui)', 'paper', 'ui', 3],
  ['estrella sin ganar (ui/paper)', 'ui', 'paper', 3], ['estrella ganada (star/panel)', 'star', 'panel', 3], ['estrella ganada (star sobre accent-soft/panel)', 'star', ['accent-soft', 'panel'], 3],
  ['pentagrama (staff/paper)', 'staff', 'paper', 3],
  ['marcador exacto (good/paper)', 'good', 'paper', 3], ['marcador bien (ok/paper)', 'ok', 'paper', 3], ['marcador cerca (near/paper)', 'near', 'paper', 3], ['marcador fallo (bad/paper)', 'bad', 'paper', 3],
  // bloques de noche (iguales en claro y oscuro)
  ['texto night-ink/night', 'night-ink', 'night', 4.5], ['texto night-sub/night', 'night-sub', 'night', 4.5], ['oro gold/night', 'gold', 'night', 4.5],
];

suite('Accesibilidad', async ({ b, URL, ok, MOB, page, open, until, wf, waitRunning, waitResults, scheduleTaps, openScene }) => {
  for (const [nombre, T] of [['claro', LIGHT], ['oscuro', DARK]]) {
    const col = n => rgba(T[n]);
    const bad = [];
    for (const [d, f, bg, min] of PAIRS) {
      const back = Array.isArray(bg) ? over(col(bg[0]), col(bg[1])) : col(bg);
      const fore = col(f), r = ratio(fore[3] < 1 ? over(fore, back) : fore, back);
      if (r < min) bad.push(`${d} ${r.toFixed(2)} < ${min}`);
    }
    ok(!bad.length, `contraste ${nombre}: ${PAIRS.length} pares (texto ≥ 4,5 y componentes ≥ 3)` + (bad.length ? ' — falla: ' + bad.join('; ') : ''));
  }

  /* ----- Estructura: main, salto, encabezados, nombres ----- */
  let p = await page(b); await open(p, URL);
  ok(await p.$$eval('main', m => m.length === 1 && !m[0].hasAttribute('role')), 'hay un único <main> real');
  ok(await p.$eval('h1', h => h.textContent === 'Orquesta desafinada') && await p.$eval('#mapView', s => s.getAttribute('aria-labelledby') === 'mapTitle'), 'h1 del juego y la gira como sección con título');
  await p.keyboard.press('Tab');
  ok(await p.evaluate(() => document.activeElement.id === 'skip' && /Saltar al juego/.test(document.activeElement.textContent)), 'el primer Tab llega al enlace «Saltar al juego»');
  ok(await p.$eval('#skip', e => e.getBoundingClientRect().top >= 0), 'el enlace de salto se ve al enfocarlo');
  await p.keyboard.press('Enter');
  ok(await until(p, () => document.activeElement.id === 'main'), 'en el mapa, el salto lleva al contenido principal');
  ok(await p.$$eval('button > svg:not([aria-hidden])', a => a.length === 0), 'los iconos SVG de los botones son decorativos (aria-hidden)');
  ok(await p.$$eval('#gMap .sc', a => a.every(x => x.getAttribute('aria-label') && x.querySelector('.stars'))), 'cada escena del mapa es un botón con nombre completo');
  ok(await p.$eval('#gMap .sc[data-lv="2"]', e => /^Escena 1-3: .+, bloqueada$/.test(e.getAttribute('aria-label')) && e.getAttribute('aria-disabled') === 'true' && !e.disabled), 'escena bloqueada: «…, bloqueada», aria-disabled y enfocable');
  ok(await p.$eval('#gMap .sc[data-lv="3"]', e => /\(jefa\)/.test(e.getAttribute('aria-label'))), 'las escenas de jefa lo dicen');
  // foco conservado al repintar el mapa
  await p.focus('#gMap .sc[data-lv="2"]'); await p.evaluate(() => renderMap());
  ok(await p.evaluate(() => document.activeElement.dataset.lv === '2'), 'al repintar el mapa el foco sigue en la misma escena');
  await p.keyboard.press('Enter');
  ok(await until(p, () => /bloqueada/.test(document.querySelector('#srLive').textContent)) && await p.evaluate(() => __t.view === 'mapa'), 'Intro en una escena bloqueada solo lo anuncia');
  await p.focus('#gMap .sc[data-lv="0"]'); await p.keyboard.press('Enter');
  ok(await until(p, () => __t.view === 'escena' && document.activeElement.id === 'pad'), 'Intro en una escena la abre y el foco va a la partitura');

  // escena: partitura, ficha y estrellas
  const pad = await p.$eval('#pad', e => ({ role: e.getAttribute('role'), label: e.getAttribute('aria-label'), desc: e.getAttribute('aria-describedby') }));
  ok(pad.role === 'group' && /Partitura/.test(pad.label) && /padMain/.test(pad.desc), '#pad es un grupo con nombre y su estado (#padMain/#padSub) accesible ' + JSON.stringify(pad));
  const syss = await p.$$eval('#score svg.sys', a => a.map(s => s.getAttribute('aria-label')));
  ok(syss.length > 0 && /Ritmo en 4\/4\. Compás 1: (cuatro negras|negra)/.test(syss[0]), 'cada sistema tiene texto equivalente: «' + syss[0].slice(0, 80) + '…»');
  ok(await p.$eval('#lvStars', e => e.getAttribute('role') === 'img' && /de 3 estrellas/.test(e.getAttribute('aria-label'))) && await p.$eval('#gHearts', e => e.getAttribute('role') === 'img' && e.getAttribute('aria-label') === '5 de 5 corazones'), 'estrellas y corazones: role=img con texto');
  ok(await p.$eval('#gCanvas', e => e.getAttribute('role') === 'img' && e.getAttribute('aria-label').length > 20) && await p.$eval('.g-cap', e => e.getAttribute('aria-hidden') === 'true'), 'escenario con nombre; sus rótulos, ocultos al lector (lo importante se anuncia)');
  ok(await p.$eval('#lvTitle', e => e.tagName === 'H2') && await p.$eval('#sceneView', e => e.getAttribute('aria-labelledby') === 'lvTitle'), 'la escena se titula con el nombre de la escena (h2)');
  // «Escena anterior» se apaga: el foco no cae en <body>
  await p.evaluate(() => { prog.scenes.G1 = { best: 90, stars: 2, tries: 1, pts: 500 }; selectScene(1); });
  await p.focus('#lvPrev'); await p.keyboard.press('Enter');
  ok(await until(p, () => __t.sceneIdx === 0) && await p.evaluate(() => document.activeElement !== document.body && document.activeElement.id === 'lvNext'), 'al apagarse «Escena anterior» el foco pasa a «Escena siguiente»');
  await p.evaluate(() => { prog.scenes = {}; selectScene(0); });

  /* ----- Ajustes: diálogo modal ----- */
  await p.focus('#bSettings'); await p.keyboard.press('Enter');
  ok(await until(p, () => document.querySelector('#settings').open && document.querySelector('#settings').contains(document.activeElement)), 'Ajustes abre un diálogo modal con el foco dentro');
  ok(await p.$eval('#settings', d => d.getAttribute('aria-labelledby') === 'setTitle' && d.matches(':modal')), 'el diálogo tiene nombre y es modal');
  const vt = await p.evaluate(() => ['rhythmVol', 'metroVol', 'tapVol', 'offset'].map(id => document.getElementById(id).getAttribute('aria-valuetext')));
  ok(vt.every(Boolean) && /%$/.test(vt[0]) && /ms$/.test(vt[3]), 'deslizadores con aria-valuetext con unidad: ' + vt.join(' | '));
  await p.fill('#offset', '15'); await p.dispatchEvent('#offset', 'input');
  ok(await p.$eval('#offset', e => e.getAttribute('aria-valuetext') === '+15 ms'), 'el aria-valuetext se actualiza al mover el deslizador');
  // forma de tocar: los dos selectores van sincronizados
  await p.click('#settings .modeseg button[data-hold="1"]');
  ok(await p.evaluate(() => __t.set.hold === true && document.querySelector('#modeSeg [data-hold="1"]').getAttribute('aria-pressed') === 'true'), 'la forma de tocar elegida en Ajustes se ve también en la escena (aria-pressed)');
  // confirmaciones
  await p.focus('#resetSet'); await p.keyboard.press('Enter');
  ok(await p.evaluate(() => document.activeElement.id === 'resetNo' && document.querySelector('#resetBox').getAttribute('role') === 'group' && document.activeElement.getAttribute('aria-describedby') === document.querySelector('#resetBox').getAttribute('aria-labelledby')), 'Restablecer: pregunta asociada al grupo y a «Cancelar»');
  await p.keyboard.press('Enter');
  ok(await p.evaluate(() => document.activeElement.id === 'resetSet'), 'Cancelar devuelve el foco a «Restablecer ajustes»');
  await p.focus('#pClear'); await p.keyboard.press('Enter');
  ok(await p.evaluate(() => document.activeElement.id === 'pClearNo' && document.querySelector('#pClearBox').getAttribute('role') === 'group'), 'Borrar el avance: confirmación con el foco en «Cancelar»');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Escape');
  ok(await until(p, () => !document.querySelector('#settings').open && document.activeElement.id === 'bSettings'), 'Esc cierra el diálogo y el foco vuelve a «Ajustes»');
  // bienvenida desde «Cómo se juega»
  await p.click('#bHelp');
  ok(await until(p, () => !document.querySelector('#welcome').hidden && document.activeElement.id === 'welTitle' && document.querySelector('#bHelp').getAttribute('aria-expanded') === 'true'), '«Cómo se juega» abre la explicación y lleva el foco a su título');
  await p.click('#welOk');
  ok(await p.evaluate(() => document.querySelector('#welcome').hidden && document.querySelector('#bHelp').getAttribute('aria-expanded') === 'false'), '«¡A escena!» la cierra');
  ok(p.errs.length === 0, 'sin errores ' + p.errs.join('|'));
  await p.close();

  /* ----- Movimiento reducido y colores forzados ----- */
  p = await page(b); await p.emulateMedia({ reducedMotion: 'reduce' }); await open(p, URL);
  ok(await p.evaluate(() => smooth() === 'auto'), 'con prefers-reduced-motion los desplazamientos pasan a instantáneos');
  await p.close();
  p = await page(b); await p.emulateMedia({ forcedColors: 'active' }); await open(p, URL);
  await p.click('#bContinue'); await wf(p, () => __t.view === 'escena');
  const fc = await p.evaluate(() => getComputedStyle(document.querySelector('.modeseg button[aria-pressed=true]')).textDecorationLine);
  ok(/underline/.test(fc), 'forced-colors: la forma de tocar elegida se distingue por subrayado ' + fc);
  await p.close();

  /* ----- Resultados: Exacto / Bien / Cerca con formas distintas ----- */
  p = await page(b); await open(p, URL);
  await openScene(p, 0, 90);
  await p.click('#bPractice'); await waitRunning(p, 'practice');
  await scheduleTaps(p, [0, 65, 125]);
  await waitResults(p);
  const shapes = await p.evaluate(() => {
    const q = c => [...document.querySelectorAll('#score .mk.j-' + c)].map(e => e.tagName + ':' + getComputedStyle(e).fill + ':' + getComputedStyle(e).stroke);
    return { exact: q('exact'), good: q('good'), near: q('near') };
  });
  ok(shapes.exact.length && shapes.exact.every(s => /^circle:rgb/.test(s) && !/none/.test(s.split(':')[1])), 'exacto = círculo lleno ' + shapes.exact.length);
  ok(shapes.good.length && shapes.good.every(s => /^circle:none:/.test(s)), 'bien = anillo (sin relleno) ' + shapes.good.length);
  ok(shapes.near.length === 0 || shapes.near.every(s => /^path:/.test(s)), 'cerca = rombo (path) ' + shapes.near.length);
  ok(await p.$$eval('.counts .sw-dot', a => a.every(s => s.getAttribute('aria-hidden') === 'true')), 'los puntos de color de los contadores son decorativos');
  ok(await p.$eval('#gResHead', e => e.tagName === 'H2') && await p.$eval('#gResStars', e => e.getAttribute('role') === 'img'), 'el resultado de la escena lleva h2 y estrellas con texto');
  await p.close();

  /* ----- Móvil: «Reiniciar» con teclado y foco no tapado ----- */
  p = await page(b, MOB); await open(p, URL);
  await p.tap('#bContinue'); await wf(p, () => __t.view === 'escena');
  await p.tap('#bPractice'); await waitRunning(p, 'practice');
  await p.waitForSelector('#fabRestart', { state: 'visible' });
  ok(await p.evaluate(() => document.getElementById('fabRestart').getAttribute('aria-describedby') === 'restartHelp' && /Intro o Espacio/.test(document.getElementById('restartHelp').textContent)), '«Reiniciar»: su ayuda dice que con teclado basta Intro o Espacio');
  ok(await p.evaluate(() => !document.getElementById('tapFab').hasAttribute('aria-label') && document.getElementById('tapFab').textContent.length > 0), '#tapFab: nombre accesible = su texto visible');
  await p.evaluate(() => { window.__taps = 0; const o = window.tap; window.tap = (...a) => { window.__taps++; return o(...a); }; });
  const t0 = await p.evaluate(() => __t.S.passStart);
  await p.focus('#fabRestart'); await p.keyboard.press('Enter');
  ok(await until(p, t => __t.S.running && __t.S.mode === 'practice' && __t.S.passStart !== t, t0), 'Intro en «Reiniciar» reinicia la escena al instante');
  const t1 = await p.evaluate(() => __t.S.passStart);
  await p.focus('#fabRestart'); await p.keyboard.press('Space');
  ok(await until(p, t => __t.S.passStart !== t, t1), 'Espacio en «Reiniciar» también reinicia');
  ok(await p.evaluate(() => window.__taps === 0), 'y no cuentan como toques');
  await p.keyboard.press('Escape'); await wf(p, () => !__t.S.running);
  // foco no tapado por el botón flotante (2.4.11): se recorre la escena con Tab
  await p.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); document.querySelector('#bMap').focus(); });
  const tapado = []; let vistos = 0;
  for (let i = 0; i < 25; i++) {
    await p.keyboard.press('Tab');
    const r = await p.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const pin = ['#tapFab', '#postFab'].map(s => document.querySelector(s)).find(x => !x.hidden);
      if (!pin || a.closest('#tapFab,#postFab,#fabRestart')) return { skip: true };
      const e = a.getBoundingClientRect(), t = pin.getBoundingClientRect();
      if (!e.width || !e.height) return { skip: true };
      return { tapado: e.bottom > t.top + 1 && e.top < t.bottom, id: a.id || a.tagName };
    });
    if (r && !r.skip) { vistos++; if (r.tapado) tapado.push(JSON.stringify(r)); }
  }
  ok(!tapado.length, `390 px: ningún control enfocado queda bajo el botón flotante (${vistos} comprobados)` + (tapado.length ? ' — tapados: ' + tapado.slice(0, 4).join(' ') : ''));
  ok(p.errs.length === 0, 'sin errores ' + p.errs.join('|'));
  await p.close();
});
