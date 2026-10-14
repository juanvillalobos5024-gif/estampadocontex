const fs = require('fs');
const path = require('path');

const rawDesigns = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_designs.json'), 'utf-8'));
const rawRecords = JSON.parse(fs.readFileSync(path.join(__dirname, 'full_production_records.json'), 'utf-8'));

// Format designs for Design[] interface
const initialDesigns = rawDesigns.map((d, idx) => {
  const m1 = d.m1 || 0.60;
  const m2 = d.m2 || 1.20;
  const gr = d.gr || 280;
  const widthCm = Math.round(m1 * 100);
  const heightCm = Math.round(m2 * 100);
  const areaPorToalla = Number((d.area || (m1 * m2)).toFixed(3));
  const unitWeight = Number((d.peso || (areaPorToalla * gr)).toFixed(1));
  const piezasPorGolpe = widthCm <= 35 ? 6 : 3;
  const areaTotal = Number((areaPorToalla * piezasPorGolpe).toFixed(3));
  const lineType = d.proc === 'pigmento' ? 'pigmento' : 'reactivo';

  // Specific or sensible pantone colors
  let colors = [];
  if (lineType === 'reactivo') {
    colors = [
      { pantoneCode: 'TURQUESA R', gramsPerPiece: 14 },
      { pantoneCode: '185 C', gramsPerPiece: 10 },
      { pantoneCode: '286 C', gramsPerPiece: 12 }
    ];
  } else {
    colors = [
      { pantoneCode: '021 C', gramsPerPiece: 8 },
      { pantoneCode: '360 C', gramsPerPiece: 7 },
      { pantoneCode: '185 C', gramsPerPiece: 6 }
    ];
  }

  return {
    id: `des-${idx + 1}`,
    name: d.name,
    productType: 'Toallas',
    lineType,
    widthCm,
    heightCm,
    gramaje: gr,
    unitWeight,
    areaPorToalla,
    areaTotal,
    piezasPorGolpe,
    frames: 3,
    colors
  };
});

// Format production records for DailyProductionRecord[] interface
const initialProductionRecords = rawRecords.map((r, idx) => ({
  id: `prod-${idx + 1}`,
  date: r.date,
  designName: r.designName,
  shift: r.shift || 1,
  widthM: r.widthM,
  heightM: r.heightM,
  gramaje: r.gramaje,
  process: r.process,
  areaM2: r.areaM2,
  unitWeightG: r.unitWeightG,
  units: r.units,
  kgDay: r.kgDay
}));

const tsContent = `import { Design, DailyProductionRecord } from '../types';

export const INITIAL_EXCEL_DESIGNS: Design[] = ${JSON.stringify(initialDesigns, null, 2)};

export const FULL_YEAR_PRODUCTION_RECORDS: DailyProductionRecord[] = ${JSON.stringify(initialProductionRecords, null, 2)};
`;

const targetFile = path.join(__dirname, '..', 'src', 'lib', 'initialProductionData.ts');
fs.writeFileSync(targetFile, tsContent, 'utf-8');

console.log('Successfully generated', targetFile);
console.log('Designs count:', initialDesigns.length);
console.log('Production records count:', initialProductionRecords.length);
