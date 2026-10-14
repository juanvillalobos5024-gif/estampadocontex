const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'c:\\Users\\jcami\\estampadocontex\\documentos\\INVENTARIO 2026 NUEVO 7 10 2026.xls';
const wb = xlsx.readFile(excelPath);
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

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

function getTypeAndCategory(name, ref) {
  const n = (name + ' ' + ref).toLowerCase();

  if (n.includes('urea')) return { type: 'urea', category: 'reactivo' };
  if (n.includes('asutol')) return { type: 'asutol', category: 'reactivo' };
  if (n.includes('bicarbonato')) return { type: 'bicarbonato', category: 'reactivo' };
  if (n.includes('carbonato')) return { type: 'aditivo', category: 'reactivo' };
  if (n.includes('alginato') || n.includes('pasta espesante')) return { type: 'pasta', category: 'reactivo' };

  if (
    n.includes('novacron') || 
    n.includes('reactiv') || 
    n.includes('oriomcrom') || 
    n.includes('oriom') || 
    n.includes('jakofix') || 
    n.includes('super black')
  ) {
    return { type: 'colorante_reactivo', category: 'reactivo' };
  }

  if (
    n.includes('tintuprint') || 
    n.includes('novaprint') || 
    n.includes('octamine') || 
    n.includes('cecoprint') || 
    n.includes('lumiprint') || 
    n.includes('pigment')
  ) {
    // If it's espesante or base novaprint
    if (n.includes('espesante')) return { type: 'pasta', category: 'pigmento' };
    if (n.includes('rfs')) return { type: 'base', category: 'pigmento' };
    return { type: 'pigmento', category: 'pigmento' };
  }

  if (n.includes('prestovil') || n.includes('concentrate') || n.includes('base') || n.includes('clear')) {
    return { type: 'base', category: 'pigmento' };
  }

  return { type: 'aditivo', category: 'pigmento' };
}

const items = [];

data.forEach((row, idx) => {
  const ref = (row.Referencia || '').toString().trim();
  if (!ref || ref === 'Gran total') return;

  const desc = (row['Desc. item'] || '').toString().trim();
  const name = desc || ref;
  const rawFisico = row['FISICO '];
  const fisicoKg = (rawFisico !== undefined && rawFisico !== null && !isNaN(Number(rawFisico))) ? Number(rawFisico) : 0;
  
  // Convert kg to grams (rounded to whole grams or 1 decimal)
  const quantity = Math.round(fisicoKg * 1000);
  const { type, category } = getTypeAndCategory(name, ref);
  const hexColor = getHexColor(name);

  // Suggested min required based on volume
  let minRequired = 5000;
  if (quantity > 100000) minRequired = 25000;
  else if (quantity > 30000) minRequired = 10000;
  else if (quantity < 5000) minRequired = 1000;

  items.push({
    name,
    ref,
    type,
    category,
    quantity,
    minRequired,
    hexColor
  });
});

console.log(`Parsed ${items.length} items from Excel.`);

// Save to src/inventory_data.json and root inventory_data.json
const jsonContent = JSON.stringify(items, null, 2);
fs.writeFileSync('c:\\Users\\jcami\\estampadocontex\\src\\inventory_data.json', jsonContent, 'utf8');
fs.writeFileSync('c:\\Users\\jcami\\estampadocontex\\inventory_data.json', jsonContent, 'utf8');
console.log('Saved to src/inventory_data.json and inventory_data.json successfully.');
