const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'documentos', '5REPORTE MENSUAL  2026.xlsx');
const wb = xlsx.readFile(filePath);

const ignored = [
  'DAÑO MAQUINA', 'DAÑO DE MAQUINA', 'DESCANSO', 'MANTENIMIENTO', 
  'FESTIVO', 'DOMINGO', 'TOTAL', 'TOTALES', 'VACACIONES', 'PARADA'
];

const designs = {};

wb.SheetNames.forEach(sheetName => {
  const sheet = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  if (!data || data.length < 2) return;
  
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r];
    if (row && row.some(cell => typeof cell === 'string' && (cell.toUpperCase().includes('DISE') || cell.toUpperCase().includes('REF')))) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx === -1) return;
  
  const headers = data[headerRowIdx].map(h => (h ? String(h).trim().toUpperCase() : ''));
  const colDiseno = headers.findIndex(h => h.includes('DISE') || h.includes('REF'));
  const colMed1 = headers.findIndex(h => h === 'MEDIDA' || h.includes('ANCHO'));
  const colMed2 = headers.findLastIndex(h => h === 'MEDIDA' || h.includes('LARGO') || h.includes('ALTO'));
  const colGr = headers.findIndex(h => h.includes('GR/') || h.includes('GRAM'));
  const colProc = headers.findIndex(h => h.includes('PROC'));
  const colArea = headers.findIndex(h => h.includes('AREA') || h.includes('ÁREA'));
  const colPeso = headers.findIndex(h => h.includes('PESO'));

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    let raw = row[colDiseno];
    if (!raw || typeof raw !== 'string') continue;
    
    // Normalize spaces
    let name = raw.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!name || ignored.some(ig => name.includes(ig)) || name.startsWith('=')) continue;
    
    // Parse measures and numbers
    let m1 = parseFloat(String(row[colMed1] || '').replace(',', '.'));
    let m2 = parseFloat(String(row[colMed2] || '').replace(',', '.'));
    let gr = parseFloat(String(row[colGr] || '').replace(',', '.'));
    let procRaw = String(row[colProc] || '').toUpperCase();
    let area = parseFloat(String(row[colArea] || '').replace(',', '.'));
    let peso = parseFloat(String(row[colPeso] || '').replace(',', '.'));
    
    if (!designs[name]) {
      designs[name] = {
        name,
        m1: m1 || null,
        m2: m2 || null,
        gr: gr || null,
        proc: procRaw.includes('REACTIV') ? 'reactivo' : procRaw.includes('PIGMENT') ? 'pigmento' : null,
        area: area || null,
        peso: peso || null,
        occurrences: 1,
        sheets: [sheetName]
      };
    } else {
      designs[name].occurrences++;
      if (!designs[name].sheets.includes(sheetName)) designs[name].sheets.push(sheetName);
      if (!designs[name].m1 && m1) designs[name].m1 = m1;
      if (!designs[name].m2 && m2) designs[name].m2 = m2;
      if (!designs[name].gr && gr) designs[name].gr = gr;
      if (!designs[name].proc && procRaw) {
        designs[name].proc = procRaw.includes('REACTIV') ? 'reactivo' : procRaw.includes('PIGMENT') ? 'pigmento' : null;
      }
      if (!designs[name].area && area) designs[name].area = area;
      if (!designs[name].peso && peso) designs[name].peso = peso;
    }
  }
});

const list = Object.values(designs);
list.sort((a,b) => a.name.localeCompare(b.name));

const outPath = path.join(__dirname, 'all_designs.json');
fs.writeFileSync(outPath, JSON.stringify(list, null, 2), 'utf-8');

console.log('Successfully wrote', list.length, 'designs to', outPath);
list.forEach((d, i) => {
  console.log(`${i+1}. ${d.name} (${d.m1}x${d.m2}m, ${d.gr}g/m2, ${d.proc}, ${d.area}m2, ${d.peso}g)`);
});
