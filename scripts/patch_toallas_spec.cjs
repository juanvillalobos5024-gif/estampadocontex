const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/initialProductionData.ts');
let content = fs.readFileSync(filePath, 'utf8');

const names = [
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

let updatedCount = 0;

names.forEach(name => {
  // Encontrar el bloque del diseño
  const pattern = new RegExp('(\"name\":\\s*\"' + name + '\",[\\s\\S]*?\"colors\":)', 'g');
  content = content.replace(pattern, (match) => {
    updatedCount++;
    let block = match;
    block = block.replace(/\"widthCm\":\s*\d+/, '\"widthCm\": 35');
    block = block.replace(/\"heightCm\":\s*\d+/, '\"heightCm\": 60');
    block = block.replace(/\"gramaje\":\s*\d+/, '\"gramaje\": 310');
    block = block.replace(/\"unitWeight\":\s*[\d\.]+/, '\"unitWeight\": 63');
    block = block.replace(/\"areaPorToalla\":\s*[\d\.]+/, '\"areaPorToalla\": 0.21');
    block = block.replace(/\"areaTotal\":\s*[\d\.]+/, '\"areaTotal\": 1.05');
    block = block.replace(/\"piezasPorGolpe\":\s*\d+/, '\"piezasPorGolpe\": 5');
    block = block.replace(/\"lineType\":\s*\"[^\"]+\"/, '\"lineType\": \"pigmento\"');
    return block;
  });
});

// También actualizar los registros diarios de producción donde aparezcan estos nombres
let prodCount = 0;
names.forEach(name => {
  const prodPattern = new RegExp('(\"designName\":\\s*\"' + name + '\",[\\s\\S]*?\"units\":\\s*(\\d+),)', 'g');
  content = content.replace(prodPattern, (match, p1, unitsStr) => {
    prodCount++;
    let block = match;
    const units = parseInt(unitsStr, 10) || 0;
    const kg = Number(((units * 63) / 1000).toFixed(2));
    block = block.replace(/\"widthM\":\s*[\d\.]+/, '\"widthM\": 0.35');
    block = block.replace(/\"heightM\":\s*[\d\.]+/, '\"heightM\": 0.6');
    block = block.replace(/\"gramaje\":\s*\d+/, '\"gramaje\": 310');
    block = block.replace(/\"unitWeightG\":\s*[\d\.]+/, '\"unitWeightG\": 63');
    block = block.replace(/\"areaM2\":\s*[\d\.]+/, '\"areaM2\": 0.21');
    block = block.replace(/\"process\":\s*\"[^\"]+\"/, '\"process\": \"PIGMENTO\"');
    return block;
  });
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Updated ${updatedCount} design definitions and ${prodCount} production records in initialProductionData.ts`);
