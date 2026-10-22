import { SegundasRecord } from '../types';
import { collection, doc, onSnapshot, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { SEPTIEMBRE_SEGUNDAS_RECORDS } from './septiembreData';

export { SEPTIEMBRE_SEGUNDAS_RECORDS };

export function inferTecnica(diseno: string, referencia: string): 'REACTIVO' | 'PIGMENTO' {
  const d = (diseno || '').toUpperCase();
  const r = (referencia || '').toUpperCase();
  if (d.includes('QE ') || d.includes('FRUTAS') || d.includes('GRANJA') || r.includes('ML1002')) {
    return 'PIGMENTO';
  }
  return 'REACTIVO';
}

export const INITIAL_SEGUNDAS_RECORDS: SegundasRecord[] = [
  {
    "id": "seg-julio-1",
    "fecha": "2026-07-02",
    "fechaSerial": 46205,
    "revisadoras": "BLANCA -MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STICHT NIÑO",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1197,
    "cantBuena": 867,
    "pegas": 80,
    "arreLaterales": 59,
    "pctLaterales": 0.04928989139515455,
    "arreCabeceras": 91,
    "pctCabeceras": 0.07602339181286549,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 9,
      "repise": 0,
      "faltaPintura": 7,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 16
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 49,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 50
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 20,
      "montadasCostura": 13,
      "totalCostura": 33
    },
    "rotas": 1,
    "totalTintoreria": 0,
    "totalTejeduria": 50,
    "totalCostura": 33,
    "totalSegundas": 100,
    "pctTotalSegundas": 0.0835421888053467,
    "pctEstampado": 0.013366750208855471
  },
  {
    "id": "seg-julio-2",
    "fecha": "2026-07-02",
    "fechaSerial": 46205,
    "revisadoras": "BLANCA -MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STICHT NIÑA",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1195,
    "cantBuena": 848,
    "pegas": 103,
    "arreLaterales": 27,
    "pctLaterales": 0.022594142259414227,
    "arreCabeceras": 153,
    "pctCabeceras": 0.1280334728033473,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 18,
      "repise": 12,
      "faltaPintura": 1,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 31
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 13,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 13
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 1,
      "montadasCostura": 16,
      "totalCostura": 17
    },
    "rotas": 3,
    "totalTintoreria": 0,
    "totalTejeduria": 13,
    "totalCostura": 17,
    "totalSegundas": 64,
    "pctTotalSegundas": 0.05355648535564853,
    "pctEstampado": 0.02594142259414226
  },
  {
    "id": "seg-julio-3",
    "fecha": "2026-07-02",
    "fechaSerial": 46205,
    "revisadoras": "HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SKAY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1997,
    "cantBuena": 1291,
    "pegas": 102,
    "arreLaterales": 267,
    "pctLaterales": 0.13370055082623936,
    "arreCabeceras": 242,
    "pctCabeceras": 0.12118177265898848,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 22,
      "repise": 1,
      "faltaPintura": 4,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 2,
      "quemadas": 1,
      "totalEstampado": 30
    },
    "defectosTintoreria": {
      "manchaTintoreria": 19,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 19
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 33,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 33
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 3,
      "montadasCostura": 3,
      "totalCostura": 6
    },
    "rotas": 7,
    "totalTintoreria": 19,
    "totalTejeduria": 33,
    "totalCostura": 6,
    "totalSegundas": 95,
    "pctTotalSegundas": 0.04757135703555333,
    "pctEstampado": 0.015022533800701052
  },
  {
    "id": "seg-julio-4",
    "fecha": "2026-07-02",
    "fechaSerial": 46205,
    "revisadoras": "HEIDY-TATIANA-BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "BUZZ",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1657,
    "cantBuena": 1217,
    "pegas": 71,
    "arreLaterales": 165,
    "pctLaterales": 0.0995775497887749,
    "arreCabeceras": 67,
    "pctCabeceras": 0.04043452021726011,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 60,
      "repise": 7,
      "faltaPintura": 2,
      "logosCorridos": 2,
      "penetracion": 0,
      "grasa": 0,
      "descases": 2,
      "quemadas": 13,
      "totalEstampado": 86
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 20,
      "totalTintoreria": 20
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 26,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 26
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 2,
      "montadasCostura": 2,
      "totalCostura": 4
    },
    "rotas": 1,
    "totalTintoreria": 20,
    "totalTejeduria": 26,
    "totalCostura": 4,
    "totalSegundas": 137,
    "pctTotalSegundas": 0.08267954133977067,
    "pctEstampado": 0.05190102595051298
  },
  {
    "id": "seg-julio-5",
    "fecha": "2026-07-03",
    "fechaSerial": 46206,
    "revisadoras": "HEIDY-TATIANA-BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SPIDEY PEQUEÑO",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2112,
    "cantBuena": 1540,
    "pegas": 130,
    "arreLaterales": 182,
    "pctLaterales": 0.08617424242424243,
    "arreCabeceras": 100,
    "pctCabeceras": 0.04734848484848485,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 84,
      "repise": 0,
      "faltaPintura": 6,
      "logosCorridos": 1,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 91
    },
    "defectosTintoreria": {
      "manchaTintoreria": 4,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 4
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 23,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 23
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 23,
      "montadasCostura": 3,
      "totalCostura": 26
    },
    "rotas": 16,
    "totalTintoreria": 4,
    "totalTejeduria": 23,
    "totalCostura": 26,
    "totalSegundas": 160,
    "pctTotalSegundas": 0.07575757575757576,
    "pctEstampado": 0.043087121212121215
  },
  {
    "id": "seg-julio-6",
    "fecha": "2026-07-03",
    "fechaSerial": 46206,
    "revisadoras": "BLANCA -MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "TOY STORY -WOODY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 367,
    "cantBuena": 339,
    "pegas": 0,
    "arreLaterales": 0,
    "pctLaterales": 0,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 16,
      "repise": 1,
      "faltaPintura": 2,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 19
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 5,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 5
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 3,
      "montadasCostura": 0,
      "totalCostura": 3
    },
    "rotas": 1,
    "totalTintoreria": 0,
    "totalTejeduria": 5,
    "totalCostura": 3,
    "totalSegundas": 28,
    "pctTotalSegundas": 0.07629427792915532,
    "pctEstampado": 0.051771117166212535
  },
  {
    "id": "seg-julio-7",
    "fecha": "2026-07-03",
    "fechaSerial": 46206,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SPIDERMAN GRANDE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2013,
    "cantBuena": 1440,
    "pegas": 144,
    "arreLaterales": 147,
    "pctLaterales": 0.07302533532041729,
    "arreCabeceras": 179,
    "pctCabeceras": 0.08892200695479384,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 17,
      "repise": 1,
      "faltaPintura": 10,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 3,
      "quemadas": 2,
      "totalEstampado": 33
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 6,
      "totalTintoreria": 6
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 2,
      "revienteTrama": 14,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 16
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 16,
      "montadasCostura": 10,
      "totalCostura": 26
    },
    "rotas": 22,
    "totalTintoreria": 6,
    "totalTejeduria": 16,
    "totalCostura": 26,
    "totalSegundas": 103,
    "pctTotalSegundas": 0.05116741182314953,
    "pctEstampado": 0.01639344262295082
  },
  {
    "id": "seg-julio-8",
    "fecha": "2026-07-03",
    "fechaSerial": 46206,
    "revisadoras": "HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "AVENGERS IROMAN-HULK",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1574,
    "cantBuena": 1050,
    "pegas": 28,
    "arreLaterales": 274,
    "pctLaterales": 0.17407878017789072,
    "arreCabeceras": 83,
    "pctCabeceras": 0.05273189326556544,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 44,
      "repise": 34,
      "faltaPintura": 6,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 5,
      "quemadas": 0,
      "totalEstampado": 89
    },
    "defectosTintoreria": {
      "manchaTintoreria": 6,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 6
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 17,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 6,
      "totalTejeduria": 23
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 6,
      "totalCostura": 6
    },
    "rotas": 15,
    "totalTintoreria": 6,
    "totalTejeduria": 23,
    "totalCostura": 6,
    "totalSegundas": 139,
    "pctTotalSegundas": 0.08831003811944091,
    "pctEstampado": 0.056543837357052096
  },
  {
    "id": "seg-julio-9",
    "fecha": "2026-07-03",
    "fechaSerial": 46206,
    "revisadoras": "HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "AVENGER-C AMERICA-THOR",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 139,
    "cantBuena": 106,
    "pegas": 4,
    "arreLaterales": 21,
    "pctLaterales": 0.1510791366906475,
    "arreCabeceras": 6,
    "pctCabeceras": 0.04316546762589928,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 2,
      "quemadas": 0,
      "totalEstampado": 2
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 0
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 0
    },
    "rotas": 0,
    "totalTintoreria": 0,
    "totalTejeduria": 0,
    "totalCostura": 0,
    "totalSegundas": 2,
    "pctTotalSegundas": 0.014388489208633094,
    "pctEstampado": 0.014388489208633094
  },
  {
    "id": "seg-julio-10",
    "fecha": "2026-07-09",
    "fechaSerial": 46212,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "TOY STORY -WOODY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1278,
    "cantBuena": 854,
    "pegas": 72,
    "arreLaterales": 76,
    "pctLaterales": 0.0594679186228482,
    "arreCabeceras": 90,
    "pctCabeceras": 0.07042253521126761,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 40,
      "repise": 65,
      "faltaPintura": 30,
      "logosCorridos": 0,
      "penetracion": 2,
      "grasa": 14,
      "descases": 3,
      "quemadas": 0,
      "totalEstampado": 154
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 6,
      "revienteTrama": 8,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 14
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 4,
      "montadasCostura": 5,
      "totalCostura": 9
    },
    "rotas": 9,
    "totalTintoreria": 0,
    "totalTejeduria": 14,
    "totalCostura": 9,
    "totalSegundas": 186,
    "pctTotalSegundas": 0.14553990610328638,
    "pctEstampado": 0.12050078247261346
  },
  {
    "id": "seg-julio-11",
    "fecha": "2026-07-10",
    "fechaSerial": 46213,
    "revisadoras": "TATIANA-HEIDY",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "MARIE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1233,
    "cantBuena": 837,
    "pegas": 60,
    "arreLaterales": 127,
    "pctLaterales": 0.1030008110300081,
    "arreCabeceras": 122,
    "pctCabeceras": 0.0989456609894566,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 18,
      "repise": 1,
      "faltaPintura": 1,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 20
    },
    "defectosTintoreria": {
      "manchaTintoreria": 2,
      "manchaOxido": 0,
      "arrastreBarca": 4,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 6
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 20,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 20
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 28,
      "tundidoCaido": 4,
      "montadasCostura": 7,
      "totalCostura": 39
    },
    "rotas": 2,
    "totalTintoreria": 6,
    "totalTejeduria": 20,
    "totalCostura": 39,
    "totalSegundas": 87,
    "pctTotalSegundas": 0.0705596107055961,
    "pctEstampado": 0.016220600162206
  },
  {
    "id": "seg-julio-12",
    "fecha": "2026-07-17",
    "fechaSerial": 46220,
    "revisadoras": "MAYULIS-BLANCA-HEIDY-TATIANA",
    "cliente": "GIGANTE DEL HOGAR",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C SPIDERMAN",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1485,
    "cantBuena": 978,
    "pegas": 123,
    "arreLaterales": 98,
    "pctLaterales": 0.06599326599326599,
    "arreCabeceras": 229,
    "pctCabeceras": 0.1542087542087542,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 9,
      "repise": 5,
      "faltaPintura": 10,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 1,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 25
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 8,
      "revienteTrama": 18,
      "marra": 0,
      "rayas": 4,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 30
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 1,
      "montadasCostura": 0,
      "totalCostura": 1
    },
    "rotas": 0,
    "totalTintoreria": 1,
    "totalTejeduria": 30,
    "totalCostura": 1,
    "totalSegundas": 57,
    "pctTotalSegundas": 0.03838383838383838,
    "pctEstampado": 0.016835016835016835
  },
  {
    "id": "seg-julio-13",
    "fecha": "2026-07-17",
    "fechaSerial": 46220,
    "revisadoras": "TATIANA-HEIDY",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C MARIE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1133,
    "cantBuena": 722,
    "pegas": 68,
    "arreLaterales": 121,
    "pctLaterales": 0.10679611650485436,
    "arreCabeceras": 124,
    "pctCabeceras": 0.10944395410414828,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 7,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 7
    },
    "defectosTintoreria": {
      "manchaTintoreria": 57,
      "manchaOxido": 0,
      "arrastreBarca": 10,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 67
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 2,
      "revienteTrama": 11,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 13
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 3,
      "totalCostura": 3
    },
    "rotas": 8,
    "totalTintoreria": 67,
    "totalTejeduria": 13,
    "totalCostura": 3,
    "totalSegundas": 98,
    "pctTotalSegundas": 0.08649602824360106,
    "pctEstampado": 0.00617828773168579
  },
  {
    "id": "seg-julio-14",
    "fecha": "2026-07-18",
    "fechaSerial": 46221,
    "revisadoras": "MAYULIS- BLANCA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STICHT NIÑO",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1689,
    "cantBuena": 1213,
    "pegas": 86,
    "arreLaterales": 171,
    "pctLaterales": 0.10124333925399645,
    "arreCabeceras": 137,
    "pctCabeceras": 0.08111308466548253,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 40,
      "repise": 0,
      "faltaPintura": 25,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 65
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 1,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 11,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 11
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 0
    },
    "rotas": 5,
    "totalTintoreria": 1,
    "totalTejeduria": 11,
    "totalCostura": 0,
    "totalSegundas": 82,
    "pctTotalSegundas": 0.04854943753700414,
    "pctEstampado": 0.03848431024274719
  },
  {
    "id": "seg-julio-15",
    "fecha": "2026-07-18",
    "fechaSerial": 46221,
    "revisadoras": "MAYULIS- BLANCA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C MINNIE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1024,
    "cantBuena": 715,
    "pegas": 75,
    "arreLaterales": 120,
    "pctLaterales": 0.1171875,
    "arreCabeceras": 38,
    "pctCabeceras": 0.037109375,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 27,
      "repise": 4,
      "faltaPintura": 2,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 33
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 20,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 20
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 16,
      "montadasCostura": 4,
      "totalCostura": 20
    },
    "rotas": 3,
    "totalTintoreria": 0,
    "totalTejeduria": 20,
    "totalCostura": 20,
    "totalSegundas": 76,
    "pctTotalSegundas": 0.07421875,
    "pctEstampado": 0.0322265625
  },
  {
    "id": "seg-julio-16",
    "fecha": "2026-07-18",
    "fechaSerial": 46221,
    "revisadoras": "MAYULIS-BLANCA-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C MIKEY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1997,
    "cantBuena": 1225,
    "pegas": 104,
    "arreLaterales": 207,
    "pctLaterales": 0.10365548322483725,
    "arreCabeceras": 105,
    "pctCabeceras": 0.05257886830245368,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 106,
      "repise": 127,
      "faltaPintura": 22,
      "logosCorridos": 0,
      "penetracion": 2,
      "grasa": 0,
      "descases": 10,
      "quemadas": 0,
      "totalEstampado": 267
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 25,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 25
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 9,
      "revienteTrama": 32,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 41
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 11,
      "montadasCostura": 0,
      "totalCostura": 11
    },
    "rotas": 12,
    "totalTintoreria": 25,
    "totalTejeduria": 41,
    "totalCostura": 11,
    "totalSegundas": 356,
    "pctTotalSegundas": 0.17826740110165248,
    "pctEstampado": 0.13370055082623936
  },
  {
    "id": "seg-julio-17",
    "fecha": "2026-07-18",
    "fechaSerial": 46221,
    "revisadoras": "HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "WOODY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 369,
    "cantBuena": 256,
    "pegas": 13,
    "arreLaterales": 44,
    "pctLaterales": 0.11924119241192412,
    "arreCabeceras": 17,
    "pctCabeceras": 0.04607046070460705,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 1,
      "repise": 11,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 2,
      "quemadas": 0,
      "totalEstampado": 14
    },
    "defectosTintoreria": {
      "manchaTintoreria": 6,
      "manchaOxido": 0,
      "arrastreBarca": 7,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 13
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 3,
      "revienteTrama": 7,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 10
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 2,
      "totalCostura": 2
    },
    "rotas": 0,
    "totalTintoreria": 13,
    "totalTejeduria": 10,
    "totalCostura": 2,
    "totalSegundas": 39,
    "pctTotalSegundas": 0.10569105691056911,
    "pctEstampado": 0.037940379403794036
  },
  {
    "id": "seg-julio-18",
    "fecha": "2026-07-23",
    "fechaSerial": 46226,
    "revisadoras": "KARELYS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C CARS",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 360,
    "cantBuena": 315,
    "pegas": 0,
    "arreLaterales": 22,
    "pctLaterales": 0.06111111111111111,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 0
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 13,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 13
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 10,
      "totalCostura": 10
    },
    "rotas": 0,
    "totalTintoreria": 0,
    "totalTejeduria": 13,
    "totalCostura": 10,
    "totalSegundas": 23,
    "pctTotalSegundas": 0.06388888888888888,
    "pctEstampado": 0
  },
  {
    "id": "seg-julio-19",
    "fecha": "2026-07-23",
    "fechaSerial": 46226,
    "revisadoras": "KARELYS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "BUZZ",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 854,
    "cantBuena": 748,
    "pegas": 0,
    "arreLaterales": 9,
    "pctLaterales": 0.01053864168618267,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 5,
      "repise": 0,
      "faltaPintura": 10,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 15
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 9,
      "revienteTrama": 42,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 51
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 28,
      "totalCostura": 28
    },
    "rotas": 3,
    "totalTintoreria": 0,
    "totalTejeduria": 51,
    "totalCostura": 28,
    "totalSegundas": 97,
    "pctTotalSegundas": 0.11358313817330211,
    "pctEstampado": 0.01756440281030445
  },
  {
    "id": "seg-julio-20",
    "fecha": "2026-07-24",
    "fechaSerial": 46227,
    "revisadoras": "KARELYS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C WOODY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 295,
    "cantBuena": 278,
    "pegas": 0,
    "arreLaterales": 3,
    "pctLaterales": 0.010169491525423728,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 0
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 9,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 9
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 5,
      "totalCostura": 5
    },
    "rotas": 0,
    "totalTintoreria": 0,
    "totalTejeduria": 9,
    "totalCostura": 5,
    "totalSegundas": 14,
    "pctTotalSegundas": 0.04745762711864407,
    "pctEstampado": 0
  },
  {
    "id": "seg-julio-21",
    "fecha": "2026-07-24",
    "fechaSerial": 46227,
    "revisadoras": "KARELYS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C VAQUERA -TOY STORY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 305,
    "cantBuena": 250,
    "pegas": 0,
    "arreLaterales": 33,
    "pctLaterales": 0.10819672131147541,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 8,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 8
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 5,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 5
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 9,
      "totalCostura": 9
    },
    "rotas": 0,
    "totalTintoreria": 0,
    "totalTejeduria": 5,
    "totalCostura": 9,
    "totalSegundas": 22,
    "pctTotalSegundas": 0.07213114754098361,
    "pctEstampado": 0.02622950819672131
  },
  {
    "id": "seg-julio-22",
    "fecha": "2026-07-25",
    "fechaSerial": 46228,
    "revisadoras": "KARELYS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STARWARS",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 550,
    "cantBuena": 503,
    "pegas": 0,
    "arreLaterales": 24,
    "pctLaterales": 0.04363636363636364,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 0,
      "faltaPintura": 5,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 5
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 7,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 8
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 10,
      "totalCostura": 10
    },
    "rotas": 0,
    "totalTintoreria": 0,
    "totalTejeduria": 8,
    "totalCostura": 10,
    "totalSegundas": 23,
    "pctTotalSegundas": 0.04181818181818182,
    "pctEstampado": 0.00909090909090909
  },
  {
    "id": "seg-julio-23",
    "fecha": "2026-07-27",
    "fechaSerial": 46230,
    "revisadoras": "HEIDY-TATIANA-BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "CARS",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 534,
    "cantBuena": 369,
    "pegas": 17,
    "arreLaterales": 67,
    "pctLaterales": 0.1254681647940075,
    "arreCabeceras": 53,
    "pctCabeceras": 0.09925093632958802,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 8,
      "repise": 0,
      "faltaPintura": 1,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 9
    },
    "defectosTintoreria": {
      "manchaTintoreria": 2,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 2
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 7,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 7
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 10,
      "montadasCostura": 0,
      "totalCostura": 10
    },
    "rotas": 1,
    "totalTintoreria": 2,
    "totalTejeduria": 7,
    "totalCostura": 10,
    "totalSegundas": 28,
    "pctTotalSegundas": 0.052434456928838954,
    "pctEstampado": 0.016853932584269662
  },
  {
    "id": "seg-julio-24",
    "fecha": "2026-07-28",
    "fechaSerial": 46231,
    "revisadoras": "BLANCA -MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "BUZZ",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 318,
    "cantBuena": 166,
    "pegas": 23,
    "arreLaterales": 39,
    "pctLaterales": 0.12264150943396226,
    "arreCabeceras": 66,
    "pctCabeceras": 0.20754716981132076,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 1,
      "repise": 14,
      "faltaPintura": 6,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 21
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 1,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 1,
      "totalTintoreria": 3
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 0
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 0
    },
    "rotas": 1,
    "totalTintoreria": 3,
    "totalTejeduria": 0,
    "totalCostura": 0,
    "totalSegundas": 24,
    "pctTotalSegundas": 0.07547169811320754,
    "pctEstampado": 0.0660377358490566
  },
  {
    "id": "seg-julio-25",
    "fecha": "2026-07-28",
    "fechaSerial": 46231,
    "revisadoras": "BLANCA -MAYULIS",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STICHT NIÑO",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 323,
    "cantBuena": 201,
    "pegas": 30,
    "arreLaterales": 27,
    "pctLaterales": 0.08359133126934984,
    "arreCabeceras": 44,
    "pctCabeceras": 0.13622291021671826,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 1,
      "repise": 0,
      "faltaPintura": 4,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 5
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 0
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 15,
      "montadasCostura": 0,
      "totalCostura": 15
    },
    "rotas": 3,
    "totalTintoreria": 1,
    "totalTejeduria": 0,
    "totalCostura": 15,
    "totalSegundas": 21,
    "pctTotalSegundas": 0.06501547987616099,
    "pctEstampado": 0.015479876160990712
  },
  {
    "id": "seg-julio-26",
    "fecha": "2026-07-28",
    "fechaSerial": 46231,
    "revisadoras": "HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "CARS",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1313,
    "cantBuena": 836,
    "pegas": 49,
    "arreLaterales": 227,
    "pctLaterales": 0.1728865194211729,
    "arreCabeceras": 137,
    "pctCabeceras": 0.10434120335110435,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 26,
      "repise": 0,
      "faltaPintura": 5,
      "logosCorridos": 2,
      "penetracion": 0,
      "grasa": 0,
      "descases": 2,
      "quemadas": 0,
      "totalEstampado": 35
    },
    "defectosTintoreria": {
      "manchaTintoreria": 2,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 2
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 4,
      "revienteTrama": 14,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 18
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 9,
      "montadasCostura": 0,
      "totalCostura": 9
    },
    "rotas": 11,
    "totalTintoreria": 2,
    "totalTejeduria": 18,
    "totalCostura": 9,
    "totalSegundas": 64,
    "pctTotalSegundas": 0.048743335872048744,
    "pctEstampado": 0.026656511805026657
  },
  {
    "id": "seg-julio-27",
    "fecha": "2026-07-30",
    "fechaSerial": 46233,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SPIDERMAN GRANDE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1670,
    "cantBuena": 1025,
    "pegas": 83,
    "arreLaterales": 268,
    "pctLaterales": 0.16047904191616766,
    "arreCabeceras": 226,
    "pctCabeceras": 0.13532934131736526,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 8,
      "repise": 10,
      "faltaPintura": 11,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 1,
      "quemadas": 0,
      "totalEstampado": 30
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 8,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 9
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 29,
      "montadasCostura": 0,
      "totalCostura": 29
    },
    "rotas": 3,
    "totalTintoreria": 0,
    "totalTejeduria": 9,
    "totalCostura": 29,
    "totalSegundas": 68,
    "pctTotalSegundas": 0.0407185628742515,
    "pctEstampado": 0.017964071856287425
  },
  {
    "id": "seg-julio-28",
    "fecha": "2026-07-30",
    "fechaSerial": 46233,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SAFARI",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 4365,
    "cantBuena": 3118,
    "pegas": 209,
    "arreLaterales": 410,
    "pctLaterales": 0.09392898052691867,
    "arreCabeceras": 378,
    "pctCabeceras": 0.0865979381443299,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 64,
      "repise": 12,
      "faltaPintura": 22,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 98
    },
    "defectosTintoreria": {
      "manchaTintoreria": 106,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 106
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 2,
      "revienteTrama": 38,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 40
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 6,
      "totalCostura": 6
    },
    "rotas": 8,
    "totalTintoreria": 106,
    "totalTejeduria": 40,
    "totalCostura": 6,
    "totalSegundas": 250,
    "pctTotalSegundas": 0.0572737686139748,
    "pctEstampado": 0.02245131729667812
  },
  {
    "id": "seg-julio-29",
    "fecha": "2026-07-31",
    "fechaSerial": 46234,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SKEY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1836,
    "cantBuena": 1389,
    "pegas": 83,
    "arreLaterales": 189,
    "pctLaterales": 0.10294117647058823,
    "arreCabeceras": 114,
    "pctCabeceras": 0.06209150326797386,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 2,
      "repise": 0,
      "faltaPintura": 9,
      "logosCorridos": 1,
      "penetracion": 0,
      "grasa": 1,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 13
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 8,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 8
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 40,
      "montadasCostura": 0,
      "totalCostura": 40
    },
    "rotas": 7,
    "totalTintoreria": 0,
    "totalTejeduria": 8,
    "totalCostura": 40,
    "totalSegundas": 61,
    "pctTotalSegundas": 0.0332244008714597,
    "pctEstampado": 0.007080610021786492
  },
  {
    "id": "seg-julio-30",
    "fecha": "2026-07-30",
    "fechaSerial": 46233,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STICHT NIÑA",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2251,
    "cantBuena": 1698,
    "pegas": 83,
    "arreLaterales": 189,
    "pctLaterales": 0.08396268325188805,
    "arreCabeceras": 114,
    "pctCabeceras": 0.050644158151932475,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 36,
      "repise": 21,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 3,
      "descases": 14,
      "quemadas": 0,
      "totalEstampado": 74
    },
    "defectosTintoreria": {
      "manchaTintoreria": 63,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 63
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 20,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 20
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 10,
      "montadasCostura": 0,
      "totalCostura": 10
    },
    "rotas": 7,
    "totalTintoreria": 63,
    "totalTejeduria": 20,
    "totalCostura": 10,
    "totalSegundas": 167,
    "pctTotalSegundas": 0.07418924922256774,
    "pctEstampado": 0.03287427809862283
  },
  {
    "id": "seg-julio-31",
    "fecha": "2026-07-31",
    "fechaSerial": 46234,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "LINEA",
    "referencia": "C280T",
    "dimensiones": "60*120-281",
    "diseno": "C MINNIE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 969,
    "cantBuena": 510,
    "pegas": 62,
    "arreLaterales": 70,
    "pctLaterales": 0.07223942208462332,
    "arreCabeceras": 234,
    "pctCabeceras": 0.24148606811145512,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 42,
      "repise": 26,
      "faltaPintura": 8,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 1,
      "quemadas": 0,
      "totalEstampado": 77
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 3,
      "revienteTrama": 5,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 8
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 3,
      "montadasCostura": 0,
      "totalCostura": 3
    },
    "rotas": 5,
    "totalTintoreria": 0,
    "totalTejeduria": 8,
    "totalCostura": 3,
    "totalSegundas": 93,
    "pctTotalSegundas": 0.09597523219814241,
    "pctEstampado": 0.07946336429308566
  },
  {
    "id": "seg-agosto-1",
    "fecha": "2026-08-06",
    "fechaSerial": 46240,
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "ML1002",
    "dimensiones": "35*60-350",
    "diseno": "FRUTAS",
    "color": "EST",
    "tecnica": "PIGMENTO",
    "cantTotalRevisada": 3148,
    "cantBuena": 2099,
    "pegas": 271,
    "arreLaterales": 449,
    "pctLaterales": 0.1426302414231258,
    "arreCabeceras": 225,
    "pctCabeceras": 0.07147395171537484,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 38,
      "repise": 4,
      "faltaPintura": 8,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 50
    },
    "defectosTintoreria": {
      "manchaTintoreria": 4,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 4,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 18,
      "totalTintoreria": 26
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 4,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 4
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 15,
      "totalCostura": 15
    },
    "rotas": 9,
    "totalTintoreria": 26,
    "totalTejeduria": 4,
    "totalCostura": 15,
    "totalSegundas": 104,
    "pctTotalSegundas": 0.03303684879288437,
    "pctEstampado": 0.01588310038119441
  },
  {
    "id": "seg-agosto-2",
    "fecha": "2026-08-06",
    "fechaSerial": 46240,
    "revisadoras": "HEIDY -TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "ML1002",
    "dimensiones": "35*60-350",
    "diseno": "GRANJA",
    "color": "EST",
    "tecnica": "PIGMENTO",
    "cantTotalRevisada": 4368,
    "cantBuena": 3822,
    "pegas": 134,
    "arreLaterales": 234,
    "pctLaterales": 0.05357142857142857,
    "arreCabeceras": 99,
    "pctCabeceras": 0.022664835164835164,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 27,
      "repise": 0,
      "faltaPintura": 33,
      "logosCorridos": 3,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 63
    },
    "defectosTintoreria": {
      "manchaTintoreria": 3,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 1,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 1,
      "totalTintoreria": 5
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 6,
      "revienteTrama": 3,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 9
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 0
    },
    "rotas": 2,
    "totalTintoreria": 5,
    "totalTejeduria": 9,
    "totalCostura": 0,
    "totalSegundas": 79,
    "pctTotalSegundas": 0.018086080586080588,
    "pctEstampado": 0.014423076923076924
  },
  {
    "id": "seg-agosto-3",
    "fecha": "2026-08-11",
    "fechaSerial": 46245,
    "revisadoras": "HEIDY -TATIANA- BLANCA -MAYULIS",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SPIDEY PEQUEÑO",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1984,
    "cantBuena": 1497,
    "pegas": 61,
    "arreLaterales": 204,
    "pctLaterales": 0.1028225806451613,
    "arreCabeceras": 132,
    "pctCabeceras": 0.06653225806451613,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 45,
      "repise": 2,
      "faltaPintura": 8,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 55
    },
    "defectosTintoreria": {
      "manchaTintoreria": 4,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 13,
      "totalTintoreria": 17
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 10,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 10
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 0
    },
    "rotas": 8,
    "totalTintoreria": 17,
    "totalTejeduria": 10,
    "totalCostura": 0,
    "totalSegundas": 90,
    "pctTotalSegundas": 0.04536290322580645,
    "pctEstampado": 0.027721774193548387
  },
  {
    "id": "seg-agosto-4",
    "fecha": "2026-08-11",
    "fechaSerial": 46245,
    "revisadoras": "BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SPIDERMAN GRANDE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 539,
    "cantBuena": 430,
    "pegas": 25,
    "arreLaterales": 24,
    "pctLaterales": 0.04452690166975881,
    "arreCabeceras": 40,
    "pctCabeceras": 0.07421150278293136,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 2,
      "repise": 3,
      "faltaPintura": 7,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 12
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 0
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 4,
      "montadasCostura": 0,
      "totalCostura": 4
    },
    "rotas": 4,
    "totalTintoreria": 0,
    "totalTejeduria": 0,
    "totalCostura": 4,
    "totalSegundas": 20,
    "pctTotalSegundas": 0.03710575139146568,
    "pctEstampado": 0.022263450834879406
  },
  {
    "id": "seg-agosto-5",
    "fecha": "2026-08-11",
    "fechaSerial": 46245,
    "revisadoras": "BLANCA-MAYULIS-HEIDY - TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C MINNIE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2451,
    "cantBuena": 1801,
    "pegas": 117,
    "arreLaterales": 105,
    "pctLaterales": 0.042839657282741736,
    "arreCabeceras": 215,
    "pctCabeceras": 0.08771929824561403,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 31,
      "repise": 3,
      "faltaPintura": 58,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 6,
      "quemadas": 0,
      "totalEstampado": 98
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 6,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 6
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 87,
      "tundidoCaido": 8,
      "montadasCostura": 0,
      "totalCostura": 95
    },
    "rotas": 14,
    "totalTintoreria": 0,
    "totalTejeduria": 6,
    "totalCostura": 95,
    "totalSegundas": 213,
    "pctTotalSegundas": 0.08690330477356181,
    "pctEstampado": 0.03998368013055895
  },
  {
    "id": "seg-agosto-6",
    "fecha": "2026-08-11",
    "fechaSerial": 46245,
    "revisadoras": "HEIDY-TATIANA -MAYULIS-BLANCA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SKY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2809,
    "cantBuena": 2136,
    "pegas": 90,
    "arreLaterales": 210,
    "pctLaterales": 0.07475970096119615,
    "arreCabeceras": 285,
    "pctCabeceras": 0.10145959416162335,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 7,
      "repise": 6,
      "faltaPintura": 12,
      "logosCorridos": 0,
      "penetracion": 3,
      "grasa": 8,
      "descases": 0,
      "quemadas": 2,
      "totalEstampado": 38
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 2,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 3
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 6,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 6
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 18,
      "tundidoCaido": 19,
      "montadasCostura": 0,
      "totalCostura": 37
    },
    "rotas": 4,
    "totalTintoreria": 3,
    "totalTejeduria": 6,
    "totalCostura": 37,
    "totalSegundas": 88,
    "pctTotalSegundas": 0.03132787468850125,
    "pctEstampado": 0.013527945888216448
  },
  {
    "id": "seg-agosto-7",
    "fecha": "2026-08-11",
    "fechaSerial": 46245,
    "revisadoras": "HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STICTH NIÑA",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2339,
    "cantBuena": 1432,
    "pegas": 107,
    "arreLaterales": 400,
    "pctLaterales": 0.17101325352714836,
    "arreCabeceras": 334,
    "pctCabeceras": 0.14279606669516887,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 9,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 3,
      "grasa": 6,
      "descases": 7,
      "quemadas": 0,
      "totalEstampado": 25
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 25,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 25
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 9,
      "tundidoCaido": 0,
      "montadasCostura": 1,
      "totalCostura": 10
    },
    "rotas": 5,
    "totalTintoreria": 1,
    "totalTejeduria": 25,
    "totalCostura": 10,
    "totalSegundas": 66,
    "pctTotalSegundas": 0.02821718683197948,
    "pctEstampado": 0.010688328345446772
  },
  {
    "id": "seg-agosto-8",
    "fecha": "2026-08-12",
    "fechaSerial": 46246,
    "revisadoras": "TATIANA-KEVIN-MAYULIS-BLANCA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "TOY STORY WOODY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2374,
    "cantBuena": 1657,
    "pegas": 103,
    "arreLaterales": 371,
    "pctLaterales": 0.15627632687447346,
    "arreCabeceras": 132,
    "pctCabeceras": 0.05560235888795282,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 20,
      "repise": 8,
      "faltaPintura": 14,
      "logosCorridos": 0,
      "penetracion": 2,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 44
    },
    "defectosTintoreria": {
      "manchaTintoreria": 2,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 2,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 4
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 32,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 33
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 15,
      "montadasCostura": 8,
      "totalCostura": 23
    },
    "rotas": 7,
    "totalTintoreria": 4,
    "totalTejeduria": 33,
    "totalCostura": 23,
    "totalSegundas": 111,
    "pctTotalSegundas": 0.04675652906486942,
    "pctEstampado": 0.018534119629317607
  },
  {
    "id": "seg-agosto-9",
    "fecha": "2026-08-12",
    "fechaSerial": 46246,
    "revisadoras": "TATIANA-KEVIN",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C BUZZ",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1318,
    "cantBuena": 1061,
    "pegas": 49,
    "arreLaterales": 152,
    "pctLaterales": 0.11532625189681335,
    "arreCabeceras": 40,
    "pctCabeceras": 0.030349013657056147,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 6,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 1,
      "grasa": 0,
      "descases": 1,
      "quemadas": 0,
      "totalEstampado": 8
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 1,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 2
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 2,
      "montadasCostura": 1,
      "totalCostura": 3
    },
    "rotas": 2,
    "totalTintoreria": 1,
    "totalTejeduria": 2,
    "totalCostura": 3,
    "totalSegundas": 16,
    "pctTotalSegundas": 0.012139605462822459,
    "pctEstampado": 0.006069802731411229
  },
  {
    "id": "seg-agosto-10",
    "fecha": "2026-08-13",
    "fechaSerial": 46247,
    "revisadoras": "MAYULIS-BLANCA-HEIDY-TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C MARIE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2353,
    "cantBuena": 1391,
    "pegas": 127,
    "arreLaterales": 327,
    "pctLaterales": 0.1389715257118572,
    "arreCabeceras": 162,
    "pctCabeceras": 0.06884827879303017,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 27,
      "repise": 5,
      "faltaPintura": 1,
      "logosCorridos": 0,
      "penetracion": 3,
      "grasa": 6,
      "descases": 0,
      "quemadas": 6,
      "totalEstampado": 48
    },
    "defectosTintoreria": {
      "manchaTintoreria": 11,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 1,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 12
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 50,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 50
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 223,
      "tundidoCaido": 2,
      "montadasCostura": 5,
      "totalCostura": 230
    },
    "rotas": 6,
    "totalTintoreria": 12,
    "totalTejeduria": 50,
    "totalCostura": 230,
    "totalSegundas": 346,
    "pctTotalSegundas": 0.14704632384190394,
    "pctEstampado": 0.020399490012749683
  },
  {
    "id": "seg-agosto-11",
    "fecha": "2026-08-14",
    "fechaSerial": 46248,
    "revisadoras": "MAYULIS-BLANCAA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C CARS",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2401,
    "cantBuena": 2070,
    "pegas": 0,
    "arreLaterales": 116,
    "pctLaterales": 0.04831320283215327,
    "arreCabeceras": 144,
    "pctCabeceras": 0.059975010412328195,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 3,
      "repise": 2,
      "faltaPintura": 2,
      "logosCorridos": 3,
      "penetracion": 0,
      "grasa": 2,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 12
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 2,
      "revienteTrama": 46,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 48
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 4,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 4
    },
    "rotas": 7,
    "totalTintoreria": 0,
    "totalTejeduria": 48,
    "totalCostura": 4,
    "totalSegundas": 71,
    "pctTotalSegundas": 0.029571012078300707,
    "pctEstampado": 0.0049979175343606835
  },
  {
    "id": "seg-agosto-12",
    "fecha": "2026-08-18",
    "fechaSerial": 46252,
    "revisadoras": "BLANCA-MAYULIS-HEIDY - TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "ME1002",
    "dimensiones": "30*50-330",
    "diseno": "NAVIDAD ANDU",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 11957,
    "cantBuena": 9777,
    "pegas": 419,
    "arreLaterales": 786,
    "pctLaterales": 0.06573555239608597,
    "arreCabeceras": 795,
    "pctCabeceras": 0.06648824956092665,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 18,
      "repise": 38,
      "faltaPintura": 2,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 37,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 95
    },
    "defectosTintoreria": {
      "manchaTintoreria": 33,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 33
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 6,
      "revienteTrama": 13,
      "marra": 0,
      "rayas": 12,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 31
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 21,
      "totalCostura": 21
    },
    "rotas": 0,
    "totalTintoreria": 33,
    "totalTejeduria": 31,
    "totalCostura": 21,
    "totalSegundas": 180,
    "pctTotalSegundas": 0.015053943296813583,
    "pctEstampado": 0.007945136739984947
  },
  {
    "id": "seg-agosto-13",
    "fecha": "2026-08-20",
    "fechaSerial": 46254,
    "revisadoras": "GREYS-HEIDY",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "ML1002",
    "dimensiones": "35*60-330",
    "diseno": "QE UTENCILIO",
    "color": "EST",
    "tecnica": "PIGMENTO",
    "cantTotalRevisada": 1969,
    "cantBuena": 1707,
    "pegas": 80,
    "arreLaterales": 97,
    "pctLaterales": 0.04926358557643474,
    "arreCabeceras": 76,
    "pctCabeceras": 0.038598273235144746,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 0
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 3,
      "totalTintoreria": 3
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 4,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 4
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 0
    },
    "rotas": 2,
    "totalTintoreria": 3,
    "totalTejeduria": 4,
    "totalCostura": 0,
    "totalSegundas": 9,
    "pctTotalSegundas": 0.0045708481462671405,
    "pctEstampado": 0
  },
  {
    "id": "seg-agosto-14",
    "fecha": "2026-08-20",
    "fechaSerial": 46254,
    "revisadoras": "GREYS-HEIDY",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "ML1002",
    "dimensiones": "35*60-330",
    "diseno": "QE FRUTA",
    "color": "EST",
    "tecnica": "PIGMENTO",
    "cantTotalRevisada": 1518,
    "cantBuena": 1329,
    "pegas": 39,
    "arreLaterales": 98,
    "pctLaterales": 0.06455862977602109,
    "arreCabeceras": 40,
    "pctCabeceras": 0.026350461133069828,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 0
    },
    "defectosTintoreria": {
      "manchaTintoreria": 4,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 4
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 3,
      "revienteTrama": 4,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 7
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 1,
      "totalCostura": 1
    },
    "rotas": 0,
    "totalTintoreria": 4,
    "totalTejeduria": 7,
    "totalCostura": 1,
    "totalSegundas": 12,
    "pctTotalSegundas": 0.007905138339920948,
    "pctEstampado": 0
  },
  {
    "id": "seg-agosto-15",
    "fecha": "2026-08-20",
    "fechaSerial": 46254,
    "revisadoras": "BLANCA-MAYULIS-HEIDY - TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SAFARI",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2364,
    "cantBuena": 1758,
    "pegas": 75,
    "arreLaterales": 239,
    "pctLaterales": 0.10109983079526226,
    "arreCabeceras": 212,
    "pctCabeceras": 0.08967851099830795,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 45,
      "repise": 4,
      "faltaPintura": 3,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 2,
      "totalEstampado": 54
    },
    "defectosTintoreria": {
      "manchaTintoreria": 11,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 11
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 13,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 14
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 1,
      "totalCostura": 1
    },
    "rotas": 0,
    "totalTintoreria": 11,
    "totalTejeduria": 14,
    "totalCostura": 1,
    "totalSegundas": 80,
    "pctTotalSegundas": 0.0338409475465313,
    "pctEstampado": 0.02284263959390863
  },
  {
    "id": "seg-agosto-16",
    "fecha": "2026-08-21",
    "fechaSerial": 46255,
    "revisadoras": "BLANCA-MAYULIS-HEIDY - TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SPIDER MAN MARVEL",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2598,
    "cantBuena": 1877,
    "pegas": 147,
    "arreLaterales": 166,
    "pctLaterales": 0.06389530408006158,
    "arreCabeceras": 305,
    "pctCabeceras": 0.11739799846035412,
    "observaciones": "620 con fondo rosado",
    "defectosEstampado": {
      "manchas": 24,
      "repise": 0,
      "faltaPintura": 18,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 1,
      "quemadas": 0,
      "totalEstampado": 43
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 8,
      "revienteTrama": 25,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 33
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 12,
      "montadasCostura": 8,
      "totalCostura": 20
    },
    "rotas": 7,
    "totalTintoreria": 0,
    "totalTejeduria": 33,
    "totalCostura": 20,
    "totalSegundas": 103,
    "pctTotalSegundas": 0.03964588144726713,
    "pctEstampado": 0.016551193225558123
  },
  {
    "id": "seg-agosto-17",
    "fecha": "2026-08-22",
    "fechaSerial": 46256,
    "revisadoras": "HEIDY-TATIANA -MAYULIS-BLANCA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "BUZZ",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 841,
    "cantBuena": 375,
    "pegas": 90,
    "arreLaterales": 98,
    "pctLaterales": 0.11652794292508918,
    "arreCabeceras": 214,
    "pctCabeceras": 0.2544589774078478,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 27,
      "repise": 4,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 31
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 8,
      "revienteTrama": 13,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 21
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 4,
      "montadasCostura": 0,
      "totalCostura": 4
    },
    "rotas": 7,
    "totalTintoreria": 1,
    "totalTejeduria": 21,
    "totalCostura": 4,
    "totalSegundas": 64,
    "pctTotalSegundas": 0.07609988109393578,
    "pctEstampado": 0.036860879904875146
  },
  {
    "id": "seg-agosto-18",
    "fecha": "2026-08-22",
    "fechaSerial": 46256,
    "revisadoras": "BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STICTH NIÑA",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1204,
    "cantBuena": 537,
    "pegas": 69,
    "arreLaterales": 110,
    "pctLaterales": 0.09136212624584718,
    "arreCabeceras": 159,
    "pctCabeceras": 0.13205980066445183,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 9,
      "repise": 14,
      "faltaPintura": 4,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 27
    },
    "defectosTintoreria": {
      "manchaTintoreria": 3,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 3
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 4,
      "revienteTrama": 12,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 16
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 277,
      "tundidoCaido": 0,
      "montadasCostura": 3,
      "totalCostura": 280
    },
    "rotas": 3,
    "totalTintoreria": 3,
    "totalTejeduria": 16,
    "totalCostura": 280,
    "totalSegundas": 329,
    "pctTotalSegundas": 0.27325581395348836,
    "pctEstampado": 0.022425249169435217
  },
  {
    "id": "seg-agosto-19",
    "fecha": "2026-08-27",
    "fechaSerial": 46261,
    "revisadoras": "BLANCA-MAYULIS-HEIDY - TATIANA",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "JESSEI",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2143,
    "cantBuena": 1375,
    "pegas": 174,
    "arreLaterales": 156,
    "pctLaterales": 0.07279514699020065,
    "arreCabeceras": 357,
    "pctCabeceras": 0.16658889407372843,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 17,
      "repise": 1,
      "faltaPintura": 0,
      "logosCorridos": 1,
      "penetracion": 8,
      "grasa": 0,
      "descases": 2,
      "quemadas": 0,
      "totalEstampado": 29
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 1,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 2,
      "revienteTrama": 14,
      "marra": 1,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 17
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 7,
      "montadasCostura": 7,
      "totalCostura": 14
    },
    "rotas": 20,
    "totalTintoreria": 1,
    "totalTejeduria": 17,
    "totalCostura": 14,
    "totalSegundas": 81,
    "pctTotalSegundas": 0.0377974801679888,
    "pctEstampado": 0.013532431171255249
  },
  {
    "id": "seg-agosto-20",
    "fecha": "2026-08-27",
    "fechaSerial": 46261,
    "revisadoras": "TATIANA-HEIDY-BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C MICKEY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1589,
    "cantBuena": 1099,
    "pegas": 57,
    "arreLaterales": 117,
    "pctLaterales": 0.0736312146003776,
    "arreCabeceras": 164,
    "pctCabeceras": 0.10320956576463185,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 17,
      "repise": 4,
      "faltaPintura": 9,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 2,
      "quemadas": 0,
      "totalEstampado": 32
    },
    "defectosTintoreria": {
      "manchaTintoreria": 1,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 1
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 26,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 27
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 86,
      "tundidoCaido": 4,
      "montadasCostura": 2,
      "totalCostura": 92
    },
    "rotas": 2,
    "totalTintoreria": 1,
    "totalTejeduria": 27,
    "totalCostura": 92,
    "totalSegundas": 152,
    "pctTotalSegundas": 0.09565764631843927,
    "pctEstampado": 0.020138451856513532
  },
  {
    "id": "seg-agosto-21",
    "fecha": "2026-08-28",
    "fechaSerial": 46262,
    "revisadoras": "BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SPIDERMAN",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 98,
    "cantBuena": 41,
    "pegas": 26,
    "arreLaterales": 3,
    "pctLaterales": 0.030612244897959183,
    "arreCabeceras": 28,
    "pctCabeceras": 0.2857142857142857,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 0
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 0
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 0,
      "totalCostura": 0
    },
    "rotas": 1,
    "totalTintoreria": 0,
    "totalTejeduria": 0,
    "totalCostura": 0,
    "totalSegundas": 1,
    "pctTotalSegundas": 0.01020408163265306,
    "pctEstampado": 0
  },
  {
    "id": "seg-agosto-22",
    "fecha": "2026-08-29",
    "fechaSerial": 46263,
    "revisadoras": "BLANCA-MAYULIS",
    "cliente": "",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "C MINNIE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 269,
    "cantBuena": 150,
    "pegas": 31,
    "arreLaterales": 23,
    "pctLaterales": 0.08550185873605948,
    "arreCabeceras": 33,
    "pctCabeceras": 0.12267657992565056,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 4,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 4,
      "totalEstampado": 8
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 4,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 5
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 12,
      "tundidoCaido": 0,
      "montadasCostura": 7,
      "totalCostura": 19
    },
    "rotas": 0,
    "totalTintoreria": 0,
    "totalTejeduria": 5,
    "totalCostura": 19,
    "totalSegundas": 32,
    "pctTotalSegundas": 0.11895910780669144,
    "pctEstampado": 0.02973977695167286
  }
];

export const OCTUBRE_SEGUNDAS_RECORDS: SegundasRecord[] = [
  {
    "id": "seg-octubre-1",
    "fecha": "2026-10-03",
    "revisadoras": "BLANCA-KELLY",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "CHASE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2393,
    "cantBuena": 1380,
    "pegas": 108,
    "arreLaterales": 180,
    "pctLaterales": 0.07522,
    "arreCabeceras": 183,
    "pctCabeceras": 0.076473,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 0,
      "repise": 2,
      "faltaPintura": 12,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 3,
      "totalEstampado": 17
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 24,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 24
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 490,
      "montadasCostura": 0,
      "totalCostura": 490
    },
    "rotas": 11,
    "totalTintoreria": 0,
    "totalTejeduria": 24,
    "totalCostura": 490,
    "totalSegundas": 542,
    "pctTotalSegundas": 0.226494,
    "pctEstampado": 0.007104
  },
  {
    "id": "seg-octubre-2",
    "fecha": "2026-10-05",
    "revisadoras": "BLANCA-MAYULIS-HEIDY-TATINA",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "ML1002",
    "dimensiones": "30*60-330",
    "diseno": "FRUTAS ANDU",
    "color": "EST",
    "tecnica": "PIGMENTO",
    "cantTotalRevisada": 6968,
    "cantBuena": 4645,
    "pegas": 351,
    "arreLaterales": 984,
    "pctLaterales": 0.141217,
    "arreCabeceras": 881,
    "pctCabeceras": 0.126435,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 15,
      "repise": 30,
      "faltaPintura": 1,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 46
    },
    "defectosTintoreria": {
      "manchaTintoreria": 48,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 5,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 53
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 0
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 2,
      "totalCostura": 2
    },
    "rotas": 6,
    "totalTintoreria": 53,
    "totalTejeduria": 0,
    "totalCostura": 2,
    "totalSegundas": 107,
    "pctTotalSegundas": 0.015356,
    "pctEstampado": 0.006602
  },
  {
    "id": "seg-octubre-3",
    "fecha": "2026-10-06",
    "revisadoras": "BLANCA MAYULIS HEIDY TATIANA",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "MICKEY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1075,
    "cantBuena": 903,
    "pegas": 45,
    "arreLaterales": 47,
    "pctLaterales": 0.043721,
    "arreCabeceras": 45,
    "pctCabeceras": 0.04186,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 9,
      "repise": 14,
      "faltaPintura": 3,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 26
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 2,
      "revienteTrama": 0,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 2
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 3,
      "tundidoCaido": 0,
      "montadasCostura": 4,
      "totalCostura": 7
    },
    "rotas": 0,
    "totalTintoreria": 0,
    "totalTejeduria": 2,
    "totalCostura": 7,
    "totalSegundas": 35,
    "pctTotalSegundas": 0.032558,
    "pctEstampado": 0.024186
  },
  {
    "id": "seg-octubre-4",
    "fecha": "2026-10-10",
    "revisadoras": "KAREN-KARELYS-CARMEN",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "HELLO KITTY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 903,
    "cantBuena": 816,
    "pegas": 0,
    "arreLaterales": 0,
    "pctLaterales": 0,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 14,
      "repise": 0,
      "faltaPintura": 0,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 14
    },
    "defectosTintoreria": {
      "manchaTintoreria": 21,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 21
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 23,
      "revienteTrama": 14,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 37
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 0,
      "montadasCostura": 14,
      "totalCostura": 14
    },
    "rotas": 1,
    "totalTintoreria": 21,
    "totalTejeduria": 37,
    "totalCostura": 14,
    "totalSegundas": 87,
    "pctTotalSegundas": 0.096346,
    "pctEstampado": 0.015504
  },
  {
    "id": "seg-octubre-5",
    "fecha": "2026-10-13",
    "revisadoras": "KAREN-KARELYS-CARMEN",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "HELLO KITTY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 945,
    "cantBuena": 688,
    "pegas": 0,
    "arreLaterales": 67,
    "pctLaterales": 0.070899,
    "arreCabeceras": 0,
    "pctCabeceras": 0,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 2,
      "repise": 0,
      "faltaPintura": 30,
      "logosCorridos": 11,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 43
    },
    "defectosTintoreria": {
      "manchaTintoreria": 2,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 2
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 3,
      "revienteTrama": 9,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 12
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 117,
      "tundidoCaido": 0,
      "montadasCostura": 16,
      "totalCostura": 133
    },
    "rotas": 0,
    "totalTintoreria": 2,
    "totalTejeduria": 12,
    "totalCostura": 133,
    "totalSegundas": 190,
    "pctTotalSegundas": 0.201058,
    "pctEstampado": 0.045503
  },
  {
    "id": "seg-octubre-6",
    "fecha": "2026-10-13",
    "revisadoras": "BLANCA-MAYULIS",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "SKYE",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2559,
    "cantBuena": 1802,
    "pegas": 119,
    "arreLaterales": 253,
    "pctLaterales": 0.098867,
    "arreCabeceras": 297,
    "pctCabeceras": 0.116061,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 4,
      "repise": 15,
      "faltaPintura": 1,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 20
    },
    "defectosTintoreria": {
      "manchaTintoreria": 11,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 11
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 2,
      "revienteTrama": 3,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 5
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 45,
      "tundidoCaido": 0,
      "montadasCostura": 3,
      "totalCostura": 48
    },
    "rotas": 4,
    "totalTintoreria": 11,
    "totalTejeduria": 5,
    "totalCostura": 48,
    "totalSegundas": 88,
    "pctTotalSegundas": 0.034388,
    "pctEstampado": 0.007816
  },
  {
    "id": "seg-octubre-7",
    "fecha": "2026-10-14",
    "revisadoras": "HEIDY-MAYULIS-BLANCA-TATIANA",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "GATA MERY",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 1253,
    "cantBuena": 719,
    "pegas": 45,
    "arreLaterales": 252,
    "pctLaterales": 0.201117,
    "arreCabeceras": 213,
    "pctCabeceras": 0.169992,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 2,
      "repise": 3,
      "faltaPintura": 9,
      "logosCorridos": 0,
      "penetracion": 0,
      "grasa": 0,
      "descases": 0,
      "quemadas": 0,
      "totalEstampado": 14
    },
    "defectosTintoreria": {
      "manchaTintoreria": 0,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 0
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 0,
      "revienteTrama": 5,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 5
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 4,
      "montadasCostura": 0,
      "totalCostura": 4
    },
    "rotas": 1,
    "totalTintoreria": 0,
    "totalTejeduria": 5,
    "totalCostura": 4,
    "totalSegundas": 24,
    "pctTotalSegundas": 0.019154,
    "pctEstampado": 0.011173
  },
  {
    "id": "seg-octubre-8",
    "fecha": "2026-10-14",
    "revisadoras": "BLANCA-TATIANA -HEIDY",
    "cliente": "LINEA",
    "pedidoLinea": "",
    "referencia": "C280T",
    "dimensiones": "60*120-280",
    "diseno": "STITCH NIÑA",
    "color": "EST",
    "tecnica": "REACTIVO",
    "cantTotalRevisada": 2329,
    "cantBuena": 1705,
    "pegas": 44,
    "arreLaterales": 108,
    "pctLaterales": 0.046372,
    "arreCabeceras": 112,
    "pctCabeceras": 0.048089,
    "observaciones": "",
    "defectosEstampado": {
      "manchas": 19,
      "repise": 36,
      "faltaPintura": 5,
      "logosCorridos": 1,
      "penetracion": 0,
      "grasa": 0,
      "descases": 1,
      "quemadas": 0,
      "totalEstampado": 62
    },
    "defectosTintoreria": {
      "manchaTintoreria": 2,
      "manchaOxido": 0,
      "arrastreBarca": 0,
      "sucias": 0,
      "vetas": 0,
      "medida": 0,
      "rama": 0,
      "grasa": 0,
      "totalTintoreria": 2
    },
    "defectosTejeduria": {
      "revienteUrdimbre": 1,
      "revienteTrama": 41,
      "marra": 0,
      "rayas": 0,
      "variacionesRizo": 0,
      "hiloContaminado": 0,
      "orillosLaterales": 0,
      "totalTejeduria": 42
    },
    "defectosCostura": {
      "enganches": 0,
      "manchasNegras": 0,
      "tundidoCaido": 241,
      "montadasCostura": 0,
      "totalCostura": 241
    },
    "rotas": 13,
    "totalTintoreria": 2,
    "totalTejeduria": 42,
    "totalCostura": 241,
    "totalSegundas": 360,
    "pctTotalSegundas": 0.154573,
    "pctEstampado": 0.026621
  }
];

export interface SegundasExcelColumns {
  fecha: number;
  revisadoras: number;
  cliente: number;
  pedidoLinea: number;
  referencia: number;
  dimensiones: number;
  diseno: number;
  color: number;
  cantTotal: number;
  cantBuena: number;
  pegas: number;
  arreLat: number;
  pctLat: number;
  arreCab: number;
  pctCab: number;
  observaciones: number;

  // Estampado (8)
  manchas: number;
  repise: number;
  faltaPintura: number;
  logosCorridos: number;
  penetracion: number;
  grasaEst: number;
  descases: number;
  quemadas: number;

  // Tintorería (8)
  manchaTint: number;
  manchaOxido: number;
  arrastreBarca: number;
  sucias: number;
  vetas: number;
  medida: number;
  rama: number;
  grasaTint: number;

  // Tejeduría (7)
  revUrdimbre: number;
  revTrama: number;
  marra: number;
  rayas: number;
  variacionesRizo: number;
  hiloContaminado: number;
  orillosLaterales: number;

  // Costura (4)
  enganches: number;
  manchasNegras: number;
  tundidoCaido: number;
  montadasCostura: number;

  // Rotas (1)
  rotas: number;

  // Total Unds R2 / RZ
  totalSegundas: number;
}

export function detectSegundasExcelColumns(headers0: any[], headers1: any[]): SegundasExcelColumns {
  const combinedHeaders: { col: number; section: string; h0: string; h1: string; full: string }[] = [];
  const maxCols = Math.max((headers0 || []).length, (headers1 || []).length, 55);

  let currentSection = '';
  for (let c = 0; c < maxCols; c++) {
    const h0 = String(headers0?.[c] || '').trim().toUpperCase();
    const h1 = String(headers1?.[c] || '').trim().toUpperCase();
    
    if (h0.includes('ESTAMPADO')) currentSection = 'ESTAMPADO';
    else if (h0.includes('TINTORERIA') || h0.includes('TINTORER')) currentSection = 'TINTORERIA';
    else if (h0.includes('TEJEDURIA') || h0.includes('TEJEDUR')) currentSection = 'TEJEDURIA';
    else if (h0.includes('COSTURA') || h0.includes('ENGANCHE') || h0.includes('TUNDIDO') || h0.includes('CONFECCION')) currentSection = 'COSTURA';
    
    combinedHeaders.push({
      col: c,
      section: currentSection,
      h0,
      h1,
      full: `${h0} ${h1}`.trim()
    });
  }

  const findCol = (predicate: (item: { col: number; section: string; h0: string; h1: string; full: string }) => boolean, fallbackCol: number) => {
    const found = combinedHeaders.find(predicate);
    return found !== undefined ? found.col : fallbackCol;
  };

  return {
    fecha: findCol(c => c.h0.includes('FECHA') || c.h1.includes('FECHA'), 0),
    revisadoras: findCol(c => c.h0.includes('REVISADORA') || c.h1.includes('REVISADORA'), 1),
    cliente: findCol(c => c.h0.includes('CLIENTE') || c.h1.includes('CLIENTE'), 2),
    pedidoLinea: findCol(c => (c.h0.includes('PEDIDO') || c.h0.includes('LINEA') || c.h1.includes('PEDIDO')) && !c.full.includes('CANT'), 3),
    referencia: findCol(c => (c.h0.includes('REFERENCIA') || c.h1.includes('REFERENCIA')) && !c.full.includes('TALLER') && !c.full.includes('DISEÑO'), 4),
    dimensiones: findCol(c => c.h0.includes('DIMEN') || c.h1.includes('DIMEN'), 5),
    diseno: findCol(c => c.h0.includes('DISEÑO') || c.h0.includes('LOGO HOTELERO') || c.h1.includes('DISEÑO'), 6),
    color: findCol(c => (c.h0 === 'COLOR' || c.h1 === 'COLOR') && !c.full.includes('TINT'), 7),
    cantTotal: findCol(c => c.full.includes('TOTAL REVISADA') || (c.full.includes('REVISADA') && !c.full.includes('BUENA')), 8),
    cantBuena: findCol(c => c.full.includes('BUENA') || c.full.includes('1ª CALIDAD') || c.full.includes('PRIMERA'), 9),
    pegas: findCol(c => c.full.includes('PEGA'), 10),
    arreLat: findCol(c => c.full.includes('LATERAL'), 11),
    pctLat: findCol(c => c.col === 12 || (c.col > 11 && c.full === '%'), 12),
    arreCab: findCol(c => c.full.includes('CABECERA'), 13),
    pctCab: findCol(c => c.col === 14 || (c.col > 13 && c.full === '%'), 14),
    observaciones: findCol(c => c.full.includes('OBSERVACION'), 15),

    // Estampado (8)
    manchas: findCol(c => (c.section === 'ESTAMPADO' || (c.col >= 16 && c.col < 24)) && c.full.includes('MANCHA') && !c.full.includes('NEGRA') && !c.full.includes('TINT') && !c.full.includes('OXIDO'), 16),
    repise: findCol(c => c.full.includes('REPISE'), 17),
    faltaPintura: findCol(c => c.full.includes('FALTA') || c.full.includes('PINTURA'), 18),
    logosCorridos: findCol(c => (c.col >= 16 && c.col < 24) && (c.full.includes('LOGO') || c.full.includes('CORRIDO')), 19),
    penetracion: findCol(c => c.full.includes('PENETRA'), 20),
    grasaEst: findCol(c => (c.section === 'ESTAMPADO' || (c.col >= 16 && c.col < 24)) && c.full.includes('GRASA'), 21),
    descases: findCol(c => c.full.includes('DESCASE'), 22),
    quemadas: findCol(c => c.full.includes('QUEMADA'), 23),

    // Tintorería (8)
    manchaTint: findCol(c => c.full.includes('MANCHA TINT') || (c.section === 'TINTORERIA' && c.full.includes('MANCHA') && !c.full.includes('OXIDO') && !c.full.includes('OCIDO')), 24),
    manchaOxido: findCol(c => c.full.includes('OXIDO') || c.full.includes('OCIDO'), 25),
    arrastreBarca: findCol(c => c.full.includes('BARCA') || c.full.includes('ARRASTRE') || c.full.includes('ARASATRE'), 26),
    sucias: findCol(c => c.full.includes('SUCIA'), 27),
    vetas: findCol(c => c.full.includes('VETA'), 28),
    medida: findCol(c => c.full.includes('MEDIDA'), 29),
    rama: findCol(c => c.full.includes('RAMA'), 30),
    grasaTint: findCol(c => (c.section === 'TINTORERIA' || (c.col >= 24 && c.col < 32)) && c.full.includes('GRASA'), 31),

    // Tejeduría (7)
    revUrdimbre: findCol(c => c.full.includes('URDIMBRE'), 32),
    revTrama: findCol(c => c.full.includes('TRAMA'), 33),
    marra: findCol(c => c.full.includes('MARRA'), 34),
    rayas: findCol(c => c.full.includes('RAYA'), 35),
    variacionesRizo: findCol(c => c.full.includes('RIZO') || c.full.includes('VARIACION'), 36),
    hiloContaminado: findCol(c => c.full.includes('HILO') || c.full.includes('CONTAMINADO'), 37),
    orillosLaterales: findCol(c => c.full.includes('ORILLO'), 38),

    // Costura (4)
    enganches: findCol(c => c.full.includes('ENGANCHE'), 39),
    manchasNegras: findCol(c => c.full.includes('MANCHAS NEGRA') || c.full.includes('MANCHA NEGRA') || (c.section === 'COSTURA' && c.full.includes('NEGRA')), 40),
    tundidoCaido: findCol(c => c.full.includes('TUNDIDO'), 41),
    montadasCostura: findCol(c => c.full.includes('MONTADA') || (c.section === 'COSTURA' && c.full.includes('COSTURA')), 42),

    // Rotas (1)
    rotas: findCol(c => (c.full.includes('ROTA') || c.full.includes('ROTAS')) && !c.full.includes('%') && !c.full.includes('TOTAL'), 43),

    // Total Unds R2 / RZ
    totalSegundas: findCol(c => c.full.includes('TOTAL UNDS') || c.full.includes('TOTAL RZ') || c.full.includes('TOTAL R2') || (c.full.includes('TOTAL') && c.full.includes('SEG')), 44)
  };
}

const LOCAL_STORAGE_KEY = 'contex_segundas_records_v5';

export function loadSegundasRecords(): SegundasRecord[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem('contex_segundas_records_v4');
    if (saved) {
      let parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Asegurar que si faltan registros de Julio (31 lotes), Agosto (22 lotes), Septiembre (19 lotes) u Octubre (8 lotes), se integren
        const hasJuly = parsed.some((r: any) => r.fecha && String(r.fecha).startsWith('2026-07'));
        const hasAugust = parsed.some((r: any) => r.fecha && String(r.fecha).startsWith('2026-08'));
        const hasSeptember = parsed.some((r: any) => r.fecha && String(r.fecha).startsWith('2026-09'));
        const hasOctober = parsed.some((r: any) => r.fecha && String(r.fecha).startsWith('2026-10'));

        if (!hasJuly) {
          const julyRecords = INITIAL_SEGUNDAS_RECORDS.filter(r => r.fecha && r.fecha.startsWith('2026-07'));
          parsed = [...parsed, ...julyRecords];
        }
        if (!hasAugust) {
          const augRecords = INITIAL_SEGUNDAS_RECORDS.filter(r => r.fecha && r.fecha.startsWith('2026-08'));
          parsed = [...parsed, ...augRecords];
        }
        if (!hasSeptember) {
          parsed = [...parsed, ...SEPTIEMBRE_SEGUNDAS_RECORDS];
        }
        if (!hasOctober) {
          parsed = [...parsed, ...OCTUBRE_SEGUNDAS_RECORDS];
        }

        // AUTO-UPGRADE: Si existen registros de Octubre 2026 pero tienen defectos de tintorería y tejeduría en 0 debido al parser anterior,
        // actualizarlos automáticamente con los datos completos auditados.
        parsed = parsed.map((r: any) => {
          if (r.fecha && String(r.fecha).startsWith('2026-10')) {
            const rev = Number(r.cantTotalRevisada) || 0;
            const totTint = Number(r.defectosTintoreria?.totalTintoreria) || Number(r.totalTintoreria) || 0;
            const totTej = Number(r.defectosTejeduria?.totalTejeduria) || Number(r.totalTejeduria) || 0;
            const totCost = Number(r.defectosCostura?.totalCostura) || Number(r.totalCostura) || 0;
            if (totTint === 0 && totTej === 0 && totCost === 0) {
              const match = OCTUBRE_SEGUNDAS_RECORDS.find(oct => 
                oct.fecha === r.fecha && 
                oct.diseno.toUpperCase() === (r.diseno || '').toUpperCase() && 
                oct.cantTotalRevisada === rev
              );
              if (match) {
                return { ...r, ...match, id: r.id || match.id };
              }
            }
          }
          return r;
        });

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
  return [...INITIAL_SEGUNDAS_RECORDS, ...SEPTIEMBRE_SEGUNDAS_RECORDS, ...OCTUBRE_SEGUNDAS_RECORDS];
}

export function saveSegundasRecords(records: SegundasRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Error saving segundas records to localStorage:', err);
  }
}

export const SEGUNDAS_COLLECTION = 'segundas_records';

function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

/**
 * Guarda o actualiza un lote de registros de segundas en Cloud Firestore (en bloques de hasta 400).
 */
export async function saveSegundasRecordsToCloud(records: SegundasRecord[]): Promise<boolean> {
  if (!records || records.length === 0) return true;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const rec of chunk) {
        const id = (rec.id || `seg-${rec.fecha || 'sindata'}-${Math.random().toString(36).slice(2, 7)}`).replace(/\//g, '_');
        const docRef = doc(db, SEGUNDAS_COLLECTION, id);
        batch.set(docRef, sanitizeForFirestore({ ...rec, id }), { merge: true });
      }
      await batch.commit();
    }
    return true;
  } catch (error) {
    console.warn('Error guardando registros de segundas en Firestore:', error);
    return false;
  }
}

/**
 * Elimina un registro de segundas de Cloud Firestore por su ID.
 */
export async function deleteSegundasRecordCloud(recordId: string): Promise<boolean> {
  if (!recordId) return true;
  try {
    const cleanId = recordId.replace(/\//g, '_');
    await deleteDoc(doc(db, SEGUNDAS_COLLECTION, cleanId));
    return true;
  } catch (error) {
    console.warn('Error eliminando registro en Firestore:', error);
    return false;
  }
}

/**
 * Restablece los registros en Cloud Firestore al conjunto maestro oficial.
 */
export async function resetSegundasRecordsCloud(masterRecords: SegundasRecord[]): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, SEGUNDAS_COLLECTION));
    const masterIds = new Set(masterRecords.map(m => m.id));
    
    // Eliminar documentos que no pertenezcan al maestro
    const toDelete = snap.docs.filter(d => !masterIds.has(d.id));
    for (let i = 0; i < toDelete.length; i += 400) {
      const chunk = toDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    
    return await saveSegundasRecordsToCloud(masterRecords);
  } catch (error) {
    console.warn('Error restableciendo registros en Firestore:', error);
    return false;
  }
}

/**
 * Suscripción en tiempo real a la colección segundas_records de Firestore.
 * Sincroniza automáticamente entre Vercel, localhost y cualquier dispositivo.
 * Si la colección está vacía en la nube, la inicializa con el histórico acumulado.
 */
export function subscribeToSegundasRecords(
  onUpdate: (records: SegundasRecord[]) => void
): () => void {
  try {
    const colRef = collection(db, SEGUNDAS_COLLECTION);
    let isSeeding = false;

    const unsubscribe = onSnapshot(colRef, async (snapshot) => {
      if (snapshot.empty && !isSeeding) {
        isSeeding = true;
        console.log('[Firestore] Colección segundas_records vacía. Sembrando histórico completo...');
        
        // Histórico base con Julio, Agosto, Septiembre y Octubre completos
        const baseMaster = [
          ...INITIAL_SEGUNDAS_RECORDS, 
          ...SEPTIEMBRE_SEGUNDAS_RECORDS, 
          ...OCTUBRE_SEGUNDAS_RECORDS
        ];
        
        // Integrar registros locales únicos si el usuario tenía datos previos
        const local = loadSegundasRecords();
        const recordsToSeed = [...baseMaster];
        if (Array.isArray(local) && local.length > 0) {
          local.forEach(loc => {
            const exists = recordsToSeed.some(b => 
              (loc.id && b.id === loc.id) || 
              (b.fecha === loc.fecha && (b.diseno || '').toUpperCase() === (loc.diseno || '').toUpperCase() && b.cantTotalRevisada === loc.cantTotalRevisada)
            );
            if (!exists) {
              recordsToSeed.push(loc);
            }
          });
        }

        try {
          await saveSegundasRecordsToCloud(recordsToSeed);
          console.log(`[Firestore] Histórico sembrado con éxito en la nube (${recordsToSeed.length} lotes).`);
        } catch (seedErr) {
          console.warn('[Firestore] Error al sembrar segundas_records en la nube:', seedErr);
        } finally {
          isSeeding = false;
        }
        return;
      }

      if (!snapshot.empty) {
        const cloudRecords = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as SegundasRecord[];

        // Ordenar por fecha descendente
        cloudRecords.sort((a, b) => {
          const fa = a.fecha || '';
          const fb = b.fecha || '';
          if (fa !== fb) return fb.localeCompare(fa);
          return (b.cantTotalRevisada || 0) - (a.cantTotalRevisada || 0);
        });

        // Respaldar en localStorage para disponibilidad offline inmediata
        saveSegundasRecords(cloudRecords);
        onUpdate(cloudRecords);
      }
    }, (error) => {
      console.warn('[Firestore] Aviso en listener tiempo real segundas_records (usando respaldo local):', error);
      onUpdate(loadSegundasRecords());
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[Firestore] No se pudo inicializar listener de segundas_records:', err);
    onUpdate(loadSegundasRecords());
    return () => {};
  }
}

