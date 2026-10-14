const xlsx = require('xlsx');
const fs = require('fs');
const wb = xlsx.readFile('c:\\Users\\jcami\\estampadocontex\\documentos\\INVENTARIO 2026 NUEVO 27 07 2026.xls');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const items = [];
data.forEach(row => {
  if (row.Referencia === 'Gran total' || !row.Referencia) return;
  const name = row['Desc. item'] ? row['Desc. item'].trim() : row.Referencia.trim();
  const rawQty = row['FISICO '];
  if (rawQty === undefined) return;
  // Convert kg to grams
  const quantity = Math.round(Number(rawQty) * 1000);
  
  let type = 'aditivo';
  let category = 'serigrafia';
  
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('novacron') || nameLower.includes('reactiv') || nameLower.includes('urea') || nameLower.includes('asutol') || nameLower.includes('bicarbonato') || nameLower.includes('alginato')) {
    category = 'reactivo';
    if (nameLower.includes('novacron') || nameLower.includes('reactiv')) type = 'colorante_reactivo';
    else if (nameLower.includes('urea')) type = 'urea';
    else if (nameLower.includes('asutol')) type = 'asutol';
    else if (nameLower.includes('bicarbonato')) type = 'bicarbonato';
    else if (nameLower.includes('alginato')) type = 'sal_alginato';
  } else if (nameLower.includes('pigmento') || nameLower.includes('octamine') || nameLower.includes('novaprint') || nameLower.includes('octafine')) {
    category = 'serigrafia';
    type = 'pigmento';
  } else if (nameLower.includes('base') || nameLower.includes('clear') || nameLower.includes('prestovil')) {
    category = 'serigrafia';
    type = 'base';
  }

  items.push({
    name,
    type,
    category,
    quantity,
    minRequired: 5000, // default 5kg
    hexColor: '#cccccc'
  });
});

fs.writeFileSync('c:\\Users\\jcami\\estampadocontex\\inventory_data.json', JSON.stringify(items, null, 2));
console.log(`Exported ${items.length} items to inventory_data.json`);
