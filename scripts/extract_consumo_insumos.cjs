/**
 * Extrae el consumo de insumos (tintas, aditivos) desde los formularios
 * "REQUISICIÓN DE INSUMOS" ubicados en documentos/SALIDA INSUMOS/<MES>/*.xlsx
 * y genera scripts/consumo_insumos_raw.json
 *
 * Cada archivo contiene uno o dos bloques (izquierda/derecha), cada uno con su
 * propia fecha, un encabezado PIGMENTO | REACTIVO y una tabla
 * CÓDIGO | PRODUCTO | CANTIDAD GRAMOS | SALDO ACTUAL | FECHA DE USO | SECCIÓN DE USO.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'documentos', 'SALIDA INSUMOS');
const OUT = path.join(__dirname, 'consumo_insumos_raw.json');

const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const up = (v) => norm(v).toUpperCase();

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.xlsx?$/i.test(e.name) && !e.name.startsWith('~$')) out.push(p);
  }
  return out;
}

function toISO(v) {
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const n = Number(v);
  if (v !== '' && !isNaN(n) && n > 30000 && n < 60000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = norm(v);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  return null;
}

// Fechas tipo rango escritas como texto, ej: "3 AL 15 /02/2026" -> { start, end }
function parseRange(v) {
  const s = norm(v).toUpperCase();
  const m = s.match(/^(\d{1,2})\s*(?:AL|A|-)\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/);
  if (!m) return null;
  const y = m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4]);
  const mm = String(m[3]).padStart(2, '0');
  return {
    start: `${y}-${mm}-${String(m[1]).padStart(2, '0')}`,
    end: `${y}-${mm}-${String(m[2]).padStart(2, '0')}`,
  };
}

const records = [];
const warnings = [];
const fileSummary = [];

for (const file of listFiles(ROOT)) {
  const rel = path.relative(ROOT, file);
  let wb;
  try {
    wb = XLSX.readFile(file, { cellDates: true });
  } catch (e) {
    warnings.push(`${rel}: no se pudo leer (${e.message})`);
    continue;
  }

  let blocksFound = 0;
  let rowsFound = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    // Localizar bloques por la celda "FECHA DE SOLICITUD"
    const starts = [];
    rows.forEach((r, ri) => r.forEach((c, ci) => {
      if (up(c) === 'FECHA DE SOLICITUD') starts.push({ ri, ci });
    }));
    if (starts.length === 0) continue;

    for (const st of starts) {
      // fecha: primera celda interpretable como fecha a la derecha
      let date = null;
      let periodStart = null;
      for (let c = st.ci + 1; c < st.ci + 6 && date === null; c++) {
        const cell = rows[st.ri][c];
        const range = parseRange(cell);
        if (range) { date = range.end; periodStart = range.start; break; }
        date = toISO(cell);
      }
      if (!date) {
        // Plantillas vacías (Hoja1) no deben generar ruido: solo avisar si el bloque trae datos
        const hasData = rows.slice(st.ri + 7, st.ri + 17).some(r => r && norm(r[st.ci + 1]) !== '' && !up(r[st.ci + 1]).includes('PRODUCTO'));
        if (hasData) warnings.push(`${rel} [${sheetName}] bloque col ${st.ci}: sin fecha`);
        continue;
      }

      // línea (PIGMENTO/REACTIVO): buscar en las filas siguientes en la columna del bloque
      let line = null;
      for (let r = st.ri; r < st.ri + 6 && !line; r++) {
        const t = up(rows[r] && rows[r][st.ci]);
        if (t === 'PIGMENTO' || t === 'REACTIVO') line = t;
      }

      // fila de encabezado de la tabla: CÓDIGO en la columna del bloque
      let headRow = -1;
      for (let r = st.ri; r < st.ri + 12; r++) {
        if (rows[r] && up(rows[r][st.ci]).startsWith('C') && up(rows[r][st.ci]).includes('DIGO')) { headRow = r; break; }
      }
      if (headRow < 0) { warnings.push(`${rel} [${sheetName}] ${date}: sin encabezado CÓDIGO`); continue; }

      // columnas dentro del bloque (hasta el siguiente bloque)
      const nextStart = starts.filter(s => s.ri === st.ri && s.ci > st.ci).map(s => s.ci).sort((a, b) => a - b)[0] ?? 999;
      let colProd = -1, colQty = -1, colUse = -1, colSection = -1;
      for (let c = st.ci; c < nextStart && c < rows[headRow].length; c++) {
        const h = up(rows[headRow][c]);
        if (h === 'PRODUCTO' && colProd < 0) colProd = c;
        if (h.startsWith('CANTIDAD') && colQty < 0) colQty = c;
        if (h.startsWith('FECHA DE USO')) colUse = c;
        if (h.startsWith('SECCI')) colSection = c;
      }
      if (colProd < 0 || colQty < 0) { warnings.push(`${rel} [${sheetName}] ${date}: columnas no detectadas`); continue; }

      blocksFound++;
      for (let r = headRow + 1; r < rows.length; r++) {
        const first = up(rows[r][st.ci]);
        if (first.startsWith('SOLICITADO') || first.startsWith('RECIBIDO')) break;
        const rowAll = rows[r].slice(st.ci, nextStart).map(up).join(' ');
        if (rowAll.includes('SOLICITADO') || rowAll.includes('RECIBIDO POR')) break;

        const product = norm(rows[r][colProd]);
        const qtyRaw = rows[r][colQty];
        if (!product && (qtyRaw === '' || qtyRaw == null)) continue;
        if (!product) { warnings.push(`${rel} [${sheetName}] ${date} fila ${r + 1}: cantidad ${qtyRaw} sin producto`); continue; }

        let qty = typeof qtyRaw === 'number' ? qtyRaw : Number(String(qtyRaw).replace(',', '.').replace(/[^\d.\-]/g, ''));
        if (qtyRaw === '' || qtyRaw == null) { warnings.push(`${rel} [${sheetName}] ${date} fila ${r + 1}: ${product} sin cantidad`); continue; }
        if (isNaN(qty)) { warnings.push(`${rel} [${sheetName}] ${date} fila ${r + 1}: cantidad inválida "${qtyRaw}" (${product})`); continue; }

        const useDate = colUse >= 0 ? toISO(rows[r][colUse]) : null;
        records.push({
          date,
          sheet: sheetName,
          blockCol: st.ci,
          periodStart,
          consolidated: /TODA[S]? LA[S]? SALIDAS/i.test(file),
          line: line || null,
          code: norm(rows[r][st.ci]) || null,
          product,
          grams: qty,
          useDate,
          section: colSection >= 0 ? norm(rows[r][colSection]) || null : null,
          file: rel.replace(/\\/g, '/'),
        });
        rowsFound++;
      }
    }
  }
  fileSummary.push({ file: rel, blocks: blocksFound, rows: rowsFound });
  if (blocksFound === 0) warnings.push(`${rel}: ningún bloque detectado`);
}

fs.writeFileSync(OUT, JSON.stringify({ records, warnings, fileSummary }, null, 2), 'utf8');
console.log(`Archivos: ${fileSummary.length} | Registros: ${records.length} | Advertencias: ${warnings.length}`);
console.log('Guardado en', OUT);
