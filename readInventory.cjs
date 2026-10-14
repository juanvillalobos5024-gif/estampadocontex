const xlsx = require('xlsx');
const wb = xlsx.readFile('c:\\Users\\jcami\\estampadocontex\\documentos\\INVENTARIO 2026 NUEVO 27 07 2026.xls');
console.log('Sheets:', wb.SheetNames);
for (const sheet of wb.SheetNames) {
  console.log('--- Sheet:', sheet, '---');
  console.log(xlsx.utils.sheet_to_json(wb.Sheets[sheet]).slice(0, 10));
}
