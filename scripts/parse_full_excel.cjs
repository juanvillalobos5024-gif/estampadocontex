const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.readFile(path.join(__dirname, '..', 'documentos', '5REPORTE MENSUAL  2026.xlsx'));

const monthIndexMap = {
  'ENERO': '01',
  'FEBRERO': '02',
  'MARZO': '03',
  'ABRIL': '04',
  'MAYO': '05',
  'JUNIO': '06',
  'JULIO': '07',
  'AGOSTO': '08',
  'SEPTIEMBRE': '09'
};

wb.SheetNames.forEach(sheetName => {
  const sheet = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`=== SHEET: ${sheetName} ===`);
  for (let i = 0; i < Math.min(6, data.length); i++) {
    console.log(`Row ${i}:`, data[i]);
  }
});
