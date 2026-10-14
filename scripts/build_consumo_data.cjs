/**
 * Construye src/lib/salidaInsumosData.ts a partir de scripts/consumo_insumos_raw.json
 * (generado por extract_consumo_insumos.cjs).
 *
 * Reglas de calidad:
 *  - Se ignoran los archivos consolidados ("TODAS LAS SALIDAS ...") porque repiten el detalle.
 *  - La fecha de cada bloque se valida contra los días indicados en el nombre del archivo.
 *    Si no coincide y el contenido es único, se corrige al día del nombre del archivo.
 *    Si el contenido es idéntico al de otro archivo (copia sin actualizar), se descarta.
 *  - Los nombres se normalizan contra el inventario (src/inventory_data.json).
 *
 * Uso:  node scripts/build_consumo_data.cjs [--report]   (--report no escribe el .ts)
 */
const fs = require('fs');
const path = require('path');

const REPORT_ONLY = process.argv.includes('--report');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'consumo_insumos_raw.json'), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'inventory_data.json'), 'utf8'));

const MONTHS = { ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 };
const key = (s) => String(s || '').toUpperCase().replace(/[\s\-_.]/g, '');

// ── Inventario ──
const invByKey = new Map();
inventory.forEach(i => invByKey.set(key(i.ref), i));
const ALIASES = {
  [key('ORIOMCROMREDNEW')]: 'ORIOMCROMRED AID',
  [key('ORIOMCROM RED AID')]: 'ORIOMCROMRED AID',
  [key('CONCENTRATEMCP')]: 'CONCENTRATE M-SP',
  [key('CONCENTRATEMCP90%')]: 'CONCENTRATE M-SP',
  [key('GLISERINA')]: 'GLICERINA',
};
function findInv(product) {
  const k = key(product);
  if (ALIASES[k]) return invByKey.get(key(ALIASES[k]));
  return invByKey.get(k);
}

function getHexColor(name) {
  const n = name.toLowerCase();
  if (n.includes('fucsia') || n.includes('magenta')) return '#d946ef';
  if (n.includes('amarillo oro') || n.includes('jakofix') || n.includes('amarillo2r')) return '#eab308';
  if (n.includes('amarillo') || n.includes('yellow')) return '#facc15';
  if (n.includes('naranja') || n.includes('orange')) return '#f97316';
  if (n.includes('cereza') || n.includes('red aid') || n.includes('rojo')) return '#ef4444';
  if (n.includes('turq') || n.includes('turquesa')) return '#06b6d4';
  if (n.includes('royal')) return '#2563eb';
  if (n.includes('navy') || n.includes('azul oscuro')) return '#1e3a8a';
  if (n.includes('azul') || n.includes('blue') || n.includes('suncoat')) return '#3b82f6';
  if (n.includes('verde') || n.includes('green')) return '#22c55e';
  if (n.includes('super black') || n.includes('black') || n.includes('negro')) return '#0f172a';
  if (n.includes('prestovil') || n.includes('base') || n.includes('rfs') || n.includes('concentrate') || n.includes('espesante')) return '#f8fafc';
  if (n.includes('urea') || n.includes('bicarbonato') || n.includes('carbonato') || n.includes('alcohol') || n.includes('pva') || n.includes('glicerina')) return '#f1f5f9';
  if (n.includes('asutol')) return '#ca8a04';
  if (n.includes('bicromato') || n.includes('bicro')) return '#ea580c';
  return '#94a3b8';
}

// ── Días esperados según el nombre del archivo ──
function expectedDays(file) {
  const parts = file.split('/');
  const folder = (parts[0] || '').toUpperCase();
  const month = MONTHS[folder];
  const base = parts[parts.length - 1].replace(/\.xlsx?$/i, '');
  const afterMonth = base.replace(/SALIDAS.*$/i, '');
  const nums = (afterMonth.match(/\d{1,2}/g) || []).map(Number).filter(n => n >= 1 && n <= 31);
  if (!month || nums.length === 0) return null;
  const days = [...new Set(nums.slice(0, 2))];
  return days.map(d => `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}

// ── Agrupar por bloque (archivo+hoja+columna) ──
const blocks = new Map();
raw.records.filter(r => !r.consolidated).forEach(r => {
  const k = `${r.file}|${r.sheet}|${r.blockCol}`;
  if (!blocks.has(k)) blocks.set(k, { file: r.file, sheet: r.sheet, blockCol: r.blockCol, date: r.date, periodStart: r.periodStart, line: r.line, rows: [] });
  blocks.get(k).rows.push(r);
});

const signature = (b) => b.rows.map(r => `${key(r.product)}:${r.grams}`).sort().join('|');
const rowSet = (b) => new Set(b.rows.map(r => `${key(r.product)}:${r.grams}`));
// Fracción de filas de `b` que aparecen idénticas (producto+gramos) en `other`
const overlap = (b, other) => {
  const o = rowSet(other);
  const mine = b.rows.map(r => `${key(r.product)}:${r.grams}`);
  return mine.length ? mine.filter(x => o.has(x)).length / mine.length : 0;
};
const OVERLAP_THRESHOLD = 0.8;

const report = { corrected: [], droppedDuplicate: [], droppedEmpty: [], inferredLine: [], rangeBlocks: [], consolidatedIgnored: [...new Set(raw.records.filter(r => r.consolidated).map(r => r.file))] };

const orderedBlocks = [...blocks.values()].sort((a, b) => a.file.localeCompare(b.file) || a.sheet.localeCompare(b.sheet) || a.blockCol - b.blockCol);
const filePosition = new Map();
const finalBlocks = [];

for (const b of orderedBlocks) {
  const pos = filePosition.get(b.file) || 0;
  filePosition.set(b.file, pos + 1);

  if (b.periodStart) { report.rangeBlocks.push({ file: b.file, from: b.periodStart, to: b.date, rows: b.rows.length }); finalBlocks.push({ ...b, dateFinal: b.date }); continue; }

  const exp = expectedDays(b.file);
  let dateFinal = b.date;
  if (exp && !exp.includes(b.date)) {
    // ¿copia exacta de otro archivo?
    const twins = [...blocks.values()].filter(o => o !== b && o.file !== b.file && (expectedDays(o.file) || []).includes(o.date) && overlap(b, o) >= OVERLAP_THRESHOLD);
    if (twins.length > 0) {
      report.droppedDuplicate.push({ file: b.file, blockDate: b.date, expected: exp, sameContentAs: twins.map(t => `${t.file} (${t.date})`), rows: b.rows.length });
      continue;
    }
    const target = exp[Math.min(pos, exp.length - 1)];
    report.corrected.push({ file: b.file, blockCol: b.blockCol, blockDate: b.date, correctedTo: target, rows: b.rows.length });
    dateFinal = target;
  }
  finalBlocks.push({ ...b, dateFinal });
}

// ── Duplicados exactos restantes entre bloques de distinto archivo (misma fecha final y mismo contenido) ──
const seenSig = new Map();
const uniqueBlocks = [];
for (const b of finalBlocks) {
  const sk = `${b.dateFinal}|${signature(b)}`;
  if (seenSig.has(sk)) {
    report.droppedDuplicate.push({ file: b.file, blockDate: b.date, expected: [b.dateFinal], sameContentAs: [seenSig.get(sk)], rows: b.rows.length });
    continue;
  }
  seenSig.set(sk, `${b.file} (${b.dateFinal})`);
  uniqueBlocks.push(b);
}

// ── Línea del bloque (PIGMENTO/REACTIVO), con inferencia si falta ──
function inferBlockLine(b) {
  let react = 0, pig = 0;
  b.rows.forEach(r => {
    const inv = findInv(r.product);
    if (!inv) return;
    if (inv.type === 'colorante_reactivo') react++;
    else if (inv.type === 'pigmento') pig++;
  });
  return react >= pig ? 'REACTIVO' : 'PIGMENTO';
}

const out = [];
let idx = 0;
uniqueBlocks
  .sort((a, b) => a.dateFinal.localeCompare(b.dateFinal) || a.file.localeCompare(b.file))
  .forEach(b => {
    let line = b.line;
    if (!line) { line = inferBlockLine(b); report.inferredLine.push({ file: b.file, date: b.dateFinal, line }); }
    // Un mismo producto repetido dentro de un bloque se suma
    const merged = new Map();
    b.rows.forEach(r => {
      const mk = key(r.product);
      if (merged.has(mk)) merged.get(mk).grams += r.grams; else merged.set(mk, { ...r });
    });
    merged.forEach(r => {
      if (!(r.grams > 0)) return;
      const inv = findInv(r.product);
      const display = inv ? inv.name.replace(/\s+/g, ' ').trim() : r.product;
      idx++;
      out.push({
        id: `salida-${idx}`,
        date: b.dateFinal,
        ...(b.periodStart ? { periodStart: b.periodStart } : {}),
        product: display,
        code: r.product,
        grams: Math.round(r.grams * 100) / 100,
        line: line.toLowerCase(),
        hex: inv?.hexColor || getHexColor(display),
        source: b.file,
      });
    });
  });

const unmatched = [...new Set(out.filter(o => !findInv(o.code)).map(o => o.code))];
const totalGrams = out.reduce((a, o) => a + o.grams, 0);
const perMonth = {};
out.forEach(o => { perMonth[o.date.slice(0, 7)] = (perMonth[o.date.slice(0, 7)] || 0) + o.grams; });

fs.writeFileSync(path.join(__dirname, 'consumo_insumos_report.json'), JSON.stringify({ ...report, unmatched, perMonthKg: Object.fromEntries(Object.entries(perMonth).map(([k, v]) => [k, Math.round(v) / 1000])) }, null, 2), 'utf8');

console.log(`Bloques: ${blocks.size} -> usados ${uniqueBlocks.length}`);
console.log(`Registros finales: ${out.length} | total ${(totalGrams / 1000).toFixed(1)} kg | fechas ${new Set(out.map(o => o.date)).size}`);
console.log(`Fechas corregidas: ${report.corrected.length} | bloques duplicados descartados: ${report.droppedDuplicate.length} | línea inferida: ${report.inferredLine.length}`);
console.log('Sin match en inventario:', unmatched);
console.log('Kg por mes:', Object.fromEntries(Object.entries(perMonth).map(([k, v]) => [k, Math.round(v) / 1000])));

if (REPORT_ONLY) { console.log('(--report: no se escribió el .ts)'); process.exit(0); }

const ts = `// ARCHIVO GENERADO por scripts/build_consumo_data.cjs a partir de documentos/SALIDA INSUMOS/**/*.xlsx
// No editar a mano: volver a ejecutar los scripts extract_consumo_insumos.cjs y build_consumo_data.cjs.
import { SalidaInsumoRecord } from '../types';

export const SALIDA_INSUMOS_RECORDS: SalidaInsumoRecord[] = ${JSON.stringify(out, null, 2)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'salidaInsumosData.ts'), ts, 'utf8');
console.log('Escrito src/lib/salidaInsumosData.ts');
