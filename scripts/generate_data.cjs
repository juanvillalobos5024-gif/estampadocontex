const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const wb = xlsx.readFile(path.join(__dirname, '..', 'documentos', '5REPORTE MENSUAL  2026.xlsx'));

const ignoredDesigns = [
  'DAÑO MAQUINA', 'DAÑO DE MAQUINA', 'DESCANSO', 'MANTENIMIENTO', 
  'FESTIVO', 'DOMINGO', 'TOTAL', 'TOTALES', 'VACACIONES', 'PARADA'
];

// 1. EXTRACT ALL UNIQUE DESIGNS
const designsMap = {};

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
    
    let name = raw.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!name || ignoredDesigns.some(ig => name.includes(ig)) || name.startsWith('=')) continue;
    
    let m1 = parseFloat(String(row[colMed1] || '').replace(',', '.'));
    let m2 = parseFloat(String(row[colMed2] || '').replace(',', '.'));
    let gr = parseFloat(String(row[colGr] || '').replace(',', '.'));
    let procRaw = String(row[colProc] || '').toUpperCase();
    let area = parseFloat(String(row[colArea] || '').replace(',', '.'));
    let peso = parseFloat(String(row[colPeso] || '').replace(',', '.'));
    
    if (!designsMap[name]) {
      designsMap[name] = {
        name,
        m1: m1 || null,
        m2: m2 || null,
        gr: gr || null,
        proc: procRaw.includes('REACTIV') ? 'reactivo' : procRaw.includes('PIGMENT') ? 'pigmento' : null,
        area: area || null,
        peso: peso || null,
        count: 1
      };
    } else {
      designsMap[name].count++;
      if (!designsMap[name].m1 && m1) designsMap[name].m1 = m1;
      if (!designsMap[name].m2 && m2) designsMap[name].m2 = m2;
      if (!designsMap[name].gr && gr) designsMap[name].gr = gr;
      if (!designsMap[name].proc && procRaw) {
        designsMap[name].proc = procRaw.includes('REACTIV') ? 'reactivo' : procRaw.includes('PIGMENT') ? 'pigmento' : null;
      }
      if (!designsMap[name].area && area) designsMap[name].area = area;
      if (!designsMap[name].peso && peso) designsMap[name].peso = peso;
    }
  }
});

const designsList = Object.values(designsMap).sort((a,b) => a.name.localeCompare(b.name));

console.log('Unique designs extracted:', designsList.length);

// 2. EXTRACT ALL PRODUCTION ROWS
const allProductionRecords = [];
let recordCounter = 1;

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
  const colFecha = headers.findIndex(h => h.includes('FECHA'));
  const colDiseno = headers.findIndex(h => h.includes('DISE') || h.includes('REF'));
  const colTurno = headers.findIndex(h => h.includes('TURNO'));
  const colMed1 = headers.findIndex(h => h === 'MEDIDA' || h.includes('ANCHO'));
  const colMed2 = headers.findLastIndex(h => h === 'MEDIDA' || h.includes('LARGO') || h.includes('ALTO'));
  const colGr = headers.findIndex(h => h.includes('GR/') || h.includes('GRAM'));
  const colProc = headers.findIndex(h => h.includes('PROC'));
  const colArea = headers.findIndex(h => h.includes('AREA') || h.includes('ÁREA'));
  const colPeso = headers.findIndex(h => h.includes('PESO'));
  const colUnid = headers.findIndex(h => (h === 'UNIDADES' || h.startsWith('UNIDAD')) && !h.includes('PESO'));
  const colKls = headers.findIndex(h => h.includes('KLS') || h.includes('KILO'));

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    let rawDiseno = row[colDiseno];
    if (!rawDiseno || typeof rawDiseno !== 'string') continue;
    let designName = rawDiseno.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!designName || ignoredDesigns.some(ig => designName.includes(ig)) || designName.startsWith('=')) continue;
    
    // Parse date
    let rawDate = row[colFecha];
    let dateStr = '';
    if (typeof rawDate === 'number') {
      const parsed = xlsx.SSF.parse_date_code(rawDate);
      if (parsed) {
        const y = parsed.y || 2026;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      }
    } else if (typeof rawDate === 'string') {
      dateStr = rawDate.trim();
    }
    
    if (!dateStr) {
      // Approximate date from sheetName if not present
      const monthMap = {
        'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
        'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08', 'SEPTIEMBRE': '09'
      };
      const mm = monthMap[sheetName] || '01';
      dateStr = `2026-${mm}-01`;
    }

    let shift = parseInt(row[colTurno], 10) || 1;
    let widthM = parseFloat(String(row[colMed1] || '').replace(',', '.')) || (designsMap[designName]?.m1) || 0.60;
    let heightM = parseFloat(String(row[colMed2] || '').replace(',', '.')) || (designsMap[designName]?.m2) || 1.20;
    let gramaje = parseInt(row[colGr], 10) || (designsMap[designName]?.gr) || 280;
    let procRaw = String(row[colProc] || '').toUpperCase();
    let process = procRaw.includes('PIGMENT') ? 'PIGMENTO' : 'REACTIVO';
    let areaM2 = parseFloat(String(row[colArea] || '').replace(',', '.')) || Number((widthM * heightM).toFixed(2));
    let unitWeightG = parseFloat(String(row[colPeso] || '').replace(',', '.')) || Number((areaM2 * gramaje).toFixed(1));
    let units = parseInt(String(row[colUnid] || '').replace(/\./g, '').replace(',', '.'), 10) || 0;
    let kgDay = parseFloat(String(row[colKls] || '').replace(',', '.')) || Number(((units * unitWeightG) / 1000).toFixed(2));

    allProductionRecords.push({
      id: `prod-${recordCounter++}`,
      date: dateStr,
      designName,
      shift,
      widthM: Number(widthM.toFixed(2)),
      heightM: Number(heightM.toFixed(2)),
      gramaje,
      process,
      areaM2: Number(areaM2.toFixed(3)),
      unitWeightG: Number(unitWeightG.toFixed(1)),
      units,
      kgDay: Number(kgDay.toFixed(2))
    });
  }
});

console.log('Total production records extracted:', allProductionRecords.length);
fs.writeFileSync(path.join(__dirname, 'full_production_records.json'), JSON.stringify(allProductionRecords, null, 2), 'utf-8');
