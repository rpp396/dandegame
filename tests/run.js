#!/usr/bin/env node
// Ejecuta todas las suites de tests/*.test.js, una tras otra, cada una en su propio proceso.
// Uso:  node tests/run.js [filtro ...]     (p. ej. node tests/run.js ej dock)
// Sale con código 1 si alguna prueba falla. Requiere Playwright y Chromium (ver README).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const filters = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()
  .filter(f => !filters.length || filters.some(x => f.includes(x)));
if (!files.length) { console.error('No hay suites que coincidan con: ' + filters.join(' ')); process.exit(1); }

function runOne(file) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(__dirname, file)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', d => { out += d; process.stdout.write(d); });
    child.on('close', code => {
      const m = out.match(/^# (.*): (\d+) ok, (\d+) fallos$/m);
      resolve({ file, code, name: m ? m[1] : file, pass: m ? +m[2] : 0, fail: m ? +m[3] : 0, secs: (Date.now() - t0) / 1000, summary: !!m });
    });
  });
}

(async () => {
  const t0 = Date.now(), res = [];
  for (const f of files) { res.push(await runOne(f)); console.log(''); }
  console.log('Resumen');
  for (const r of res) {
    const bad = r.code !== 0 || r.fail > 0 || !r.summary;
    console.log(`  ${bad ? 'FALLA' : 'ok   '}  ${r.file.padEnd(20)} ${String(r.pass).padStart(3)} ok, ${r.fail} fallos  (${r.secs.toFixed(1)} s)` + (!r.summary ? '  [la suite no terminó: ver la salida de arriba]' : ''));
  }
  const pass = res.reduce((s, r) => s + r.pass, 0), fail = res.reduce((s, r) => s + r.fail, 0);
  const bad = res.some(r => r.code !== 0 || r.fail > 0 || !r.summary);
  console.log(`\n${res.length} suites, ${pass} pruebas ok, ${fail} fallos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(bad ? 1 : 0);
})();
