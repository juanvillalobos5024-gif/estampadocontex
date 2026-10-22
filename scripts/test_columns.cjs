const xlsx = require('xlsx');
const wb = xlsx.readFile('C:/Users/jcami/OneDrive/Documentos/telares/segundas septiembre.xlsx');
const s = wb.Sheets[wb.SheetNames[0]];
const raw = xlsx.utils.sheet_to_json(s, { header: 1 });
console.log('--- COLUMNS BREAKDOWN ---');
for (let c = 0; c < 46; c++) {
  const r0 = String(raw[0]?.[c] ?? '').trim();
  const r1 = String(raw[1]?.[c] ?? '').trim();
  const r2 = raw[2]?.[c];
  const r3 = raw[3]?.[c];
  console.log(`Col ${c}: [${r0}] / [${r1}] => ex1=${r2}, ex2=${r3}`);
}
