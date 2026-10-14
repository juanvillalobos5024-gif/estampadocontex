const fs = require('fs');
const path = require('path');

const TOALLA_DESIGN_NAMES = [
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

const filePath = path.join(__dirname, '../src/lib/initialProductionData.ts');
let fileContent = fs.readFileSync(filePath, 'utf8');

const regex = /export const FULL_YEAR_PRODUCTION_RECORDS: DailyProductionRecord\[\] = (\[[\s\S]*?\]);\s*$/;
const match = fileContent.match(regex);
if (!match) {
  console.error("Could not find FULL_YEAR_PRODUCTION_RECORDS");
  process.exit(1);
}

const records = JSON.parse(match[1]);
console.log("Processing", records.length, "records...");

let updatedToallas = 0;
let updatedKg = 0;

const updatedRecords = records.map(r => {
  const normName = (r.designName || '').toUpperCase().trim();
  const isToalla = TOALLA_DESIGN_NAMES.includes(normName) || (r.widthM <= 0.40 && (r.process === 'PIGMENTO' || normName.includes('ANDU')));

  if (isToalla) {
    updatedToallas++;
    const widthM = 0.35;
    const heightM = 0.60;
    const gramaje = 310;
    const areaM2 = 0.21;
    const unitWeightG = 63;
    const process = 'PIGMENTO';
    const golpes = Math.round(r.units / 5);
    const kgDay = Number(((r.units * unitWeightG) / 1000).toFixed(2));

    return {
      ...r,
      widthM,
      heightM,
      gramaje,
      areaM2,
      unitWeightG,
      process,
      golpes,
      kgDay
    };
  } else {
    // Other records
    const widthM = r.widthM || 0.60;
    const heightM = r.heightM || 1.20;
    const gramaje = r.gramaje || 280;
    const areaM2 = Number((widthM * heightM).toFixed(2));
    const unitWeightG = r.unitWeightG || Number((areaM2 * gramaje).toFixed(1));
    const process = r.process || 'REACTIVO';
    const golpes = r.golpes || (widthM <= 0.40 ? Math.round(r.units / 5) : Math.round(r.units / 3));
    const kgDay = Number(((r.units * unitWeightG) / 1000).toFixed(2));

    if (Math.abs(r.kgDay - kgDay) > 0.01) updatedKg++;

    return {
      ...r,
      widthM,
      heightM,
      gramaje,
      areaM2,
      unitWeightG,
      process,
      golpes,
      kgDay
    };
  }
});

const newJsonStr = JSON.stringify(updatedRecords, null, 2);
const newFileContent = fileContent.replace(regex, `export const FULL_YEAR_PRODUCTION_RECORDS: DailyProductionRecord[] = ${newJsonStr};\n`);
fs.writeFileSync(filePath, newFileContent, 'utf8');

console.log("Successfully updated initialProductionData.ts! Toallas updated:", updatedToallas, "Kg adjustments in others:", updatedKg);

// Also update full_production_records.json
const fullJsonPath = path.join(__dirname, 'full_production_records.json');
if (fs.existsSync(fullJsonPath)) {
  fs.writeFileSync(fullJsonPath, newJsonStr, 'utf8');
  console.log("Updated full_production_records.json");
}
