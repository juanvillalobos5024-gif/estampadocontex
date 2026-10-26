import React, { useState, useMemo } from 'react';
import {
  X, FileText, Calendar, BarChart3, CheckSquare, Square, Check,
  Download, Layers, AlertTriangle, ArrowUpDown, Clock, Filter,
  TrendingDown, TrendingUp, Sparkles, PieChart, GitCompare,
  SlidersHorizontal, CheckCircle2, Factory, ChevronRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SegundasRecord } from '../types';
import { inferTecnica } from '../lib/segundasData';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const fmtInt = (n: number) => Math.round(n || 0).toLocaleString('es-CO');
const fmtPct = (n: number, d = 2) => `${((n || 0) * 100).toFixed(d)}%`;

function normalizeDate(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    const utcDays = Math.round(val - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const clean = s.split('T')[0];
  const parts = clean.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

export type ReportPeriodType = 'month' | 'mom' | 'year' | 'range' | 'all';

interface SegundasReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SegundasRecord[];
  currentMonth: number;
  currentYear: number;
  currentTimeFilter: 'all' | 'month' | 'year' | 'range';
  currentStartDate: string;
  currentEndDate: string;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const SegundasReportModal: React.FC<SegundasReportModalProps> = ({
  isOpen,
  onClose,
  records,
  currentMonth,
  currentYear,
  currentTimeFilter,
  currentStartDate,
  currentEndDate,
  showToast
}) => {
  // ── ESTADO DEL PERÍODO DEL INFORME ──
  const [periodType, setPeriodType] = useState<ReportPeriodType>(() => {
    if (currentTimeFilter === 'range') return 'range';
    if (currentTimeFilter === 'year') return 'year';
    if (currentTimeFilter === 'all') return 'all';
    return 'month';
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Para comparativa MoM: mes anterior a comparar
  const [compareMonth, setCompareMonth] = useState<number>(() => {
    return currentMonth === 0 ? 11 : currentMonth - 1;
  });
  const [compareYear, setCompareYear] = useState<number>(() => {
    return currentMonth === 0 ? currentYear - 1 : currentYear;
  });

  const [startDate, setStartDate] = useState<string>(currentStartDate || `${currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(currentEndDate || `${currentYear}-12-31`);

  // Filtros opcionales de alcance
  const [tecnicaFilter, setTecnicaFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');
  const [referenciaFilter, setReferenciaFilter] = useState<string>('all');

  // ── SELECCIÓN DE GRÁFICAS Y SECCIONES A ADJUNTAR ──
  const [includeKpiCards, setIncludeKpiCards] = useState<boolean>(true);
  const [includeMoM, setIncludeMoM] = useState<boolean>(periodType === 'mom');
  const [includeTrendChart, setIncludeTrendChart] = useState<boolean>(true);
  const [includeProcessChart, setIncludeProcessChart] = useState<boolean>(true);
  const [includeTecnicaChart, setIncludeTecnicaChart] = useState<boolean>(true);
  const [includeTopDesigns, setIncludeTopDesigns] = useState<boolean>(true);
  const [topDesignsLimit, setTopDesignsLimit] = useState<number>(8);
  const [includeDefectsChart, setIncludeDefectsChart] = useState<boolean>(true);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Años únicos presentes en la base de datos
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    records.forEach(r => {
      const d = normalizeDate(r.fecha);
      const parts = d.split('-');
      if (parts.length >= 1) {
        const y = parseInt(parts[0], 10);
        if (!isNaN(y) && y > 2000) set.add(y);
      }
    });
    if (set.size === 0) set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);

  // Referencias únicas
  const availableRefs = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.referencia) set.add(r.referencia.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [records]);

  // Si cambia el período a 'mom', activamos automáticamente la sección MoM
  const handlePeriodChange = (type: ReportPeriodType) => {
    setPeriodType(type);
    if (type === 'mom') {
      setIncludeMoM(true);
    }
  };

  // Función de filtrado genérica para cualquier periodo
  const filterRecords = (
    recs: SegundasRecord[],
    pType: ReportPeriodType,
    m: number,
    y: number,
    sDate: string,
    eDate: string
  ) => {
    return recs.filter(r => {
      const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);
      if (tecnicaFilter !== 'all' && tec !== tecnicaFilter) return false;
      if (referenciaFilter !== 'all' && (r.referencia || '').trim().toUpperCase() !== referenciaFilter.toUpperCase()) return false;

      if (pType === 'all') return true;
      if (!r.fecha) return false;
      const normalized = normalizeDate(r.fecha);

      if (pType === 'range') {
        if (sDate && normalized < sDate) return false;
        if (eDate && normalized > eDate) return false;
        return true;
      }

      const parts = normalized.split('-');
      if (parts.length < 2) return false;
      const recY = parseInt(parts[0], 10);
      const recM = parseInt(parts[1], 10) - 1;

      if (pType === 'year') {
        return recY === y;
      }
      if (pType === 'month' || pType === 'mom') {
        return recY === y && recM === m;
      }
      return true;
    });
  };

  // Registros del período principal evaluado
  const currentFilteredRecords = useMemo(() => {
    return filterRecords(records, periodType, selectedMonth, selectedYear, startDate, endDate);
  }, [records, periodType, selectedMonth, selectedYear, startDate, endDate, tecnicaFilter, referenciaFilter]);

  // Registros del período de comparación (si aplica MoM)
  const compareFilteredRecords = useMemo(() => {
    if (periodType !== 'mom') return [];
    return filterRecords(records, 'month', compareMonth, compareYear, '', '');
  }, [records, periodType, compareMonth, compareYear, tecnicaFilter, referenciaFilter]);

  // Helper para computar KPIs de un conjunto de registros
  const computeStats = (recs: SegundasRecord[]) => {
    let revisada = 0;
    let buena = 0;
    let segundas = 0;
    let pegas = 0;
    let arreCabeceras = 0;
    let arreLaterales = 0;
    let estampado = 0;
    let tintoreria = 0;
    let tejeduria = 0;
    let costura = 0;
    let rotas = 0;

    let reactivoRev = 0;
    let reactivoSeg = 0;
    let pigmentoRev = 0;
    let pigmentoSeg = 0;

    const defectsMap: Record<string, number> = {
      manchas: 0,
      repise: 0,
      faltaPintura: 0,
      logosCorridos: 0,
      penetracion: 0,
      grasa: 0,
      descases: 0,
      quemadas: 0
    };

    recs.forEach(r => {
      const rev = r.cantTotalRevisada || 0;
      revisada += rev;
      buena += r.cantBuena || 0;
      segundas += r.totalSegundas || 0;
      pegas += r.pegas || 0;
      arreCabeceras += r.arreCabeceras || 0;
      arreLaterales += r.arreLaterales || 0;

      const est = r.defectosEstampado?.totalEstampado || 0;
      estampado += est;
      tintoreria += (r.defectosTintoreria?.totalTintoreria ?? r.totalTintoreria ?? 0);
      tejeduria += (r.defectosTejeduria?.totalTejeduria ?? r.totalTejeduria ?? 0);
      costura += (r.defectosCostura?.totalCostura ?? r.totalCostura ?? 0);
      rotas += (r.rotas || 0);

      const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);
      if (tec === 'PIGMENTO') {
        pigmentoRev += rev;
        pigmentoSeg += (r.totalSegundas || 0);
      } else {
        reactivoRev += rev;
        reactivoSeg += (r.totalSegundas || 0);
      }

      if (r.defectosEstampado) {
        defectsMap.manchas += r.defectosEstampado.manchas || 0;
        defectsMap.repise += r.defectosEstampado.repise || 0;
        defectsMap.faltaPintura += r.defectosEstampado.faltaPintura || 0;
        defectsMap.logosCorridos += r.defectosEstampado.logosCorridos || 0;
        defectsMap.penetracion += r.defectosEstampado.penetracion || 0;
        defectsMap.grasa += r.defectosEstampado.grasa || 0;
        defectsMap.descases += r.defectosEstampado.descases || 0;
        defectsMap.quemadas += r.defectosEstampado.quemadas || 0;
      }
    });

    const safeRev = revisada || 1;
    return {
      revisada,
      buena,
      segundas,
      pegas,
      arreCabeceras,
      arreLaterales,
      arreglosTotal: arreCabeceras + arreLaterales,
      estampado,
      tintoreria,
      tejeduria,
      costura,
      rotas,
      pctBuena: buena / safeRev,
      pctSegundas: segundas / safeRev,
      pctPegas: pegas / safeRev,
      pctCabeceras: arreCabeceras / safeRev,
      pctLaterales: arreLaterales / safeRev,
      pctArreglos: (arreCabeceras + arreLaterales) / safeRev,
      pctEstampado: estampado / safeRev,
      pctTintoreria: tintoreria / safeRev,
      pctTejeduria: tejeduria / safeRev,
      reactivoRev,
      reactivoSeg,
      pctReactivoSeg: reactivoRev > 0 ? reactivoSeg / reactivoRev : 0,
      pigmentoRev,
      pigmentoSeg,
      pctPigmentoSeg: pigmentoRev > 0 ? pigmentoSeg / pigmentoRev : 0,
      defectsMap,
      lotes: recs.length
    };
  };

  // Top diseños para el período evaluado
  const topDesigns = useMemo(() => {
    const map = new Map<string, {
      name: string;
      process: 'REACTIVO' | 'PIGMENTO';
      referencia: string;
      totalSegundas: number;
      totalRevisadas: number;
      buenas: number;
      pctSegundas: number;
      topDefecto: string;
      topDefectoCant: number;
    }>();

    currentFilteredRecords.forEach(r => {
      const name = (r.diseno || 'SIN DISEÑO').trim().toUpperCase();
      const existing = map.get(name) || {
        name,
        process: (r.tecnica || inferTecnica(r.diseno, r.referencia)) as 'REACTIVO' | 'PIGMENTO',
        referencia: r.referencia || '',
        totalSegundas: 0,
        totalRevisadas: 0,
        buenas: 0,
        pctSegundas: 0,
        topDefecto: '',
        topDefectoCant: 0
      };

      existing.totalSegundas += r.totalSegundas || 0;
      existing.totalRevisadas += r.cantTotalRevisada || 0;
      existing.buenas += r.cantBuena || 0;

      if (r.defectosEstampado) {
        const defects = [
          { name: 'Manchas', val: r.defectosEstampado.manchas || 0 },
          { name: 'Repise', val: r.defectosEstampado.repise || 0 },
          { name: 'Falta Pintura', val: r.defectosEstampado.faltaPintura || 0 },
          { name: 'Logos Corridos', val: r.defectosEstampado.logosCorridos || 0 },
          { name: 'Penetración', val: r.defectosEstampado.penetracion || 0 },
          { name: 'Grasa', val: r.defectosEstampado.grasa || 0 },
          { name: 'Descases', val: r.defectosEstampado.descases || 0 },
          { name: 'Quemadas', val: r.defectosEstampado.quemadas || 0 },
        ];
        defects.forEach(d => {
          if (d.val > existing.topDefectoCant) {
            existing.topDefecto = d.name;
            existing.topDefectoCant = d.val;
          }
        });
      }
      map.set(name, existing);
    });

    const list = Array.from(map.values()).map(d => ({
      ...d,
      pctSegundas: d.totalRevisadas > 0 ? Number(((d.totalSegundas / d.totalRevisadas) * 100).toFixed(2)) : 0
    }));

    return list.sort((a, b) => b.totalSegundas - a.totalSegundas);
  }, [currentFilteredRecords]);

  // Tendencia cronológica para el gráfico
  const timelineData = useMemo(() => {
    const map = new Map<string, { label: string; revisadas: number; segundas: number; buenas: number }>();

    currentFilteredRecords.forEach(r => {
      const norm = normalizeDate(r.fecha);
      if (!norm) return;
      let key = norm;
      let label = norm;

      if (periodType === 'year' || periodType === 'all') {
        const parts = norm.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10) - 1;
          key = `${parts[0]}-${parts[1]}`;
          label = MONTH_NAMES[m]?.slice(0, 3) || parts[1];
        }
      } else {
        const parts = norm.split('-');
        if (parts.length === 3) {
          label = `${parts[2]}/${parts[1]}`;
        }
      }

      const existing = map.get(key) || { label, revisadas: 0, segundas: 0, buenas: 0 };
      existing.revisadas += r.cantTotalRevisada || 0;
      existing.segundas += r.totalSegundas || 0;
      existing.buenas += r.cantBuena || 0;
      map.set(key, existing);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(e => e[1])
      .slice(-15); // Máximo 15 puntos para que el gráfico sea muy claro
  }, [currentFilteredRecords, periodType]);

  const currentStats = useMemo(() => computeStats(currentFilteredRecords), [currentFilteredRecords]);
  const compareStats = useMemo(() => computeStats(compareFilteredRecords), [compareFilteredRecords]);

  // Texto legible del período seleccionado
  const periodLabel = useMemo(() => {
    if (periodType === 'month') return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    if (periodType === 'mom') return `Comparativa MoM: ${MONTH_NAMES[selectedMonth]} ${selectedYear} vs ${MONTH_NAMES[compareMonth]} ${compareYear}`;
    if (periodType === 'year') return `Año Completo ${selectedYear}`;
    if (periodType === 'range') return `${startDate} al ${endDate}`;
    return 'Histórico Completo';
  }, [periodType, selectedMonth, selectedYear, compareMonth, compareYear, startDate, endDate]);

  // Controles rápidos de preset
  const setAllSections = (val: boolean) => {
    setIncludeKpiCards(val);
    setIncludeMoM(val);
    setIncludeTrendChart(val);
    setIncludeProcessChart(val);
    setIncludeTecnicaChart(val);
    setIncludeTopDesigns(val);
    setIncludeDefectsChart(val);
    setIncludeSignatures(val);
  };

  const applyExecutivePreset = () => {
    setIncludeKpiCards(true);
    setIncludeMoM(periodType === 'mom');
    setIncludeTrendChart(false);
    setIncludeProcessChart(true);
    setIncludeTecnicaChart(false);
    setIncludeTopDesigns(true);
    setTopDesignsLimit(8);
    setIncludeDefectsChart(false);
    setIncludeSignatures(true);
  };

  const applyChartsOnlyPreset = () => {
    setIncludeKpiCards(true);
    setIncludeMoM(true);
    setIncludeTrendChart(true);
    setIncludeProcessChart(true);
    setIncludeTecnicaChart(true);
    setIncludeTopDesigns(true);
    setIncludeDefectsChart(true);
    setIncludeSignatures(false);
  };

  // ════════════════════════════════════════════════════════════════
  // ── GENERACIÓN DEL DOCUMENTO PDF ULTRA-PROFESIONAL ──
  // ════════════════════════════════════════════════════════════════
  const handleGeneratePDF = () => {
    if (currentFilteredRecords.length === 0) {
      showToast('warning', 'Sin datos', 'No hay registros en el período seleccionado para generar el informe.');
      return;
    }

    setIsGenerating(true);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let currentY = 12;

      const now = new Date();
      const emissionDate = now.toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      // Función para verificar salto de página
      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - 16) {
          doc.addPage();
          currentY = 16;
          return true;
        }
        return false;
      };

      // 1. Cabecera Corporativa
      doc.setFillColor(15, 23, 42); // slate-900
      doc.roundedRect(margin, currentY, contentWidth, 25, 3, 3, 'F');

      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12.5);
      doc.setFont('helvetica', 'bold');
      doc.text('CONTEX S.A.S. — CONTROL DE CALIDAD Y SEGUNDAS TEXTILES', margin + 6, currentY + 9);

      // Subtítulo con período y emisión
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`Período: ${periodLabel}   |   Lotes: ${currentStats.lotes} evaluados   |   Emisión: ${emissionDate}`, margin + 6, currentY + 16);

      // Filtro secundario si aplica
      let subFiltro = '';
      if (tecnicaFilter !== 'all') subFiltro += `Técnica: ${tecnicaFilter}   `;
      if (referenciaFilter !== 'all') subFiltro += `Tela: ${referenciaFilter}   `;
      if (subFiltro) {
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Filtros de alcance: ${subFiltro}`, margin + 6, currentY + 22);
      }

      currentY += 31;

      // ── 2. SECCIÓN: TARJETAS KPI EJECUTIVAS ──
      if (includeKpiCards) {
        checkPageBreak(28);
        const cardW = (contentWidth - 7.5) / 4;
        const cardH = 21;

        // KPI 1: Total Revisadas
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, cardW, cardH, 2, 2, 'FD');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('TOTAL REVISADAS', margin + 3.5, currentY + 5.5);
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(fmtInt(currentStats.revisada), margin + 3.5, currentY + 12.5);
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`100% Volumen (${currentStats.lotes} lotes)`, margin + 3.5, currentY + 17.5);

        // KPI 2: 1ª Calidad (Buenas)
        const x2 = margin + cardW + 2.5;
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(x2, currentY, cardW, cardH, 2, 2, 'FD');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text('1ª CALIDAD (BUENAS)', x2 + 3.5, currentY + 5.5);
        doc.setFontSize(11);
        doc.setTextColor(6, 95, 70);
        doc.text(`${fmtInt(currentStats.buena)} (${fmtPct(currentStats.pctBuena)})`, x2 + 3.5, currentY + 12.5);
        doc.setFontSize(6.5);
        doc.setTextColor(16, 185, 129);
        doc.text('Rendimiento Conforme', x2 + 3.5, currentY + 17.5);

        // KPI 3: Total Segundas
        const x3 = x2 + cardW + 2.5;
        const isSegHigh = currentStats.pctSegundas >= 0.08;
        const isSegMed = currentStats.pctSegundas >= 0.04 && !isSegHigh;
        doc.setFillColor(isSegHigh ? 255 : isSegMed ? 254 : 240, isSegHigh ? 241 : isSegMed ? 243 : 253, isSegHigh ? 242 : isSegMed ? 199 : 244);
        doc.setDrawColor(isSegHigh ? 253 : isSegMed ? 251 : 167, isSegHigh ? 164 : isSegMed ? 191 : 243, isSegHigh ? 175 : isSegMed ? 36 : 208);
        doc.roundedRect(x3, currentY, cardW, cardH, 2, 2, 'FD');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isSegHigh ? 190 : isSegMed ? 180 : 5, isSegHigh ? 18 : isSegMed ? 83 : 150, isSegHigh ? 60 : isSegMed ? 9 : 105);
        doc.text('TOTAL SEGUNDAS', x3 + 3.5, currentY + 5.5);
        doc.setFontSize(11);
        doc.text(`${fmtInt(currentStats.segundas)} (${fmtPct(currentStats.pctSegundas)})`, x3 + 3.5, currentY + 12.5);
        doc.setFontSize(6.5);
        doc.text(isSegHigh ? 'ALERTA: Supera meta 8%' : isSegMed ? 'Precaución en taller' : 'Dentro de meta (<4%)', x3 + 3.5, currentY + 17.5);

        // KPI 4: Arreglos y Pegas
        const x4 = x3 + cardW + 2.5;
        const totalArrPeg = currentStats.arreglosTotal + currentStats.pegas;
        doc.setFillColor(240, 249, 255);
        doc.setDrawColor(186, 230, 253);
        doc.roundedRect(x4, currentY, cardW, cardH, 2, 2, 'FD');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(2, 132, 199);
        doc.text('ARREGLOS + PEGAS', x4 + 3.5, currentY + 5.5);
        doc.setFontSize(11);
        doc.setTextColor(3, 105, 161);
        doc.text(`${fmtInt(totalArrPeg)} (${fmtPct(totalArrPeg / (currentStats.revisada || 1))})`, x4 + 3.5, currentY + 12.5);
        doc.setFontSize(6.5);
        doc.setTextColor(14, 165, 233);
        doc.text(`Cab: ${fmtInt(currentStats.arreCabeceras)} | Lat: ${fmtInt(currentStats.arreLaterales)} | Peg: ${fmtInt(currentStats.pegas)}`, x4 + 3.5, currentY + 17.5);

        currentY += cardH + 7;
      }

      // ── 3. SECCIÓN: COMPARATIVA MoM (FRENTE A FRENTE CON GRÁFICA VECTORIAL) ──
      if (includeMoM && (periodType === 'mom' || compareFilteredRecords.length > 0)) {
        checkPageBreak(65);

        const curName = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
        const prevName = `${MONTH_NAMES[compareMonth]} ${compareYear}`;

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`1. Comparativa Ejecutiva Mes a Mes (MoM): ${curName} vs ${prevName}`, margin, currentY);
        currentY += 3;

        // Tabla comparativa
        const deltaVol = currentStats.revisada - compareStats.revisada;
        const deltaBuenas = Number(((currentStats.pctBuena - compareStats.pctBuena) * 100).toFixed(1));
        const deltaSeg = Number(((currentStats.pctSegundas - compareStats.pctSegundas) * 100).toFixed(2));
        const deltaEst = Number(((currentStats.pctEstampado - compareStats.pctEstampado) * 100).toFixed(2));
        const deltaTint = Number(((currentStats.pctTintoreria - compareStats.pctTintoreria) * 100).toFixed(2));
        const deltaTej = Number(((currentStats.pctTejeduria - compareStats.pctTejeduria) * 100).toFixed(2));
        const deltaArr = Number(((currentStats.pctArreglos - compareStats.pctArreglos) * 100).toFixed(2));

        autoTable(doc, {
          startY: currentY,
          head: [['Indicador de Calidad / Proceso', prevName, curName, 'Variación Neta', 'Impacto Operativo']],
          body: [
            ['Volumen Total Revisadas', `${fmtInt(compareStats.revisada)} pz`, `${fmtInt(currentStats.revisada)} pz`, `${deltaVol >= 0 ? '+' : ''}${fmtInt(deltaVol)} pz`, deltaVol >= 0 ? 'Mayor producción' : 'Menor producción'],
            ['1ª Calidad (Conforme)', fmtPct(compareStats.pctBuena), fmtPct(currentStats.pctBuena), `${deltaBuenas >= 0 ? '+' : ''}${deltaBuenas} pp`, deltaBuenas >= 0 ? 'Mejora Favorable' : 'Disminución'],
            ['Tasa Total Segundas', fmtPct(compareStats.pctSegundas), fmtPct(currentStats.pctSegundas), `${deltaSeg <= 0 ? '' : '+'}${deltaSeg} pp`, deltaSeg <= 0 ? 'Favorable (Reducción)' : 'Alerta (Incremento)'],
            ['Estampado (Taller)', fmtPct(compareStats.pctEstampado), fmtPct(currentStats.pctEstampado), `${deltaEst <= 0 ? '' : '+'}${deltaEst} pp`, deltaEst <= 0 ? 'Controlado' : 'Revisar Máquinas'],
            ['Arreglos (Cabeceras + Lat.)', fmtPct(compareStats.pctArreglos), fmtPct(currentStats.pctArreglos), `${deltaArr <= 0 ? '' : '+'}${deltaArr} pp`, deltaArr <= 0 ? 'Favorable' : 'Alerta Dobladillo'],
            ['Tintorería / Acabado', fmtPct(compareStats.pctTintoreria), fmtPct(currentStats.pctTintoreria), `${deltaTint <= 0 ? '' : '+'}${deltaTint} pp`, deltaTint <= 0 ? 'Normal' : 'Revisar Proveedor'],
            ['Tejeduría / Hilatura', fmtPct(compareStats.pctTejeduria), fmtPct(currentStats.pctTejeduria), `${deltaTej <= 0 ? '' : '+'}${deltaTej} pp`, deltaTej <= 0 ? 'Normal' : 'Revisar Telares'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: {
            3: { fontStyle: 'bold' },
            4: { fontStyle: 'bold' }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;

        // Gráfica Vectorial Comparativa MoM de Barras Lado a Lado
        checkPageBreak(38);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, 34, 2, 2, 'FD');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('Gráfica Comparativa de Tasas Clave (% Mes Anterior vs % Mes Actual)', margin + 4, currentY + 5);

        // Leyenda
        doc.setFillColor(148, 163, 184); // slate-400 (mes anterior)
        doc.rect(margin + contentWidth - 75, currentY + 2.5, 3.5, 3.5, 'F');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${prevName}`, margin + contentWidth - 70, currentY + 5);

        doc.setFillColor(16, 185, 129); // emerald-500 (mes actual)
        doc.rect(margin + contentWidth - 35, currentY + 2.5, 3.5, 3.5, 'F');
        doc.text(`${curName}`, margin + contentWidth - 30, currentY + 5);

        // Barras comparativas
        const momMetrics = [
          { name: '1ª Calidad', prev: compareStats.pctBuena * 100, curr: currentStats.pctBuena * 100, max: 100, currColor: [16, 185, 129] },
          { name: 'Segundas', prev: compareStats.pctSegundas * 100, curr: currentStats.pctSegundas * 100, max: 20, currColor: [225, 29, 72] },
          { name: 'Arreglos', prev: compareStats.pctArreglos * 100, curr: currentStats.pctArreglos * 100, max: 30, currColor: [2, 132, 199] },
          { name: 'Estampado', prev: compareStats.pctEstampado * 100, curr: currentStats.pctEstampado * 100, max: 10, currColor: [249, 115, 22] },
          { name: 'Tintorería', prev: compareStats.pctTintoreria * 100, curr: currentStats.pctTintoreria * 100, max: 10, currColor: [13, 148, 136] },
        ];

        const barGroupW = (contentWidth - 10) / momMetrics.length;
        const maxBarH = 17;
        const baseY = currentY + 28;

        momMetrics.forEach((mItem, idx) => {
          const gx = margin + 5 + idx * barGroupW;
          const hPrev = Math.min(maxBarH, Math.max(1, (mItem.prev / mItem.max) * maxBarH));
          const hCurr = Math.min(maxBarH, Math.max(1, (mItem.curr / mItem.max) * maxBarH));

          // Barra Mes Anterior
          doc.setFillColor(203, 213, 225);
          doc.rect(gx + 4, baseY - hPrev, 8, hPrev, 'F');
          doc.setFontSize(5.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`${mItem.prev.toFixed(1)}%`, gx + 4, baseY - hPrev - 1);

          // Barra Mes Actual
          doc.setFillColor(mItem.currColor[0], mItem.currColor[1], mItem.currColor[2]);
          doc.rect(gx + 14, baseY - hCurr, 8, hCurr, 'F');
          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(`${mItem.curr.toFixed(1)}%`, gx + 14, baseY - hCurr - 1);

          // Etiqueta del grupo
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(71, 85, 105);
          doc.text(mItem.name, gx + 6, baseY + 4);
        });

        currentY += 40;
      }

      // ── 4. SECCIÓN: GRÁFICA DE TENDENCIA / EVOLUCIÓN CRONOLÓGICA ──
      if (includeTrendChart && timelineData.length > 1) {
        checkPageBreak(45);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('2. Evolución Cronológica de Inspección y Segundas', margin, currentY);
        currentY += 3;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, 'FD');

        // Leyenda
        doc.setFillColor(59, 130, 246); // Azul: Buenas
        doc.rect(margin + 5, currentY + 3.5, 3.5, 3.5, 'F');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('1ª Calidad (Buenas)', margin + 10, currentY + 6);

        doc.setFillColor(225, 29, 72); // Rojo: Segundas
        doc.rect(margin + 45, currentY + 3.5, 3.5, 3.5, 'F');
        doc.text('Total Segundas', margin + 50, currentY + 6);

        // Renderizado de barras vectoriales de la tendencia
        const maxVal = Math.max(...timelineData.map(d => d.revisadas), 1);
        const tBarW = Math.min(10, (contentWidth - 20) / timelineData.length - 2);
        const chartBaseY = currentY + 31;
        const maxChartH = 20;

        timelineData.forEach((pt, idx) => {
          const px = margin + 8 + idx * ((contentWidth - 16) / timelineData.length);
          const hTotal = (pt.revisadas / maxVal) * maxChartH;
          const hSeg = (pt.segundas / maxVal) * maxChartH;
          const hBuenas = Math.max(0, hTotal - hSeg);

          // Buenas
          doc.setFillColor(99, 102, 241); // indigo-500
          doc.rect(px, chartBaseY - hTotal, tBarW, hBuenas, 'F');

          // Segundas (en la parte superior de la barra apilada)
          if (hSeg > 0) {
            doc.setFillColor(225, 29, 72); // rose-600
            doc.rect(px, chartBaseY - hSeg, tBarW, hSeg, 'F');
          }

          // Etiqueta X
          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(pt.label, px, chartBaseY + 3.5);
        });

        currentY += 44;
      }

      // ── 5. SECCIÓN: DISTRIBUCIÓN POR PROCESO TEXTIL (CON BARRAS DE IMPACTO) ──
      if (includeProcessChart) {
        checkPageBreak(55);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('3. Distribución de Segundas y Reprocesos por Proceso Textil', margin, currentY);
        currentY += 3;

        // Barras horizontales de impacto visual
        const processItems = [
          { name: 'Estampado (Taller)', cant: currentStats.estampado, pct: currentStats.pctEstampado, color: [225, 29, 72], threshold: 0.04, estado: currentStats.pctEstampado > 0.04 ? 'Alerta Taller' : 'Normal' },
          { name: 'Arreglos Cabeceras', cant: currentStats.arreCabeceras, pct: currentStats.pctCabeceras, color: [2, 132, 199], threshold: 0.05, estado: currentStats.pctCabeceras > 0.05 ? 'Reproceso Alto' : 'Normal' },
          { name: 'Arreglos Laterales', cant: currentStats.arreLaterales, pct: currentStats.pctLaterales, color: [14, 165, 233], threshold: 0.05, estado: currentStats.pctLaterales > 0.05 ? 'Reproceso Alto' : 'Normal' },
          { name: 'Pegas (Empalmes)', cant: currentStats.pegas, pct: currentStats.pctPegas, color: [139, 92, 246], threshold: 0.04, estado: 'Operativo' },
          { name: 'Tintorería / Humedo', cant: currentStats.tintoreria, pct: currentStats.pctTintoreria, color: [13, 148, 136], threshold: 0.03, estado: currentStats.pctTintoreria > 0.03 ? 'Revisión Proveedor' : 'Normal' },
          { name: 'Tejeduría / Hilatura', cant: currentStats.tejeduria, pct: currentStats.pctTejeduria, color: [16, 185, 129], threshold: 0.02, estado: 'Normal' },
        ];

        autoTable(doc, {
          startY: currentY,
          head: [['Área / Proceso', 'Piezas Afectadas', '% Incidencia', 'Tolerancia Máx', 'Estado Operativo']],
          body: [
            ['1ª Calidad (Conforme)', `${fmtInt(currentStats.buena)} pz`, fmtPct(currentStats.pctBuena), 'Meta: > 92%', 'Conforme'],
            ...processItems.map(p => [
              p.name,
              `${fmtInt(p.cant)} pz`,
              fmtPct(p.pct),
              `≤ ${fmtPct(p.threshold, 0)}`,
              p.estado
            ])
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: {
            4: { fontStyle: 'bold' }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 7;
      }

      // ── 6. SECCIÓN: DESGLOSE POR TÉCNICA (REACTIVO VS PIGMENTO) ──
      if (includeTecnicaChart && currentStats.revisada > 0) {
        checkPageBreak(30);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('4. Desglose Comparativo por Técnica de Estampación', margin, currentY);
        currentY += 3;

        const tecW = (contentWidth - 4) / 2;
        const tecH = 20;

        // Tarjeta Reactivo
        doc.setFillColor(245, 243, 255);
        doc.setDrawColor(221, 214, 254);
        doc.roundedRect(margin, currentY, tecW, tecH, 2, 2, 'FD');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(109, 40, 217);
        doc.text('LÍNEA REACTIVO', margin + 4, currentY + 5.5);
        doc.setFontSize(10);
        doc.setTextColor(76, 29, 149);
        doc.text(`${fmtInt(currentStats.reactivoRev)} pz  (${fmtPct(currentStats.reactivoRev / (currentStats.revisada || 1))})`, margin + 4, currentY + 11.5);
        doc.setFontSize(6.5);
        doc.setTextColor(124, 58, 237);
        doc.text(`Segundas: ${fmtInt(currentStats.reactivoSeg)} pz   |   Tasa de Falla: ${fmtPct(currentStats.pctReactivoSeg)}`, margin + 4, currentY + 16.5);

        // Tarjeta Pigmento
        const xPig = margin + tecW + 4;
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(254, 240, 138);
        doc.roundedRect(xPig, currentY, tecW, tecH, 2, 2, 'FD');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        doc.text('LÍNEA PIGMENTO', xPig + 4, currentY + 5.5);
        doc.setFontSize(10);
        doc.setTextColor(120, 53, 15);
        doc.text(`${fmtInt(currentStats.pigmentoRev)} pz  (${fmtPct(currentStats.pigmentoRev / (currentStats.revisada || 1))})`, xPig + 4, currentY + 11.5);
        doc.setFontSize(6.5);
        doc.setTextColor(217, 119, 6);
        doc.text(`Segundas: ${fmtInt(currentStats.pigmentoSeg)} pz   |   Tasa de Falla: ${fmtPct(currentStats.pctPigmentoSeg)}`, xPig + 4, currentY + 16.5);

        currentY += tecH + 7;
      }

      // ── 7. SECCIÓN: TOP DISEÑOS CRÍTICOS (GRÁFICA HORIZONTAL + TABLA) ──
      if (includeTopDesigns && topDesigns.length > 0) {
        checkPageBreak(65);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`5. Ranking Top ${Math.min(topDesignsLimit, topDesigns.length)} Diseños Críticos (Mayor Falla)`, margin, currentY);
        currentY += 3;

        // Gráfica de Barras Horizontales de los Top Diseños
        const topSlice = topDesigns.slice(0, topDesignsLimit);
        const maxTopSeg = Math.max(...topSlice.map(d => d.totalSegundas), 1);
        const barH = 5.5;
        const chartBlockH = topSlice.length * (barH + 2) + 6;

        checkPageBreak(chartBlockH);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, chartBlockH, 2, 2, 'FD');

        topSlice.forEach((d, idx) => {
          const dy = currentY + 4 + idx * (barH + 2);
          const barW = Math.max(3, (d.totalSegundas / maxTopSeg) * (contentWidth - 75));

          // Nombre del diseño
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          const shortName = d.name.length > 20 ? d.name.slice(0, 18) + '..' : d.name;
          doc.text(`#${idx + 1} ${shortName}`, margin + 3, dy + 4);

          // Pista de fondo de la barra
          doc.setFillColor(241, 245, 249);
          doc.rect(margin + 42, dy, contentWidth - 75, barH, 'F');

          // Barra de color
          const isCrit = d.pctSegundas >= 8;
          const isWarn = d.pctSegundas >= 4 && !isCrit;
          doc.setFillColor(isCrit ? 225 : isWarn ? 245 : 16, isCrit ? 29 : isWarn ? 158 : 185, isCrit ? 72 : isWarn ? 11 : 129);
          doc.roundedRect(margin + 42, dy, barW, barH, 1, 1, 'F');

          // Texto de piezas y %
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(isCrit ? 190 : isWarn ? 180 : 5, isCrit ? 18 : isWarn ? 83 : 150, isCrit ? 60 : isWarn ? 9 : 105);
          doc.text(`${fmtInt(d.totalSegundas)} pz (${d.pctSegundas}%)`, margin + 45 + barW, dy + 4);

          // Badge estado
          doc.setFontSize(5.5);
          doc.setTextColor(isCrit ? 225 : isWarn ? 217 : 5, isCrit ? 29 : isWarn ? 119 : 150, isCrit ? 72 : isWarn ? 6 : 105);
          doc.text(isCrit ? 'CRÍTICO' : isWarn ? 'ALERTA' : 'NORMAL', margin + contentWidth - 22, dy + 4);
        });

        currentY += chartBlockH + 5;

        // Tabla detallada de Top Diseños
        checkPageBreak(35);
        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Diseño', 'Técnica', 'Tela', 'Revisadas', 'Segundas', '% Seg', 'Defecto Principal', 'Nivel']],
          body: topSlice.map((d, idx) => [
            `#${idx + 1}`,
            d.name,
            d.process,
            d.referencia || '-',
            fmtInt(d.totalRevisadas),
            fmtInt(d.totalSegundas),
            `${d.pctSegundas}%`,
            d.topDefecto ? `${d.topDefecto} (${d.topDefectoCant})` : 'Sin fallas',
            d.pctSegundas >= 8 ? 'CRÍTICO' : d.pctSegundas >= 4 ? 'ALERTA' : 'NORMAL'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: {
            8: { fontStyle: 'bold' }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 7;
      }

      // ── 8. SECCIÓN: DESGLOSE DE DEFECTOS DE ESTAMPADO ──
      if (includeDefectsChart && currentStats.estampado > 0) {
        checkPageBreak(40);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('6. Desglose Específico de Defectos de Estampado en Taller', margin, currentY);
        currentY += 3;

        const defectsList = [
          { name: 'Manchas de Pintura', cant: currentStats.defectsMap.manchas },
          { name: 'Repise de Matriz', cant: currentStats.defectsMap.repise },
          { name: 'Falta de Pintura', cant: currentStats.defectsMap.faltaPintura },
          { name: 'Logos Corridos', cant: currentStats.defectsMap.logosCorridos },
          { name: 'Penetración Excesiva', cant: currentStats.defectsMap.penetracion },
          { name: 'Grasa de Máquina', cant: currentStats.defectsMap.grasa },
          { name: 'Descases de Registro', cant: currentStats.defectsMap.descases },
          { name: 'Quemadas de Plancha', cant: currentStats.defectsMap.quemadas },
        ].sort((a, b) => b.cant - a.cant);

        autoTable(doc, {
          startY: currentY,
          head: [['Tipo de Defecto de Estampación', 'Cantidad de Piezas', '% del Total Estampado', 'Prioridad de Calibración']],
          body: defectsList.map(def => {
            const pct = currentStats.estampado > 0 ? (def.cant / currentStats.estampado) * 100 : 0;
            return [
              def.name,
              `${fmtInt(def.cant)} pz`,
              `${pct.toFixed(1)}%`,
              pct >= 25 ? 'Alta Prioridad (Ajustar Matriz)' : pct >= 10 ? 'Atención Preventiva' : 'Baja Incidencia'
            ];
          }),
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          styles: { fontSize: 7, cellPadding: 2 },
          margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── 9. SECCIÓN: FIRMAS DE APROBACIÓN DE PLANTA ──
      if (includeSignatures) {
        checkPageBreak(30);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Validaciones y Aprobación Operativa de Planta:', margin, currentY);

        currentY += 14;
        doc.setDrawColor(148, 163, 184);
        doc.line(margin, currentY, margin + 65, currentY);
        doc.line(margin + 105, currentY, margin + 170, currentY);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('Supervisor de Calidad y Laboratorio', margin, currentY + 4);
        doc.text('Jefe de Planta / Producción Taller', margin + 105, currentY + 4);

        currentY += 12;
      }

      // ── PIE DE PÁGINA Y NUMERACIÓN EN TODAS LAS PÁGINAS ──
      const totalPages = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `CONTEX S.A.S. — Sistema de Control de Calidad Textil   |   Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }

      // Descarga del PDF
      const sanitizedPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Informe_Calidad_Contex_${sanitizedPeriod}_${now.toISOString().slice(0, 10)}.pdf`);

      showToast('success', 'PDF Generado Exitosamente', `El informe personalizado de ${periodLabel} se descargó.`);
      onClose();
    } catch (err) {
      console.error(err);
      showToast('error', 'Error al generar PDF', 'Ocurrió un problema al crear el documento.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ── HEADER MODAL ── */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <FileText className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Generador de Informe Ejecutivo PDF</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Personalizado
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Selecciona el período de tiempo y las gráficas que deseas adjuntar al informe para planta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── CONTENIDO SCROLLABLE ── */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 text-xs">

          {/* ════ 1. SELECTOR DE TIEMPO / PERÍODO ════ */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-rose-600" />
                1. ¿Qué período de tiempo deseas evaluar?
              </span>
              <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                {currentStats.lotes} lotes ({fmtInt(currentStats.revisada)} pz)
              </span>
            </div>

            {/* Pestañas de tipo de tiempo */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => handlePeriodChange('month')}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer text-center ${
                  periodType === 'month'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Un Mes
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('mom')}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  periodType === 'mom'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Mes vs Mes</span>
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('year')}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer text-center ${
                  periodType === 'year'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Año Completo
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('range')}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer text-center ${
                  periodType === 'range'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rango Fechas
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('all')}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer text-center ${
                  periodType === 'all'
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo Histórico
              </button>
            </div>

            {/* Configuración específica según la pestaña de tiempo activa */}
            <div className="pt-2 border-t border-slate-200">
              {/* CASO 1: UN MES ESPECÍFICO */}
              {periodType === 'month' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Mes:</label>
                    <select
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Año:</label>
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium self-end pb-1.5">
                    Informe mensual consolidado para <strong>{MONTH_NAMES[selectedMonth]} {selectedYear}</strong>.
                  </div>
                </div>
              )}

              {/* CASO 2: COMPARATIVA MES ANTERIOR (MoM) */}
              {periodType === 'mom' && (
                <div className="space-y-2.5 bg-purple-50/70 border border-purple-200/80 p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                    <GitCompare className="w-4 h-4 text-purple-600" />
                    <span>Configuración de Comparativa Frente a Frente (MoM):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Mes actual */}
                    <div className="bg-white p-2.5 rounded-lg border border-purple-200">
                      <p className="text-[10px] font-extrabold uppercase text-purple-700 mb-1">1. Mes a Evaluar (Actual):</p>
                      <div className="flex gap-2">
                        <select
                          value={selectedMonth}
                          onChange={e => setSelectedMonth(Number(e.target.value))}
                          className="flex-1 bg-purple-50/40 border border-purple-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                        >
                          {MONTH_NAMES.map((name, idx) => (
                            <option key={name} value={idx}>{name}</option>
                          ))}
                        </select>
                        <select
                          value={selectedYear}
                          onChange={e => setSelectedYear(Number(e.target.value))}
                          className="w-20 bg-purple-50/40 border border-purple-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                        >
                          {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Mes base / anterior */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[10px] font-extrabold uppercase text-slate-600 mb-1">2. Mes Base (Comparar contra):</p>
                      <div className="flex gap-2">
                        <select
                          value={compareMonth}
                          onChange={e => setCompareMonth(Number(e.target.value))}
                          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                        >
                          {MONTH_NAMES.map((name, idx) => (
                            <option key={name} value={idx}>{name}</option>
                          ))}
                        </select>
                        <select
                          value={compareYear}
                          onChange={e => setCompareYear(Number(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                        >
                          {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-purple-800 font-medium">
                    ⚡ Se calcularán variaciones en puntos porcentuales (±pp), diferencias de piezas y gráficas comparativas entre {MONTH_NAMES[selectedMonth]} {selectedYear} y {MONTH_NAMES[compareMonth]} {compareYear}.
                  </p>
                </div>
              )}

              {/* CASO 3: AÑO COMPLETO */}
              {periodType === 'year' && (
                <div className="flex items-center gap-3">
                  <div className="w-32">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Selecciona el Año:</label>
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium self-end pb-1.5">
                    Consolidará todos los lotes e inspecciones registradas durante el año <strong>{selectedYear}</strong>.
                  </div>
                </div>
              )}

              {/* CASO 4: RANGO DE FECHAS */}
              {periodType === 'range' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Fecha Inicial:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Fecha Final:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium self-end pb-1.5">
                    Evalúa exactamente el rango personalizado entre ambas fechas.
                  </div>
                </div>
              )}

              {/* CASO 5: TODO EL HISTÓRICO */}
              {periodType === 'all' && (
                <div className="text-[11px] text-slate-600 py-1">
                  🌐 Se incluirán <strong>todos los registros disponibles ({records.length} lotes)</strong> sin filtro de fechas.
                </div>
              )}
            </div>

            {/* Filtros opcionales de Técnica y Referencia */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3 text-slate-600">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Alcance Opcional:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold">Técnica:</span>
                <select
                  value={tecnicaFilter}
                  onChange={e => setTecnicaFilter(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700"
                >
                  <option value="all">Todas las técnicas</option>
                  <option value="REACTIVO">Solo Reactivo</option>
                  <option value="PIGMENTO">Solo Pigmento</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold">Tela Base:</span>
                <select
                  value={referenciaFilter}
                  onChange={e => setReferenciaFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700"
                >
                  <option value="all">Todas las telas</option>
                  {availableRefs.map(ref => (
                    <option key={ref} value={ref}>{ref}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ════ 2. SELECTOR DE GRÁFICAS Y SECCIONES A ADJUNTAR ════ */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-rose-600" />
                2. ¿Qué gráficas y bloques deseas adjuntar al informe?
              </span>

              {/* Botones de presets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllSections(true)}
                  className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300/80 transition-all cursor-pointer"
                >
                  Marcar Todo
                </button>
                <button
                  type="button"
                  onClick={applyExecutivePreset}
                  className="px-2 py-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-all cursor-pointer"
                >
                  Resumen Ejecutivo
                </button>
                <button
                  type="button"
                  onClick={applyChartsOnlyPreset}
                  className="px-2 py-1 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-all cursor-pointer"
                >
                  Solo Gráficas
                </button>
              </div>
            </div>

            {/* Cuadrícula de Opciones / Gráficas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

              {/* OPCIÓN 1: Tarjetas KPI */}
              <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                includeKpiCards ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={includeKpiCards}
                  onChange={e => setIncludeKpiCards(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Balance General y Tarjetas KPI</span>
                    <span className="text-[10px] text-rose-600 font-bold">4 Tarjetas</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Total revisadas, 1ª calidad (buenas), tasa de segundas con semáforo de alerta y arreglos/pegas.
                  </p>
                </div>
              </label>

              {/* OPCIÓN 2: Comparativa MoM */}
              <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                includeMoM ? 'bg-purple-50/60 border-purple-300 ring-1 ring-purple-200' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={includeMoM}
                  onChange={e => setIncludeMoM(e.target.checked)}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Gráfica y Tabla Comparativa MoM</span>
                    <span className="text-[10px] text-purple-600 font-bold">Barras MoM</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Comparación lado a lado de tasas con mes anterior, deltas (±pp) y variación de volumen.
                  </p>
                </div>
              </label>

              {/* OPCIÓN 3: Gráfica de Tendencia */}
              <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                includeTrendChart ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={includeTrendChart}
                  onChange={e => setIncludeTrendChart(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Gráfica de Evolución Cronológica</span>
                    <span className="text-[10px] text-indigo-600 font-bold">Tendencia</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Histograma cronológico mostrando producción conforme vs unidades de segundas día a día o mes a mes.
                  </p>
                </div>
              </label>

              {/* OPCIÓN 4: Distribución de Procesos */}
              <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                includeProcessChart ? 'bg-teal-50/50 border-teal-300 ring-1 ring-teal-200' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={includeProcessChart}
                  onChange={e => setIncludeProcessChart(e.target.checked)}
                  className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Gráfica y Desglose por Proceso</span>
                    <span className="text-[10px] text-teal-600 font-bold">6 Procesos</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Fallas en Estampado, Tintorería, Tejeduría, Cabeceras, Laterales y Pegas con umbrales de tolerancia.
                  </p>
                </div>
              </label>

              {/* OPCIÓN 5: Gráfica de Técnica */}
              <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                includeTecnicaChart ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={includeTecnicaChart}
                  onChange={e => setIncludeTecnicaChart(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Gráfica de Técnica (Reactivo vs Pigmento)</span>
                    <span className="text-[10px] text-amber-600 font-bold">Líneas</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Volumen evaluado y porcentaje de segundas comparativo entre la línea de Reactivo y Pigmento.
                  </p>
                </div>
              </label>

              {/* OPCIÓN 6: Ranking Top Diseños Críticos */}
              <div className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                includeTopDesigns ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={includeTopDesigns}
                    onChange={e => setIncludeTopDesigns(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                      <span>Ranking Top Diseños Críticos</span>
                      <span className="text-[10px] text-rose-600 font-bold">Gráfica Barras</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      Barras de los diseños con mayor impacto de fallas, % de segundas y defecto principal.
                    </p>
                  </div>
                </div>

                {includeTopDesigns && (
                  <div className="mt-2 pt-2 border-t border-rose-200 flex items-center justify-between pl-7">
                    <span className="text-[10px] font-bold text-slate-600">¿Cuántos diseños incluir?</span>
                    <div className="flex items-center gap-1">
                      {[5, 8, 10, 15].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTopDesignsLimit(cnt)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                            topDesignsLimit === cnt
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Top {cnt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* OPCIÓN 7: Desglose de Defectos de Estampado */}
              <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                includeDefectsChart ? 'bg-sky-50/50 border-sky-300 ring-1 ring-sky-200' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={includeDefectsChart}
                  onChange={e => setIncludeDefectsChart(e.target.checked)}
                  className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Desglose de Defectos de Estampado</span>
                    <span className="text-[10px] text-sky-600 font-bold">Taller</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Detalle específico de manchas, repise, falta de pintura, descases, quemadas y grasa en máquina.
                  </p>
                </div>
              </label>

              {/* OPCIÓN 8: Firmas de Aprobación */}
              <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                includeSignatures ? 'bg-slate-100/70 border-slate-300 ring-1 ring-slate-200' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={e => setIncludeSignatures(e.target.checked)}
                  className="mt-0.5 rounded text-slate-700 focus:ring-slate-500 w-4 h-4"
                />
                <div className="flex-1">
                  <p className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Espacio de Firmas y Validación</span>
                    <span className="text-[10px] text-slate-500 font-bold">Jefatura</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Espacios para firma del Supervisor de Calidad y Jefe de Planta / Producción Taller al pie del reporte.
                  </p>
                </div>
              </label>

            </div>
          </div>
        </div>

        {/* ── FOOTER CON RESUMEN Y BOTONES DE ACCIÓN ── */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-slate-600">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Informe listo para: <strong>{periodLabel}</strong></span>
            </p>
            <p className="text-[11px] text-slate-500">
              {currentStats.lotes} lotes evaluados ({fmtInt(currentStats.revisada)} pz) • Tasa de Segundas: <strong className={currentStats.pctSegundas >= 0.08 ? 'text-rose-600' : 'text-slate-700'}>{fmtPct(currentStats.pctSegundas)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={isGenerating || currentFilteredRecords.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-md shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Generando PDF...' : 'Descargar Informe PDF'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
