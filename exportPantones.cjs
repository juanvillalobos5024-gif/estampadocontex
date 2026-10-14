const xlsx = require('xlsx');
const fs = require('fs');
const wb = xlsx.readFile('c:\\Users\\jcami\\estampadocontex\\documentos\\BUSCADOR DE PANTONE.xlsx');

const pantones = [];

function parseFormulaString(formulaStr) {
  if (!formulaStr || typeof formulaStr !== 'string') return [];
  // Example: "1,5 YELLOW HE4R-0,8 AZUL P3R- 1 YELLOW HE6G"
  // Split by "-"
  const parts = formulaStr.split('-');
  const formulas = [];
  parts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    
    // Replace comma with dot for floats
    const cleanStr = trimmed.replace(',', '.');
    
    // Find the first match of a number at the beginning
    const match = cleanStr.match(/^([\d.]+)\s+(.*)$/);
    if (match) {
      const percentage = parseFloat(match[1]);
      const component = match[2].trim();
      formulas.push({
        component,
        percentage,
        description: component
      });
    } else {
      // If we can't parse it well, maybe it's just a component
      formulas.push({
        component: trimmed,
        percentage: 0,
        description: trimmed
      });
    }
  });
  
  // Normalize percentages so they sum to 100 or keep them as parts?
  // In the application, the UI accepts them as parts and calculates totals, or maybe percentages.
  // We'll just pass the parsed raw value into percentage. Wait, if it's parts, let's normalize to percentages?
  // The app type requires percentage. Wait, let's look at how the app handles them.
  return formulas;
}

// 1. Reactivos
const sheetReactivo = xlsx.utils.sheet_to_json(wb.Sheets['PANTONE REACTIVO']);
sheetReactivo.forEach(row => {
  let code = row['PANTONE'];
  let formulaStr = row['FORMULACION'];
  if (!code || !formulaStr) return;
  code = String(code).trim();
  formulaStr = String(formulaStr).trim();
  
  if (code && code.length > 0 && formulaStr) {
    pantones.push({
      code: code,
      name: 'Pantone ' + code,
      hex: '#999999', // We can't know the exact hex, default to grey
      formulas: parseFormulaString(formulaStr)
    });
  }
});

// 2. Pigmentos
const sheetPigmentos = xlsx.utils.sheet_to_json(wb.Sheets['PANTONE PIGMENTOS']);
sheetPigmentos.forEach(row => {
  let code = row['PANTONE C'];
  let formulaStr = row['FORMULACION '];
  if (!code || !formulaStr) return;
  code = String(code).trim();
  formulaStr = String(formulaStr).trim();
  
  if (code && code.length > 0 && formulaStr) {
    pantones.push({
      code: code,
      name: 'Pantone ' + code,
      hex: '#999999',
      formulas: parseFormulaString(formulaStr)
    });
  }
});

fs.writeFileSync('c:\\Users\\jcami\\estampadocontex\\src\\pantones_data.json', JSON.stringify(pantones, null, 2));
console.log(`Exported ${pantones.length} pantones to src/pantones_data.json`);
