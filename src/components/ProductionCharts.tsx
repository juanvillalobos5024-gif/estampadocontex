import { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend, ComposedChart, Line, Area
} from 'recharts';
import {
  Table, Award, Zap, TrendingUp, Calendar, Layers, BarChart3,
  Eye, EyeOff, Search, X, RotateCcw, ArrowDownWideNarrow, ArrowUpNarrowWide,
  Check, SlidersHorizontal, GitCompare, ArrowUpRight, ArrowDownRight, Minus,
  FileDown, FileText, FileSpreadsheet, ChevronDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { DailyProductionRecord } from '../types';
import { getRecordKg, getRecordGolpes } from '../lib/dataService';

interface ProductionChartsProps {
  records: DailyProductionRecord[];
  allRecords?: DailyProductionRecord[];
  weightUnit: 'kg' | 'g';
  periodLabel?: string;
  selectedMonth?: number;
  selectedYear?: number;
  timeFilter?: string;
}

type ProductionMetric = 'kg' | 'units' | 'golpes';

const REACTIVO_COLOR = '#8b5cf6';
const PIGMENTO_COLOR = '#f59e0b';
const DESIGN_COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#8b5cf6', '#84cc16', '#f97316'];
const SHIFT_COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b'];
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES');
const fmtDec = (n: number, d = 2) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}-${MONTH_SHORT[(m || 1) - 1]}`;
};

const tooltipStyle = {
  borderRadius: '12px',
  border: 'none',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

export default function ProductionCharts({
  records,
  allRecords,
  weightUnit,
  periodLabel,
  selectedMonth,
  selectedYear,
  timeFilter
}: ProductionChartsProps) {
  const [metric, setMetric] = useState<ProductionMetric>('kg');
  const [compareMode, setCompareMode] = useState<'acumulado' | 'diario'>('acumulado');
  const [showCompare, setShowCompare] = useState<boolean>(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

  // ── Estados para dinamismo y visibilidad de diseños ──
  const [hiddenDesigns, setHiddenDesigns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('prod_charts_hidden_designs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [designLimit, setDesignLimit] = useState<number>(10);
  const [designProcessFilter, setDesignProcessFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');
  const [designSortOrder, setDesignSortOrder] = useState<'desc' | 'asc'>('desc');
  const [designSearch, setDesignSearch] = useState<string>('');
  const [isDesignManagerOpen, setIsDesignManagerOpen] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalProcessFilter, setModalProcessFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');

  useEffect(() => {
    try {
      localStorage.setItem('prod_charts_hidden_designs', JSON.stringify(hiddenDesigns));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }, [hiddenDesigns]);

  useEffect(() => {
    if (!isDesignManagerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDesignManagerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesignManagerOpen]);

  const wFactor = weightUnit === 'kg' ? 1 : 1000;
  const wLabel = weightUnit === 'kg' ? 'kg' : 'g';

  const metricMeta: Record<ProductionMetric, { label: string; unit: string }> = {
    kg: { label: weightUnit === 'kg' ? 'Kilos de tela' : 'Gramos de tela', unit: wLabel },
    units: { label: 'Unidades', unit: 'pz' },
    golpes: { label: 'Golpes', unit: 'golpes' },
  };

  const valueOf = (r: DailyProductionRecord): number => {
    if (metric === 'kg') return getRecordKg(r) * wFactor;
    if (metric === 'units') return r.units || 0;
    return getRecordGolpes(r);
  };

  const round = (n: number) => (metric === 'kg' ? Number(n.toFixed(weightUnit === 'kg' ? 2 : 0)) : Math.round(n));

  // ── Todos los diseños disponibles en el periodo completo (catálogo base) ──
  const allDesigns = useMemo(() => {
    const map = new Map<string, {
      name: string;
      value: number;
      units: number;
      golpes: number;
      process: string;
      count: number;
      reactivoVal: number;
      pigmentoVal: number;
    }>();

    records.forEach(r => {
      const name = (r.designName || 'SIN NOMBRE').trim();
      const val = valueOf(r);
      const existing = map.get(name) || {
        name,
        value: 0,
        units: 0,
        golpes: 0,
        process: r.process,
        count: 0,
        reactivoVal: 0,
        pigmentoVal: 0,
      };
      existing.value += val;
      existing.units += (r.units || 0);
      existing.golpes += getRecordGolpes(r);
      existing.count += 1;
      if (r.process === 'REACTIVO') {
        existing.reactivoVal += val;
      } else {
        existing.pigmentoVal += val;
      }
      if (existing.reactivoVal > 0 && existing.pigmentoVal > 0) {
        existing.process = existing.reactivoVal >= existing.pigmentoVal ? 'REACTIVO' : 'PIGMENTO';
      } else {
        existing.process = r.process;
      }
      map.set(name, existing);
    });

    return Array.from(map.values())
      .map(d => ({
        ...d,
        value: round(d.value),
        reactivoVal: round(d.reactivoVal),
        pigmentoVal: round(d.pigmentoVal),
      }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, metric, weightUnit]);

  const activeHiddenDesigns = useMemo(() => {
    const existingNames = new Set(allDesigns.map(d => d.name));
    return hiddenDesigns.filter(name => existingNames.has(name));
  }, [hiddenDesigns, allDesigns]);

  // ── Registros activos (excluyendo diseños ocultos) ──
  // Afecta a: KPIs, Kilos por día, Reactivo vs Pigmento, Turnos y Top Diseños
  const visibleRecords = useMemo(() => {
    if (activeHiddenDesigns.length === 0) return records;
    const hiddenSet = new Set(activeHiddenDesigns);
    return records.filter(r => !hiddenSet.has((r.designName || 'SIN NOMBRE').trim()));
  }, [records, activeHiddenDesigns]);

  // ── KPIs (Basados en visibleRecords) ──
  const kpis = useMemo(() => {
    const totalKg = visibleRecords.reduce((a, r) => a + getRecordKg(r), 0);
    const totalUnits = visibleRecords.reduce((a, r) => a + (r.units || 0), 0);
    const totalGolpes = visibleRecords.reduce((a, r) => a + getRecordGolpes(r), 0);
    const byDate = new Map<string, number>();
    visibleRecords.forEach(r => byDate.set(r.date, (byDate.get(r.date) || 0) + getRecordKg(r)));
    const days = byDate.size;
    let bestDay = '';
    let bestKg = 0;
    byDate.forEach((kg, d) => { if (kg > bestKg) { bestKg = kg; bestDay = d; } });
    return {
      totalKg, totalUnits, totalGolpes, days,
      avgKgDay: days > 0 ? totalKg / days : 0,
      avgUnitsDay: days > 0 ? totalUnits / days : 0,
      bestDay, bestKg,
    };
  }, [visibleRecords]);

  // ── CONTEXTO Y CÁLCULO DE MES ACTUAL VS MES ANTERIOR ──
  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const { curMonth, curYear, prevMonth, prevYear } = useMemo(() => {
    let m = selectedMonth;
    let y = selectedYear;

    if (m === undefined || y === undefined) {
      if (records.length > 0) {
        const parts = records[0].date.split('-').map(Number);
        if (parts.length >= 2) {
          y = parts[0];
          m = parts[1] - 1;
        }
      }
      if (m === undefined || y === undefined) {
        const now = new Date();
        m = now.getMonth();
        y = now.getFullYear();
      }
    }

    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;

    return { curMonth: m, curYear: y, prevMonth: pm, prevYear: py };
  }, [selectedMonth, selectedYear, records]);

  const curMonthName = `${MONTH_NAMES[curMonth]} ${curYear}`;
  const prevMonthName = `${MONTH_NAMES[prevMonth]} ${prevYear}`;

  // Registros del mes anterior desde allRecords (filtrando diseños ocultos equitativamente)
  const prevMonthRecords = useMemo(() => {
    if (!allRecords || allRecords.length === 0) return [];
    const targetPrefix = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
    return allRecords.filter(r => r.date.startsWith(targetPrefix));
  }, [allRecords, prevYear, prevMonth]);

  const visiblePrevRecords = useMemo(() => {
    if (activeHiddenDesigns.length === 0) return prevMonthRecords;
    const hiddenSet = new Set(activeHiddenDesigns);
    return prevMonthRecords.filter(r => !hiddenSet.has((r.designName || 'SIN NOMBRE').trim()));
  }, [prevMonthRecords, activeHiddenDesigns]);

  const hasPrevData = visiblePrevRecords.length > 0;

  // KPIs del mes anterior
  const prevKpis = useMemo(() => {
    const totalKg = visiblePrevRecords.reduce((a, r) => a + getRecordKg(r), 0);
    const totalUnits = visiblePrevRecords.reduce((a, r) => a + (r.units || 0), 0);
    const totalGolpes = visiblePrevRecords.reduce((a, r) => a + getRecordGolpes(r), 0);
    const byDate = new Map<string, number>();
    visiblePrevRecords.forEach(r => byDate.set(r.date, (byDate.get(r.date) || 0) + getRecordKg(r)));
    const days = byDate.size;
    let bestDay = '';
    let bestKg = 0;
    byDate.forEach((kg, d) => { if (kg > bestKg) { bestKg = kg; bestDay = d; } });
    return {
      totalKg, totalUnits, totalGolpes, days,
      avgKgDay: days > 0 ? totalKg / days : 0,
      avgUnitsDay: days > 0 ? totalUnits / days : 0,
      bestDay, bestKg,
    };
  }, [visiblePrevRecords]);

  // Cálculo de variación porcentual y flechas de tendencia
  const calcGrowth = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return { pct: 0, diff: 0, isUp: true, isFlat: true };
    if (previous === 0) return { pct: 100, diff: current, isUp: true, isFlat: false };
    const diff = current - previous;
    const pct = (diff / previous) * 100;
    return {
      pct: Math.abs(pct),
      diff,
      isUp: diff >= 0,
      isFlat: Math.abs(diff) < 0.001,
    };
  };

  const kgGrowth = calcGrowth(kpis.totalKg, prevKpis.totalKg);
  const unitsGrowth = calcGrowth(kpis.totalUnits, prevKpis.totalUnits);
  const golpesGrowth = calcGrowth(kpis.totalGolpes, prevKpis.totalGolpes);

  // Datos para el gráfico comparativo día a día superpuesto (Día 1 al 31)
  const comparisonTimeline = useMemo(() => {
    const daysInCur = new Date(curYear, curMonth + 1, 0).getDate();
    const daysInPrev = new Date(prevYear, prevMonth + 1, 0).getDate();
    const totalDays = Math.max(daysInCur, daysInPrev);

    const curMap = new Map<number, number>();
    visibleRecords.forEach(r => {
      const d = parseInt(r.date.slice(8, 10), 10);
      if (!isNaN(d)) curMap.set(d, (curMap.get(d) || 0) + valueOf(r));
    });

    const prevMap = new Map<number, number>();
    visiblePrevRecords.forEach(r => {
      const d = parseInt(r.date.slice(8, 10), 10);
      if (!isNaN(d)) prevMap.set(d, (prevMap.get(d) || 0) + valueOf(r));
    });

    const now = new Date();
    const isCurrentCalendarMonth = now.getFullYear() === curYear && now.getMonth() === curMonth;
    const todayDate = isCurrentCalendarMonth ? now.getDate() : 999;

    let accCur = 0;
    let accPrev = 0;
    const list = [];

    for (let day = 1; day <= totalDays; day++) {
      const valCur = curMap.get(day) || 0;
      const valPrev = prevMap.get(day) || 0;

      if (day <= daysInPrev) {
        accPrev += valPrev;
      }
      const hasCurData = day <= daysInCur && day <= todayDate;
      if (hasCurData) {
        accCur += valCur;
      }

      list.push({
        day,
        label: `Día ${day}`,
        actual: hasCurData ? round(valCur) : null,
        anterior: day <= daysInPrev ? round(valPrev) : null,
        actualAcum: hasCurData ? round(accCur) : null,
        anteriorAcum: day <= daysInPrev ? round(accPrev) : null,
      });
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRecords, visiblePrevRecords, curYear, curMonth, prevYear, prevMonth, metric, weightUnit]);

  // ── Serie temporal (Basada en visibleRecords) ──
  const { timeline, groupedByMonth } = useMemo(() => {
    const dates = visibleRecords.map(r => r.date).sort();
    let byMonth = false;
    if (dates.length > 0) {
      const span = (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000;
      byMonth = span > 62;
    }

    const map = new Map<string, { key: string; label: string; reactivo: number; pigmento: number; total: number }>();
    visibleRecords.forEach(r => {
      const key = byMonth ? r.date.slice(0, 7) : r.date;
      let label: string;
      if (byMonth) {
        const [y, m] = key.split('-').map(Number);
        label = `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
      } else {
        label = dayLabel(r.date);
      }
      const entry = map.get(key) || { key, label, reactivo: 0, pigmento: 0, total: 0 };
      const v = valueOf(r);
      if (r.process === 'REACTIVO') entry.reactivo += v; else entry.pigmento += v;
      entry.total += v;
      map.set(key, entry);
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
    let acc = 0;
    const list = sorted.map(e => {
      acc += e.total;
      return {
        label: e.label,
        Reactivo: round(e.reactivo),
        Pigmento: round(e.pigmento),
        total: round(e.total),
        acumulado: round(acc),
      };
    });
    return { timeline: list, groupedByMonth: byMonth };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRecords, metric, weightUnit]);

  // ── Distribución por proceso (Basada en visibleRecords) ──
  const processData = useMemo(() => {
    let reactivo = 0;
    let pigmento = 0;
    visibleRecords.forEach(r => {
      const v = valueOf(r);
      if (r.process === 'REACTIVO') reactivo += v; else pigmento += v;
    });
    return [
      { name: 'Reactivo', value: round(reactivo), color: REACTIVO_COLOR },
      { name: 'Pigmento', value: round(pigmento), color: PIGMENTO_COLOR },
    ].filter(d => d.value > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRecords, metric, weightUnit]);

  const processTotal = processData.reduce((a, d) => a + d.value, 0);
  const reactivoItem = processData.find(d => d.name === 'Reactivo');
  const pigmentoItem = processData.find(d => d.name === 'Pigmento');
  const reactivoVal = reactivoItem?.value || 0;
  const pigmentoVal = pigmentoItem?.value || 0;
  const reactivoPct = processTotal > 0 ? (reactivoVal / processTotal) * 100 : 0;
  const pigmentoPct = processTotal > 0 ? (pigmentoVal / processTotal) * 100 : 0;

  // ── Por turno (Basada en visibleRecords) ──
  const shiftData = useMemo(() => {
    const map = new Map<number, number>();
    visibleRecords.forEach(r => map.set(r.shift || 1, (map.get(r.shift || 1) || 0) + valueOf(r)));
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([shift, value]) => ({ name: `Turno ${shift}`, value: round(value), shift }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRecords, metric, weightUnit]);

  // Total de diseños en el catálogo para porcentajes
  const totalDesignsValue = useMemo(() => {
    return allDesigns.reduce((acc, d) => acc + d.value, 0);
  }, [allDesigns]);

  // Diseños filtrados para el gráfico de Top Diseños
  const filteredDesignData = useMemo(() => {
    let list = allDesigns.filter(d => !hiddenDesigns.includes(d.name));

    if (designProcessFilter === 'REACTIVO') {
      list = list.filter(d => d.reactivoVal > 0);
    } else if (designProcessFilter === 'PIGMENTO') {
      list = list.filter(d => d.pigmentoVal > 0);
    }

    if (designSearch.trim()) {
      const q = designSearch.trim().toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }

    if (designSortOrder === 'asc') {
      list = [...list].sort((a, b) => a.value - b.value);
    } else {
      list = [...list].sort((a, b) => b.value - a.value);
    }

    if (designLimit > 0) {
      list = list.slice(0, designLimit);
    }

    return list;
  }, [allDesigns, hiddenDesigns, designProcessFilter, designSearch, designSortOrder, designLimit]);

  // Lista para el modal de configuración de visibilidad
  const modalDesignsList = useMemo(() => {
    let list = allDesigns;
    if (modalProcessFilter === 'REACTIVO') {
      list = list.filter(d => d.reactivoVal > 0);
    } else if (modalProcessFilter === 'PIGMENTO') {
      list = list.filter(d => d.pigmentoVal > 0);
    }
    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [allDesigns, modalProcessFilter, modalSearch]);

  const toggleHideDesign = (name: string) => {
    setHiddenDesigns(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  };

  const showAllDesigns = () => {
    setHiddenDesigns([]);
  };

  const hideAllDesigns = () => {
    setHiddenDesigns(allDesigns.map(d => d.name));
  };

  const invertHiddenDesigns = () => {
    const currentSet = new Set(hiddenDesigns);
    setHiddenDesigns(allDesigns.map(d => d.name).filter(n => !currentSet.has(n)));
  };

  const unitLabel = metricMeta[metric].unit;
  const fmtMetric = (n: number) => (metric === 'kg' && weightUnit === 'kg' ? fmtDec(n) : fmtInt(n));

  // ── EXPORTADOR EJECUTIVO A PDF ──
  const exportExecutivePDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const emissionDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const periodName = periodLabel || curMonthName;

    // 1. Encabezado Ejecutivo Moderno
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(14, 12, 182, 24, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTEX — INFORME EJECUTIVO DE PRODUCCIÓN', 20, 22);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Periodo: ${periodName}   |   Fecha de Emisión: ${emissionDate}`, 20, 30);

    let currentY = 41;

    // Aviso si hay diseños ocultos
    if (activeHiddenDesigns.length > 0) {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(251, 191, 36);
      doc.roundedRect(14, currentY, 182, 7.5, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`* Nota: Se han excluido ${activeHiddenDesigns.length} diseño(s) del informe por filtro del usuario (${activeHiddenDesigns.slice(0, 3).join(', ')}${activeHiddenDesigns.length > 3 ? '...' : ''}).`, 18, currentY + 5);
      currentY += 11;
    }

    // 2. Cuadrícula de KPIs Ejecutivos (4 Tarjetas)
    const cardW = 43.5;
    const cardH = 21;
    const cardGap = 2.6;

    // Card 1: Tela Producida
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(14, currentY, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text('TELA PRODUCIDA', 17, currentY + 5);
    doc.setFontSize(10.5);
    doc.setTextColor(69, 26, 3);
    doc.text(`${fmtDec(kpis.totalKg * wFactor, weightUnit === 'kg' ? 2 : 0)} ${wLabel}`, 17, currentY + 11.5);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(146, 64, 14);
    doc.text(`Prom. ${fmtDec(kpis.avgKgDay * wFactor, 1)} ${wLabel}/d${hasPrevData ? ` (${kgGrowth.isUp ? '+' : ''}${kgGrowth.pct.toFixed(1)}%)` : ''}`, 17, currentY + 17);

    // Card 2: Unidades
    const x2 = 14 + cardW + cardGap;
    doc.setFillColor(224, 242, 254);
    doc.setDrawColor(56, 189, 248);
    doc.roundedRect(x2, currentY, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161);
    doc.text('UNIDADES', x2 + 3, currentY + 5);
    doc.setFontSize(10.5);
    doc.setTextColor(12, 74, 110);
    doc.text(`${fmtInt(kpis.totalUnits)} pz`, x2 + 3, currentY + 11.5);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(2, 132, 199);
    doc.text(`Prom. ${fmtInt(kpis.avgUnitsDay)} pz/d${hasPrevData ? ` (${unitsGrowth.isUp ? '+' : ''}${unitsGrowth.pct.toFixed(1)}%)` : ''}`, x2 + 3, currentY + 17);

    // Card 3: Golpes Totales
    const x3 = x2 + cardW + cardGap;
    doc.setFillColor(243, 232, 255);
    doc.setDrawColor(192, 132, 252);
    doc.roundedRect(x3, currentY, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(126, 34, 206);
    doc.text('GOLPES TOTALES', x3 + 3, currentY + 5);
    doc.setFontSize(10.5);
    doc.setTextColor(88, 28, 135);
    doc.text(`${fmtInt(kpis.totalGolpes)}`, x3 + 3, currentY + 11.5);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(147, 51, 234);
    doc.text(`En ${kpis.days} días activos${hasPrevData ? ` (${golpesGrowth.isUp ? '+' : ''}${golpesGrowth.pct.toFixed(1)}%)` : ''}`, x3 + 3, currentY + 17);

    // Card 4: Procesos
    const x4 = x3 + cardW + cardGap;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(52, 211, 153);
    doc.roundedRect(x4, currentY, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text('PROCESOS (TELA)', x4 + 3, currentY + 5);
    doc.setFontSize(8);
    doc.setTextColor(6, 78, 59);
    doc.text(`Reactivo: ${reactivoPct.toFixed(1)}%`, x4 + 3, currentY + 11);
    doc.text(`Pigmento: ${pigmentoPct.toFixed(1)}%`, x4 + 3, currentY + 17);

    currentY += cardH + 7;

    // 3. Tabla Resumen Comparativo con Mes Anterior (si existe)
    if (hasPrevData) {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Comparativa Ejecutiva: ${curMonthName} vs ${prevMonthName}`, 14, currentY);

      autoTable(doc, {
        startY: currentY + 2.5,
        head: [['Métrica de Producción', curMonthName, prevMonthName, 'Diferencia Neta', 'Variación %']],
        body: [
          [
            `Tela (${wLabel})`,
            `${fmtMetric(kpis.totalKg * wFactor)} ${wLabel}`,
            `${fmtMetric(prevKpis.totalKg * wFactor)} ${wLabel}`,
            `${kgGrowth.isUp ? '+' : ''}${fmtMetric(kgGrowth.diff * wFactor)} ${wLabel}`,
            `${kgGrowth.isUp ? '+' : '-'}${kgGrowth.pct.toFixed(1)}%`
          ],
          [
            'Unidades (Prendas / Toallas)',
            `${fmtInt(kpis.totalUnits)} pz`,
            `${fmtInt(prevKpis.totalUnits)} pz`,
            `${unitsGrowth.isUp ? '+' : ''}${fmtInt(unitsGrowth.diff)} pz`,
            `${unitsGrowth.isUp ? '+' : '-'}${unitsGrowth.pct.toFixed(1)}%`
          ],
          [
            'Golpes de Máquina',
            `${fmtInt(kpis.totalGolpes)}`,
            `${fmtInt(prevKpis.totalGolpes)}`,
            `${golpesGrowth.isUp ? '+' : ''}${fmtInt(golpesGrowth.diff)}`,
            `${golpesGrowth.isUp ? '+' : '-'}${golpesGrowth.pct.toFixed(1)}%`
          ],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          3: { fontStyle: 'bold' },
          4: { fontStyle: 'bold' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable?.finalY + 7;
    }

    // 4. Tabla de Ranking de Diseños Producidos
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Desglose de Diseños Producidos (${filteredDesignData.length} diseños activos)`, 14, currentY);

    const designTableBody = filteredDesignData.map((d, i) => {
      const pct = totalDesignsValue > 0 ? ((d.value / totalDesignsValue) * 100).toFixed(1) : '0';
      return [
        `#${i + 1}`,
        d.name,
        d.process,
        `${fmtMetric(d.value)} ${unitLabel}`,
        `${fmtInt(d.units)} pz`,
        `${fmtInt(d.golpes)}`,
        `${pct}%`
      ];
    });

    const totalVisibleKg = filteredDesignData.reduce((a, d) => a + d.value, 0);
    const totalVisibleUnits = filteredDesignData.reduce((a, d) => a + d.units, 0);
    const totalVisibleGolpes = filteredDesignData.reduce((a, d) => a + d.golpes, 0);

    designTableBody.push([
      'TOTAL',
      `${filteredDesignData.length} Diseños`,
      '—',
      `${fmtMetric(totalVisibleKg)} ${unitLabel}`,
      `${fmtInt(totalVisibleUnits)} pz`,
      `${fmtInt(totalVisibleGolpes)}`,
      '100%'
    ]);

    autoTable(doc, {
      startY: currentY + 2.5,
      head: [['#', 'Nombre del Diseño', 'Proceso', `Volumen (${unitLabel})`, 'Unidades', 'Golpes', '% Total']],
      body: designTableBody,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable?.finalY + 7;

    // 5. Tabla de Producción Diaria
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Evolución Diaria de Producción', 14, currentY);

    const dailyTableBody = timeline.map(t => [
      t.label,
      `${fmtMetric(t.Reactivo)} ${unitLabel}`,
      `${fmtMetric(t.Pigmento)} ${unitLabel}`,
      `${fmtMetric(t.total)} ${unitLabel}`,
      `${fmtMetric(t.acumulado)} ${unitLabel}`
    ]);

    autoTable(doc, {
      startY: currentY + 2.5,
      head: [['Fecha / Día', `Reactivo (${unitLabel})`, `Pigmento (${unitLabel})`, `Total Diario (${unitLabel})`, `Acumulado (${unitLabel})`]],
      body: dailyTableBody,
      theme: 'striped',
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text('CONTEX Estampación Textil — Documento confidencial de control de producción', 14, 290);
        doc.text(`Página ${data.pageNumber} de ${pageCount}`, 196, 290, { align: 'right' });
      }
    });

    const sanitized = periodName.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Informe_Produccion_CONTEX_${sanitized}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ── EXPORTADOR EJECUTIVO A EXCEL ──
  const exportExecutiveExcel = () => {
    const periodName = periodLabel || curMonthName;
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen y KPIs
    const kpiData = [
      ['CONTEX — INFORME EJECUTIVO DE PRODUCCIÓN'],
      ['Periodo:', periodName],
      ['Fecha de Emisión:', new Date().toLocaleDateString('es-ES')],
      ['Filtro Diseños Ocultos:', activeHiddenDesigns.length > 0 ? `${activeHiddenDesigns.length} diseños excluidos` : 'Ninguno'],
      [],
      ['INDICADOR', 'VALOR', 'UNIDAD', 'PROMEDIO/DÍA', 'VARIACIÓN VS MES ANTERIOR'],
      ['Tela Producida', Number((kpis.totalKg * wFactor).toFixed(2)), wLabel, Number((kpis.avgKgDay * wFactor).toFixed(2)), hasPrevData ? `${kgGrowth.isUp ? '+' : ''}${kgGrowth.pct.toFixed(1)}%` : '—'],
      ['Unidades / Prendas', kpis.totalUnits, 'pz', Math.round(kpis.avgUnitsDay), hasPrevData ? `${unitsGrowth.isUp ? '+' : ''}${unitsGrowth.pct.toFixed(1)}%` : '—'],
      ['Golpes de Máquina', kpis.totalGolpes, 'golpes', Math.round(kpis.totalGolpes / (kpis.days || 1)), hasPrevData ? `${golpesGrowth.isUp ? '+' : ''}${golpesGrowth.pct.toFixed(1)}%` : '—'],
      ['Días de Producción', kpis.days, 'días', '—', '—'],
      ['Mejor Día', kpis.bestDay ? dayLabel(kpis.bestDay) : '—', '—', `${Number((kpis.bestKg * wFactor).toFixed(2))} ${wLabel}`, '—'],
      [],
      ['DISTRIBUCIÓN POR PROCESO', 'VOLUMEN (KG)', '% PARTICIPACIÓN'],
      ['Reactivo', Number((reactivoVal).toFixed(2)), `${reactivoPct.toFixed(1)}%`],
      ['Pigmento', Number((pigmentoVal).toFixed(2)), `${pigmentoPct.toFixed(1)}%`],
      ['Total', Number((processTotal).toFixed(2)), '100%']
    ];

    const wsKpi = XLSX.utils.aoa_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKpi, 'Resumen KPIs');

    // Hoja 2: Ranking de Diseños
    const designHeaders = ['#', 'Nombre del Diseño', 'Proceso', `Volumen (${unitLabel})`, 'Unidades (pz)', 'Golpes', '% del Total'];
    const designRows = filteredDesignData.map((d, i) => [
      i + 1,
      d.name,
      d.process,
      d.value,
      d.units,
      d.golpes,
      totalDesignsValue > 0 ? Number(((d.value / totalDesignsValue) * 100).toFixed(2)) : 0
    ]);
    const wsDesigns = XLSX.utils.aoa_to_sheet([designHeaders, ...designRows]);
    XLSX.utils.book_append_sheet(wb, wsDesigns, 'Ranking Diseños');

    // Hoja 3: Producción Diaria
    const dailyHeaders = ['Día / Fecha', `Reactivo (${unitLabel})`, `Pigmento (${unitLabel})`, `Total Diario (${unitLabel})`, `Acumulado (${unitLabel})`];
    const dailyRows = timeline.map(t => [
      t.label,
      t.Reactivo,
      t.Pigmento,
      t.total,
      t.acumulado
    ]);
    const wsDaily = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Evolución Diaria');

    const sanitized = periodName.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Informe_Produccion_CONTEX_${sanitized}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-12 text-center shrink-0">
        <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-600">No hay registros de producción para el periodo seleccionado</p>
        <p className="text-xs text-slate-400 mt-1">Cambia el periodo o registra golpes en el Reporte Diario para ver las gráficas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="production-charts-view">
      {/* ── BANNER GLOBAL CUANDO HAY DISEÑOS OCULTOS ── */}
      {activeHiddenDesigns.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200/90 rounded-2xl p-3 sm:px-4 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 text-amber-950 font-bold min-w-0">
            <div className="w-7 h-7 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
              <EyeOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-amber-950">
                Filtro global activo: {activeHiddenDesigns.length} diseño{activeHiddenDesigns.length === 1 ? '' : 's'} oculto{activeHiddenDesigns.length === 1 ? '' : 's'}
              </p>
              <p className="text-[10px] text-amber-800/80 font-medium truncate">
                Todas las gráficas (Kilos por día, Reactivo vs Pigmento, Turnos y KPIs) están excluyendo los diseños ocultos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setIsDesignManagerOpen(true)}
              className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
            >
              Gestionar ({activeHiddenDesigns.length})
            </button>
            <button
              type="button"
              onClick={showAllDesigns}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
            >
              Mostrar todos
            </button>
          </div>
        </div>
      )}

      {/* ── KPIs EJECUTIVOS DE PRODUCCIÓN (CON FLECHAS DE TENDENCIA) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
        {/* Tela Producida */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/80">
              <Table className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Tela producida</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-lg sm:text-2xl font-black text-amber-950 font-mono tracking-tight">
                  {fmtDec(kpis.totalKg * wFactor, weightUnit === 'kg' ? 2 : 0)} <span className="text-xs font-bold text-amber-700">{wLabel}</span>
                </p>
              </div>
              <p className="text-[9px] text-amber-600/80 font-medium truncate">
                Prom. {fmtDec(kpis.avgKgDay * wFactor, weightUnit === 'kg' ? 1 : 0)} {wLabel}/día
              </p>
            </div>
          </div>
          {hasPrevData && (
            <div
              className={`shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-black border shadow-2xs ${
                kgGrowth.isUp
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                  : 'bg-rose-50 text-rose-800 border-rose-200/90'
              }`}
              title={`Mes anterior (${prevMonthName}): ${fmtDec(prevKpis.totalKg * wFactor, weightUnit === 'kg' ? 2 : 0)} ${wLabel} (${kgGrowth.isUp ? '+' : ''}${fmtDec(kgGrowth.diff * wFactor, weightUnit === 'kg' ? 2 : 0)} ${wLabel})`}
            >
              {kgGrowth.isUp ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{kgGrowth.isUp ? '+' : '-'}{kgGrowth.pct.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Unidades */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/80">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Unidades</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-lg sm:text-2xl font-black text-blue-700 font-mono tracking-tight">
                  {fmtInt(kpis.totalUnits)} <span className="text-xs font-bold text-blue-500">pz</span>
                </p>
              </div>
              <p className="text-[9px] text-blue-600/80 font-medium truncate">Prom. {fmtInt(kpis.avgUnitsDay)} pz/día</p>
            </div>
          </div>
          {hasPrevData && (
            <div
              className={`shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-black border shadow-2xs ${
                unitsGrowth.isUp
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                  : 'bg-rose-50 text-rose-800 border-rose-200/90'
              }`}
              title={`Mes anterior (${prevMonthName}): ${fmtInt(prevKpis.totalUnits)} pz (${unitsGrowth.isUp ? '+' : ''}${fmtInt(unitsGrowth.diff)} pz)`}
            >
              {unitsGrowth.isUp ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{unitsGrowth.isUp ? '+' : '-'}{unitsGrowth.pct.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Golpes Totales */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Golpes totales</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-lg sm:text-2xl font-black text-purple-900 font-mono tracking-tight">
                  {fmtInt(kpis.totalGolpes)}
                </p>
              </div>
              <p className="text-[9px] text-purple-600/80 font-medium truncate">En {kpis.days} día{kpis.days === 1 ? '' : 's'} de producción</p>
            </div>
          </div>
          {hasPrevData && (
            <div
              className={`shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-black border shadow-2xs ${
                golpesGrowth.isUp
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                  : 'bg-rose-50 text-rose-800 border-rose-200/90'
              }`}
              title={`Mes anterior (${prevMonthName}): ${fmtInt(prevKpis.totalGolpes)} golpes (${golpesGrowth.isUp ? '+' : ''}${fmtInt(golpesGrowth.diff)})`}
            >
              {golpesGrowth.isUp ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{golpesGrowth.isUp ? '+' : '-'}{golpesGrowth.pct.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Mejor Día */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Mejor día</p>
            <p className="text-lg sm:text-2xl font-black text-emerald-900 font-mono tracking-tight">
              {kpis.bestDay ? dayLabel(kpis.bestDay) : '-'}
            </p>
            <p className="text-[9px] text-emerald-600/80 font-medium truncate">
              {fmtDec(kpis.bestKg * wFactor, weightUnit === 'kg' ? 1 : 0)} {wLabel} de tela
            </p>
          </div>
        </div>
      </div>

      {/* ── SELECTOR DE MÉTRICA Y TOGGLE DE COMPARATIVA ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-800">
            Métrica a Graficar {periodLabel ? <span className="text-slate-400 font-semibold hidden sm:inline">· {periodLabel}</span> : null}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón para alternar visibilidad de la comparativa */}
          <button
            type="button"
            onClick={() => setShowCompare(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              showCompare
                ? 'bg-sky-50 text-sky-800 border-sky-300 shadow-2xs font-black'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
            title="Alternar comparativo día a día con el mes anterior"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Comparativa vs Mes Anterior</span>
            {hasPrevData && (
              <span className={`w-2 h-2 rounded-full ${kgGrowth.isUp ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            )}
          </button>

          {/* Selector de Métrica */}
          <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-xs font-bold">
            {(['kg', 'units', 'golpes'] as ProductionMetric[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  metric === m
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'kg' ? (weightUnit === 'kg' ? 'Kilos' : 'Gramos') : m === 'units' ? 'Unidades' : 'Golpes'}
              </button>
            ))}
          </div>

          {/* Botón Descargar Informe (PDF / Excel) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
              title="Descargar informe ejecutivo en PDF o Excel"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Descargar Informe</span>
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
            </button>

            {isExportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      exportExecutivePDF();
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-slate-50 flex items-center gap-3 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 group-hover:bg-rose-100 transition-colors shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-black text-slate-800">Informe PDF Ejecutivo</p>
                      <p className="text-[10px] text-slate-400 font-medium">Listo para imprimir con KPIs y tablas</p>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      exportExecutiveExcel();
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-slate-50 flex items-center gap-3 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100 transition-colors shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-black text-slate-800">Libro Excel (.xlsx)</p>
                      <p className="text-[10px] text-slate-400 font-medium">Resumen, ranking y días</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── COMPARADOR SUPERPUESTO DÍA A DÍA (MES ACTUAL VS MES ANTERIOR) ── */}
      {showCompare && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs shrink-0 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/80">
                <GitCompare className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-slate-900">
                    Comparativo Día a Día: <span className="text-sky-600">{curMonthName}</span> vs <span className="text-slate-500 font-semibold">{prevMonthName}</span>
                  </h3>
                  {hasPrevData && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                      kgGrowth.isUp
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {kgGrowth.isUp ? <ArrowUpRight className="w-3 h-3 stroke-[2.5]" /> : <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />}
                      {kgGrowth.isUp ? '+' : '-'}{kgGrowth.pct.toFixed(1)}% {metricMeta[metric].label}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  {compareMode === 'acumulado'
                    ? 'Curvas de carrera acumuladas día 1 al 31 · Compara el ritmo de avance a la misma fecha del mes'
                    : 'Producción diaria superpuesta para comparar picos de máquina día por día'}
                </p>
              </div>
            </div>

            {/* Selector de modo Acumulado vs Diario */}
            <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-xs font-bold ml-auto">
              <button
                type="button"
                onClick={() => setCompareMode('acumulado')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  compareMode === 'acumulado'
                    ? 'bg-white text-sky-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evolución Acumulada
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('diario')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  compareMode === 'diario'
                    ? 'bg-white text-sky-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Día por Día
              </button>
            </div>
          </div>

          {!hasPrevData ? (
            <div className="py-10 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
              <p className="font-bold text-slate-600">No se encontraron registros del mes anterior ({prevMonthName})</p>
              <p className="text-[11px] mt-0.5">El comparativo se habilitará automáticamente tan pronto haya registros en dos o más meses.</p>
            </div>
          ) : (
            <>
              {/* Tarjetas resumen del comparativo */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block truncate">Diferencia Neta ({metricMeta[metric].label})</span>
                  <p className={`text-base font-black font-mono mt-0.5 ${kgGrowth.isUp ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {kgGrowth.isUp ? '+' : ''}{fmtMetric(kgGrowth.diff * (metric === 'kg' ? wFactor : 1))} {unitLabel}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block truncate">Diferencia Unidades</span>
                  <p className={`text-base font-black font-mono mt-0.5 ${unitsGrowth.isUp ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {unitsGrowth.isUp ? '+' : ''}{fmtInt(unitsGrowth.diff)} pz
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block truncate">Total {curMonthName}</span>
                  <p className="text-base font-black font-mono text-sky-900 mt-0.5">
                    {fmtMetric(valueOf({ date: '', designName: '', process: 'REACTIVO', widthM: 0, heightM: 0, gramaje: 0, areaM2: 0, unitWeightG: 0, shift: 1, units: kpis.totalUnits, golpes: kpis.totalGolpes } as any))} {unitLabel}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block truncate">Total {prevMonthName}</span>
                  <p className="text-base font-black font-mono text-slate-600 mt-0.5">
                    {fmtMetric(valueOf({ date: '', designName: '', process: 'REACTIVO', widthM: 0, heightM: 0, gramaje: 0, areaM2: 0, unitWeightG: 0, shift: 1, units: prevKpis.totalUnits, golpes: prevKpis.totalGolpes } as any))} {unitLabel}
                  </p>
                </div>
              </div>

              {/* Gráfico superpuesto */}
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparisonTimeline} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientCurMonth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <RechartsTooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0]?.payload;
                        if (!data) return null;

                        const curVal = compareMode === 'acumulado' ? data.actualAcum : data.actual;
                        const prevVal = compareMode === 'acumulado' ? data.anteriorAcum : data.anterior;
                        const hasCur = curVal !== null && curVal !== undefined;
                        const hasPrev = prevVal !== null && prevVal !== undefined;
                        const diff = hasCur && hasPrev ? curVal - prevVal : null;
                        const diffPct = diff !== null && prevVal > 0 ? (diff / prevVal) * 100 : null;

                        return (
                          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xl text-xs space-y-1.5 min-w-[220px]">
                            <p className="font-black text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
                              <span>Día {label} del mes</span>
                              <span className="text-[10px] text-slate-400 font-normal">{compareMode === 'acumulado' ? 'Acumulado' : 'Diario'}</span>
                            </p>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sky-700 font-bold flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" />
                                {curMonthName}:
                              </span>
                              <span className="font-mono font-black text-slate-900">
                                {hasCur ? `${fmtMetric(curVal)} ${unitLabel}` : 'En curso'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                                {prevMonthName}:
                              </span>
                              <span className="font-mono font-semibold text-slate-700">
                                {hasPrev ? `${fmtMetric(prevVal)} ${unitLabel}` : 'Sin datos'}
                              </span>
                            </div>
                            {diff !== null && (
                              <div className={`pt-1.5 border-t border-slate-100 flex items-center justify-between font-bold text-[11px] ${
                                diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                <span>Diferencia:</span>
                                <span>
                                  {diff >= 0 ? '+' : ''}{fmtMetric(diff)} {unitLabel} {diffPct !== null ? `(${diff >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '8px' }} />
                    {compareMode === 'acumulado' ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey="actualAcum"
                          name={`${curMonthName} (Actual)`}
                          stroke="#0284c7"
                          strokeWidth={3}
                          fill="url(#gradientCurMonth)"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="anteriorAcum"
                          name={`${prevMonthName} (Anterior)`}
                          stroke="#94a3b8"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </>
                    ) : (
                      <>
                        <Bar
                          dataKey="actual"
                          name={`${curMonthName} (Actual)`}
                          fill="#0284c7"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={18}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="anterior"
                          name={`${prevMonthName} (Anterior)`}
                          fill="#cbd5e1"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={18}
                          isAnimationActive={false}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SERIE TEMPORAL + DISTRIBUCIÓN POR PROCESO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 shrink-0">
        {/* Gráfico diario */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/80">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {metricMeta[metric].label} {groupedByMonth ? 'por mes' : 'por día'}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Barras por proceso · línea = acumulado del periodo</p>
            </div>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <RechartsTooltip
                  contentStyle={{ ...tooltipStyle, borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  formatter={(value: any, name: any) => [`${fmtMetric(Number(value))} ${unitLabel}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '8px' }} />
                <Bar yAxisId="left" dataKey="Reactivo" stackId="p" fill={REACTIVO_COLOR} maxBarSize={32} isAnimationActive={false} />
                <Bar yAxisId="left" dataKey="Pigmento" stackId="p" fill={PIGMENTO_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="acumulado" name="Acumulado" stroke="#0f172a" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Reactivo vs Pigmento con SVG Puro (Carga instantánea, 100% centrado sin desbordes) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Reactivo vs Pigmento</h3>
              <p className="text-[10px] text-slate-400 font-medium">{metricMeta[metric].label}</p>
            </div>
          </div>

          <div className="w-full flex items-center justify-center my-2">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                {/* Círculo base de fondo */}
                <circle
                  cx="80"
                  cy="80"
                  r="54"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="20"
                />
                {/* Segmento Reactivo */}
                {processTotal > 0 && reactivoPct > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r="54"
                    fill="none"
                    stroke={REACTIVO_COLOR}
                    strokeWidth="20"
                    strokeDasharray={`${Math.max(0, (reactivoPct / 100) * 339.29 - (pigmentoPct > 0 ? 3 : 0))} 339.29`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                )}
                {/* Segmento Pigmento */}
                {processTotal > 0 && pigmentoPct > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r="54"
                    fill="none"
                    stroke={PIGMENTO_COLOR}
                    strokeWidth="20"
                    strokeDasharray={`${Math.max(0, (pigmentoPct / 100) * 339.29 - (reactivoPct > 0 ? 3 : 0))} 339.29`}
                    strokeDashoffset={`-${(reactivoPct / 100) * 339.29}`}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                )}
              </svg>

              {/* Texto Central perfectamente centrado */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total</span>
                <span className="text-base font-black font-mono text-slate-900 tracking-tight">
                  {fmtMetric(processTotal)}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{unitLabel}</span>
              </div>
            </div>
          </div>

          {/* Tarjetas informativas de los procesos */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {processData.map(d => {
              const pct = processTotal > 0 ? (d.value / processTotal) * 100 : 0;
              const isReactivo = d.name === 'Reactivo';
              return (
                <div
                  key={d.name}
                  className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
                    isReactivo
                      ? 'bg-purple-50/60 border-purple-100 text-purple-950'
                      : 'bg-amber-50/60 border-amber-100 text-amber-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                      isReactivo ? 'bg-purple-200/70 text-purple-800' : 'bg-amber-200/70 text-amber-900'
                    }`}>
                      {fmtDec(pct, 1)}%
                    </span>
                  </div>
                  <p className="text-xs font-black font-mono mt-0.5">
                    {fmtMetric(d.value)} <span className="text-[10px] font-semibold text-slate-500">{unitLabel}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── TOP DISEÑOS + POR TURNO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 shrink-0">
        {/* ── TOP DISEÑOS DINÁMICO ── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            {/* Header del Card con Controles Rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
                  <Award className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">
                    {designSortOrder === 'desc' ? 'Top diseños más producidos' : 'Diseños menos producidos'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {metricMeta[metric].label} · {designLimit > 0 ? `hasta ${designLimit} diseños` : 'todos'} ({filteredDesignData.length} visible{filteredDesignData.length === 1 ? '' : 's'}{activeHiddenDesigns.length > 0 ? ` · ${activeHiddenDesigns.length} oculto${activeHiddenDesigns.length === 1 ? '' : 's'}` : ''})
                  </p>
                </div>
              </div>

              {/* Botones de acción en la cabecera */}
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                {/* Selector de Top N */}
                <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold">
                  {[5, 10, 20, 0].map(limit => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setDesignLimit(limit)}
                      className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                        designLimit === limit
                          ? 'bg-white text-blue-700 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {limit === 0 ? 'Todos' : `Top ${limit}`}
                    </button>
                  ))}
                </div>

                {/* Invertir Orden (Desc/Asc) */}
                <button
                  type="button"
                  onClick={() => setDesignSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="p-1.5 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title={designSortOrder === 'desc' ? 'Orden actual: Más producidos a menos. Clic para invertir' : 'Orden actual: Menos producidos a más. Clic para invertir'}
                >
                  {designSortOrder === 'desc' ? (
                    <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpNarrowWide className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </button>

                {/* Botón Gestión / Ocultar Diseños */}
                <button
                  type="button"
                  onClick={() => setIsDesignManagerOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    activeHiddenDesigns.length > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-slate-100'
                  }`}
                  title="Configurar qué diseños ocultar o mostrar"
                >
                  {activeHiddenDesigns.length > 0 ? (
                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Ocultar diseños</span>
                  {activeHiddenDesigns.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                      {activeHiddenDesigns.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-barra: Búsqueda rápida y Filtro por Proceso */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1 min-w-[130px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={designSearch}
                  onChange={e => setDesignSearch(e.target.value)}
                  placeholder="Buscar diseño..."
                  className="w-full pl-8 pr-7 py-1 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-400 focus:bg-white focus:outline-none transition-all"
                />
                {designSearch && (
                  <button
                    type="button"
                    onClick={() => setDesignSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filtro de proceso */}
              <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold shrink-0">
                {(['all', 'REACTIVO', 'PIGMENTO'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDesignProcessFilter(p)}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                      designProcessFilter === p
                        ? 'bg-white text-blue-700 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p === 'all' ? 'Todos' : p === 'REACTIVO' ? 'Reactivo' : 'Pigmento'}
                  </button>
                ))}
              </div>
            </div>

            {/* Chips de diseños actualmente ocultos */}
            {activeHiddenDesigns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs mb-3">
                <div className="flex items-center gap-1 text-amber-800 font-bold shrink-0 text-[11px]">
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ocultos ({activeHiddenDesigns.length}):</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 max-h-16 overflow-y-auto no-scrollbar">
                  {activeHiddenDesigns.map(name => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-900 text-[10px] font-bold shadow-2xs"
                    >
                      <span className="truncate max-w-[130px]">{name}</span>
                      <button
                        type="button"
                        onClick={() => toggleHideDesign(name)}
                        title={`Mostrar "${name}"`}
                        className="text-amber-500 hover:text-red-600 cursor-pointer p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={showAllDesigns}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline ml-auto shrink-0 cursor-pointer"
                >
                  Mostrar todos
                </button>
              </div>
            )}
          </div>

          {/* Gráfico o Estado Vacío */}
          {filteredDesignData.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 my-2">
              <EyeOff className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-600">No hay diseños para mostrar</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {designSearch ? 'Ningún diseño coincide con la búsqueda' : 'Todos los diseños seleccionados están ocultos'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                {activeHiddenDesigns.length > 0 && (
                  <button
                    type="button"
                    onClick={showAllDesigns}
                    className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Mostrar todos los diseños ({activeHiddenDesigns.length} ocultos)
                  </button>
                )}
                {designSearch && (
                  <button
                    type="button"
                    onClick={() => setDesignSearch('')}
                    className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full overflow-y-auto no-scrollbar" style={{ maxHeight: filteredDesignData.length > 10 ? 460 : undefined }}>
              <div style={{ height: Math.max(220, filteredDesignData.length * 36) }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredDesignData} layout="vertical" margin={{ top: 0, right: 55, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      width={115}
                      tick={{ fontSize: 9, fill: '#334155', fontWeight: 800 }}
                    />
                    <RechartsTooltip
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload || !payload.length) return null;
                        const item = payload[0].payload;
                        const pct = totalDesignsValue > 0 ? ((item.value / totalDesignsValue) * 100).toFixed(1) : '0';
                        const isReactivo = item.process === 'REACTIVO';

                        return (
                          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xl text-xs space-y-1.5 min-w-[210px] pointer-events-none">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                              <p className="font-black text-slate-800 uppercase tracking-wide truncate max-w-[150px]" title={item.name}>
                                {item.name}
                              </p>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${
                                isReactivo ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {item.process || 'General'}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between pt-0.5">
                              <span className="text-slate-500 font-semibold">{metricMeta[metric].label}:</span>
                              <span className="font-mono font-black text-slate-900 text-sm">
                                {fmtMetric(item.value)} <span className="text-[10px] text-slate-500">{unitLabel}</span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                              <span>% del total de diseños:</span>
                              <span className="font-bold text-blue-600">{pct}%</span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1.5 font-medium">
                              <EyeOff className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>Haz clic en la barra para ocultar</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                      barSize={16}
                      isAnimationActive={false}
                      label={{
                        position: 'right',
                        fontSize: 9,
                        fill: '#475569',
                        fontWeight: 700,
                        formatter: (v: any) => fmtMetric(Number(v))
                      }}
                    >
                      {filteredDesignData.map((d, i) => (
                        <Cell
                          key={d.name || i}
                          fill={DESIGN_COLORS[i % DESIGN_COLORS.length]}
                          className="cursor-pointer hover:opacity-85 transition-opacity"
                          onClick={() => toggleHideDesign(d.name)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>💡 Haz clic en una barra para ocultar ese diseño rápidamente</span>
            {activeHiddenDesigns.length > 0 && (
              <button
                type="button"
                onClick={showAllDesigns}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Restablecer todos los ocultos
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/80">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Producción por turno</h3>
              <p className="text-[10px] text-slate-400 font-medium">{metricMeta[metric].label}</p>
            </div>
          </div>
          <div className="h-56 sm:h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shiftData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ ...tooltipStyle, borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  formatter={(value: any) => [`${fmtMetric(Number(value))} ${unitLabel}`, metricMeta[metric].label]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                  {shiftData.map((d, i) => <Cell key={i} fill={SHIFT_COLORS[(d.shift - 1) % SHIFT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {/* ── MODAL DE GESTIÓN Y VISIBILIDAD DE DISEÑOS ── */}
      {isDesignManagerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsDesignManagerOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Configurar visibilidad de diseños</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Elige qué diseños mostrar u ocultar en la gráfica
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDesignManagerOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Toolbar: Búsqueda y Filtros */}
            <div className="p-3.5 border-b border-slate-100 bg-white space-y-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[170px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                    placeholder="Buscar por nombre de diseño..."
                    className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                  {modalSearch && (
                    <button
                      type="button"
                      onClick={() => setModalSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 text-[11px] font-bold">
                  {(['all', 'REACTIVO', 'PIGMENTO'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModalProcessFilter(p)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        modalProcessFilter === p
                          ? 'bg-white text-blue-700 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p === 'all' ? 'Todos' : p === 'REACTIVO' ? 'Reactivo' : 'Pigmento'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botones de acción rápida */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={showAllDesigns}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-slate-500" />
                    Mostrar todos
                  </button>
                  <button
                    type="button"
                    onClick={hideAllDesigns}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <EyeOff className="w-3 h-3 text-slate-500" />
                    Ocultar todos
                  </button>
                  <button
                    type="button"
                    onClick={invertHiddenDesigns}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    Invertir
                  </button>
                </div>

                <span className="text-[11px] font-bold text-slate-500">
                  {allDesigns.length - activeHiddenDesigns.length} de {allDesigns.length} visibles
                </span>
              </div>
            </div>

            {/* Lista de diseños con toggle individual */}
            <div className="overflow-y-auto p-2 sm:p-3 space-y-1 custom-scrollbar flex-1 max-h-[360px]">
              {modalDesignsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  No se encontraron diseños con ese filtro.
                </div>
              ) : (
                modalDesignsList.map(d => {
                  const isHidden = hiddenDesigns.includes(d.name);
                  const isReactivo = d.process === 'REACTIVO';
                  const pct = totalDesignsValue > 0 ? ((d.value / totalDesignsValue) * 100).toFixed(1) : '0';

                  return (
                    <div
                      key={d.name}
                      onClick={() => toggleHideDesign(d.name)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isHidden
                          ? 'bg-slate-50/70 border-slate-200/60 opacity-60 hover:opacity-100 hover:bg-slate-100'
                          : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          isHidden
                            ? 'border border-slate-300 bg-white text-transparent'
                            : 'bg-blue-600 text-white'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold uppercase truncate ${isHidden ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                            {d.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                              isReactivo ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.process}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {d.count} registro{d.count === 1 ? '' : 's'} · {pct}% del total
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono text-xs font-black text-slate-800">
                          {fmtMetric(d.value)} <span className="text-[10px] font-semibold text-slate-400">{unitLabel}</span>
                        </span>
                        <div
                          title={isHidden ? 'Clic para mostrar' : 'Clic para ocultar'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isHidden ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={showAllDesigns}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Mostrar todos
              </button>
              <button
                type="button"
                onClick={() => setIsDesignManagerOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Listo ({allDesigns.length - activeHiddenDesigns.length} visibles)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
