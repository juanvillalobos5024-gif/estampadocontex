const fs = require('fs');
const content = fs.readFileSync('src/lib/initialProductionData.ts', 'utf8');
const lines = content.split(/\r?\n/);
let jsonLines = [];
let capturing = false;
for (let line of lines) {
  if (line.includes('INITIAL_EXCEL_DESIGNS: Design[] = [')) {
    capturing = true;
    jsonLines.push('[');
    continue;
  }
  if (capturing) {
    if (line.includes('export const FULL_YEAR_PRODUCTION_RECORDS')) {
      break;
    }
    jsonLines.push(line);
  }
}
let str = jsonLines.join('\n').trim();
if (str.endsWith(';')) str = str.slice(0, -1).trim();
const designs = JSON.parse(str);
console.log('Total designs:', designs.length);
const pigmento = designs.filter(d => d.lineType === 'pigmento');
console.log('Pigmento count:', pigmento.length);
console.log('Pigmento sample:', JSON.stringify(pigmento[0], null, 2));

const reactivo = designs.filter(d => d.lineType === 'reactivo');
console.log('Reactivo count:', reactivo.length);
console.log('Reactivo sample:', JSON.stringify(reactivo[0], null, 2));

const toallas = designs.filter(d => d.productType === 'Toallas');
console.log('Toallas count:', toallas.length);
const toallaSizes = {};
toallas.forEach(t => {
  const k = `${t.lineType} | ${t.widthCm}x${t.heightCm} | gr:${t.gramaje} | golpes:${t.piezasPorGolpe} | unitWeight:${t.unitWeight}`;
  toallaSizes[k] = (toallaSizes[k] || 0) + 1;
});
console.log('Toalla categories:', toallaSizes);
