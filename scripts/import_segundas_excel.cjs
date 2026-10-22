const fs = require('fs');
const xlsx = require('xlsx');

const excelPath = 'C:/Users/jcami/OneDrive/Documentos/telares/REPORTE DE SEGUNDAS DIARIO ACABADO TOALLA AGOSTO.xlsx';
const wb = xlsx.readFile(excelPath);

const allRecords = [];

['JULIO', 'AGOSTO'].forEach(sheetName => {
  const s = wb.Sheets[sheetName];
  if (!s) return;
  const rows = xlsx.utils.sheet_to_json(s, { header: 1 }).slice(2).filter(r => {
    if (!r || !r[0]) return false;
    const isTotal = r.slice(0, 8).some(cell => String(cell || '').trim().toUpperCase().includes('TOTAL'));
    return !isTotal;
  });

  rows.forEach((r, idx) => {
    let fecha = '';
    if (typeof r[0] === 'number') {
      const d = new Date(Math.round(r[0] - 25569) * 86400 * 1000);
      fecha = d.toISOString().split('T')[0];
    } else {
      fecha = String(r[0]);
    }

    const estManchas = Number(r[16] || 0);
    const estRepise = Number(r[17] || 0);
    const estFalta = Number(r[18] || 0);
    const estLogos = Number(r[19] || 0);
    const estPen = Number(r[20] || 0);
    const estGrasa = Number(r[21] || 0);
    const estDesc = Number(r[22] || 0);
    const estQuem = Number(r[23] || 0);
    const totEst = estManchas + estRepise + estFalta + estLogos + estPen + estGrasa + estDesc + estQuem;

    const tintMancha = Number(r[24] || 0);
    const tintOxido = Number(r[25] || 0);
    const tintArr = Number(r[26] || 0);
    const tintSucias = Number(r[27] || 0);
    const tintVetas = Number(r[28] || 0);
    const tintMedida = Number(r[29] || 0);
    const tintRama = Number(r[30] || 0);
    const tintGrasa = Number(r[31] || 0);
    const totTint = tintMancha + tintOxido + tintArr + tintSucias + tintVetas + tintMedida + tintRama + tintGrasa;

    const tejUrdimbre = Number(r[32] || 0);
    const tejTrama = Number(r[33] || 0);
    const tejMarra = Number(r[34] || 0);
    const tejRayas = Number(r[35] || 0);
    const tejRizo = Number(r[36] || 0);
    const tejHilo = Number(r[37] || 0);
    const tejOrillos = Number(r[38] || 0);
    const totTej = tejUrdimbre + tejTrama + tejMarra + tejRayas + tejRizo + tejHilo + tejOrillos;

    const costEnganches = Number(r[39] || 0);
    const costManchas = Number(r[40] || 0);
    const costTundido = Number(r[41] || 0);
    const costMontadas = Number(r[42] || 0);
    const totCost = costEnganches + costManchas + costTundido + costMontadas;

    const rotas = Number(r[43] || 0);

    const rev = Number(r[8] || 0);
    const buena = Number(r[9] || 0);
    const pegas = Number(r[10] || 0);
    const arreLat = Number(r[11] || 0);
    const arreCab = Number(r[13] || 0);

    const totSeg = Number(r[44] || 0) || (totEst + totTint + totTej + totCost + rotas);

    const diseno = String(r[6] || '').trim();
    const referencia = String(r[4] || '').trim();

    let tecnica = 'REACTIVO';
    const dUpper = diseno.toUpperCase();
    const rUpper = referencia.toUpperCase();
    if (dUpper.includes('QE ') || dUpper.includes('FRUTAS') || dUpper.includes('GRANJA') || rUpper.includes('ML1002')) {
      tecnica = 'PIGMENTO';
    }

    allRecords.push({
      id: 'seg-' + sheetName.toLowerCase() + '-' + (idx + 1),
      fecha,
      fechaSerial: typeof r[0] === 'number' ? r[0] : undefined,
      revisadoras: String(r[1] || '').trim(),
      cliente: String(r[2] || '').trim(),
      pedidoLinea: String(r[3] || '').trim(),
      referencia,
      dimensiones: String(r[5] || '').trim(),
      diseno,
      color: String(r[7] || '').trim(),
      tecnica,
      cantTotalRevisada: rev,
      cantBuena: buena,
      pegas,
      arreLaterales: arreLat,
      pctLaterales: Number(r[12] || 0),
      arreCabeceras: arreCab,
      pctCabeceras: Number(r[14] || 0),
      observaciones: String(r[15] || '').trim(),
      defectosEstampado: {
        manchas: estManchas,
        repise: estRepise,
        faltaPintura: estFalta,
        logosCorridos: estLogos,
        penetracion: estPen,
        grasa: estGrasa,
        descases: estDesc,
        quemadas: estQuem,
        totalEstampado: totEst
      },
      defectosTintoreria: {
        manchaTintoreria: tintMancha,
        manchaOxido: tintOxido,
        arrastreBarca: tintArr,
        sucias: tintSucias,
        vetas: tintVetas,
        medida: tintMedida,
        rama: tintRama,
        grasa: tintGrasa,
        totalTintoreria: totTint
      },
      defectosTejeduria: {
        revienteUrdimbre: tejUrdimbre,
        revienteTrama: tejTrama,
        marra: tejMarra,
        rayas: tejRayas,
        variacionesRizo: tejRizo,
        hiloContaminado: tejHilo,
        orillosLaterales: tejOrillos,
        totalTejeduria: totTej
      },
      defectosCostura: {
        enganches: costEnganches,
        manchasNegras: costManchas,
        tundidoCaido: costTundido,
        montadasCostura: costMontadas,
        totalCostura: totCost
      },
      rotas,
      totalTintoreria: totTint,
      totalTejeduria: totTej,
      totalCostura: totCost,
      totalSegundas: totSeg,
      pctTotalSegundas: rev > 0 ? totSeg / rev : 0,
      pctEstampado: rev > 0 ? totEst / rev : 0
    });
  });
});

const tsCode = `import { SegundasRecord } from '../types';

export function inferTecnica(diseno: string, referencia: string): 'REACTIVO' | 'PIGMENTO' {
  const d = (diseno || '').toUpperCase();
  const r = (referencia || '').toUpperCase();
  if (d.includes('QE ') || d.includes('FRUTAS') || d.includes('GRANJA') || r.includes('ML1002')) {
    return 'PIGMENTO';
  }
  return 'REACTIVO';
}

export const INITIAL_SEGUNDAS_RECORDS: SegundasRecord[] = ` + JSON.stringify(allRecords, null, 2) + `;

const LOCAL_STORAGE_KEY = 'contex_segundas_records_v4';

export function loadSegundasRecords(): SegundasRecord[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: any) => {
          const rev = Number(r.cantTotalRevisada) || 0;
          const totEst = Number(r.defectosEstampado?.totalEstampado) || 0;
          const totTint = Number(r.defectosTintoreria?.totalTintoreria) || Number(r.totalTintoreria) || 0;
          const totTej = Number(r.defectosTejeduria?.totalTejeduria) || Number(r.totalTejeduria) || 0;
          const totCost = Number(r.defectosCostura?.totalCostura) || Number(r.totalCostura) || 0;
          const rot = Number(r.rotas) || 0;
          const totalSeg = r.totalSegundas !== undefined ? Number(r.totalSegundas) : (totEst + totTint + totTej + totCost + rot);
          const pctSeg = rev > 0 ? Number((totalSeg / rev).toFixed(6)) : 0;
          return {
            ...r,
            totalTintoreria: totTint,
            totalTejeduria: totTej,
            totalCostura: totCost,
            rotas: rot,
            totalSegundas: totalSeg,
            pctTotalSegundas: pctSeg,
            tecnica: r.tecnica || inferTecnica(r.diseno, r.referencia)
          };
        });
      }
    }
  } catch (err) {
    console.error('Error loading segundas records from localStorage:', err);
  }
  return INITIAL_SEGUNDAS_RECORDS;
}

export function saveSegundasRecords(records: SegundasRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Error saving segundas records to localStorage:', err);
  }
}
`;

fs.writeFileSync('src/lib/segundasData.ts', tsCode, 'utf8');
console.log('src/lib/segundasData.ts written successfully with ' + allRecords.length + ' records.');
