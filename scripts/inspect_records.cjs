const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/initialProductionData.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Find FULL_YEAR_PRODUCTION_RECORDS JSON part
const match = content.match(/export const FULL_YEAR_PRODUCTION_RECORDS: DailyProductionRecord\[\] = (\[[\s\S]*?\]);/);
if (!match) {
  console.log("Could not find FULL_YEAR_PRODUCTION_RECORDS");
  process.exit(1);
}

const records = JSON.parse(match[1]);
console.log("Total records:", records.length);

const toallaNames = [
  'FRUTAS ANDU',
  'FRUTAS ANDU VIEJAS',
  'GRANJA ANDU',
  'GRANJAS ANDU',
  'NAVIDAD ANDU',
  'NAVIDAD LINEA',
  'QE FRUTAS',
  'QE UTENCILIOS',
  'QE UTENSILIO',
  'QEFRUTAS',
  'VACAS ANDU'
];

const toallas = records.filter(r => toallaNames.includes(r.designName));
console.log("Toalla records count:", toallas.length);
toallas.slice(0, 5).forEach(r => {
  console.log(r.date, r.designName, "units:", r.units, "golpes:", r.golpes, "unitWeightG:", r.unitWeightG, "kgDay:", r.kgDay, "calcKg:", (r.units * r.unitWeightG) / 1000);
});
