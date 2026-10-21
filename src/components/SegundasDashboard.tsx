import { useState, useMemo } from 'react';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, TrendingDown,
  Layers, Search, FileSpreadsheet, FileText, Plus, X, Edit2, Trash2,
  BarChart3, RotateCcw, Upload, Eye, Activity, ArrowUpDown,
  Calendar, ChevronLeft, ChevronRight, GitCompare, Check, Zap,
  SlidersHorizontal, CheckSquare, Square, LayoutGrid, Table2,
  Award, ArrowDownWideNarrow, ArrowUpNarrowWide, EyeOff,
  Scissors, AlertCircle, Factory, Info
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend, ComposedChart, Line
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SegundasRecord } from '../types';
import { loadSegundasRecords, saveSegundasRecords, INITIAL_SEGUNDAS_RECORDS, inferTecnica } from '../lib/segundasData';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DESIGN_COLORS = [
  '#0ea5e9', // Sky (Azul cielo)
  '#6366f1', // Indigo (Morado índigo)
  '#10b981', // Emerald (Verde esmeralda)
  '#f59e0b', // Amber (Ámbar)
  '#ec4899', // Pink (Rosa)
  '#14b8a6', // Teal (Turquesa)
  '#ef4444', // Red (Rojo)
  '#8b5cf6', // Violet (Violeta)
  '#84cc16', // Lime (Verde lima)
  '#f97316', // Orange (Naranja)
];

const DEFECT_COLORS = [
  '#ef4444', // Manchas
  '#f97316', // Falta Pintura
  '#f59e0b', // Repise
  '#8b5cf6', // Grasa
  '#3b82f6', // Penetración
  '#06b6d4', // Descases
  '#ec4899', // Quemadas
  '#64748b', // Logos Corridos
];

const REF_COLORS: Record<string, string> = {
  'C280T': '#3b82f6',  // Azul
  'ME1002': '#8b5cf6', // Morado
  'ML1002': '#f59e0b', // Ámbar
};

const fmtInt = (n: number) => Math.round(n || 0).toLocaleString('es-CO');
const fmtPct = (n: number, d = 2) => `${((n || 0) * 100).toFixed(d)}%`;

export function normalizeExcelDate(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    // Serial number de Excel (días desde 1899-12-30)
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
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

export function getRecordFingerprint(r: SegundasRecord): string {
  const f = normalizeExcelDate(r.fecha);
  const d = (r.diseno || '').trim().toUpperCase();
  const ref = (r.referencia || '').trim().toUpperCase();
  const rev = Number(r.cantTotalRevisada || 0);
  const ok = Number(r.cantBuena || 0);
  const col = (r.color || '').trim().toUpperCase();
  const revs = (r.revisadoras || '').trim().toUpperCase();
  return `${f}|${d}|${ref}|${col}|${rev}|${ok}|${revs}`;
}

function getTopDefect(r: SegundasRecord): { name: string; count: number } | null {
  if (!r.defectosEstampado) return null;
  const list = [
    { name: 'Manchas', count: r.defectosEstampado.manchas },
    { name: 'Falta Pintura', count: r.defectosEstampado.faltaPintura },
    { name: 'Repise', count: r.defectosEstampado.repise },
    { name: 'Grasa', count: r.defectosEstampado.grasa },
    { name: 'Penetración', count: r.defectosEstampado.penetracion },
    { name: 'Descases', count: r.defectosEstampado.descases },
    { name: 'Quemadas', count: r.defectosEstampado.quemadas },
    { name: 'Logos Corridos', count: r.defectosEstampado.logosCorridos },
  ].filter(d => d.count > 0);
  list.sort((a, b) => b.count - a.count);
  return list[0] || null;
}

function getDefectsSummary(r: SegundasRecord): string {
  if (!r.defectosEstampado) return 'Sin defectos';
  const list = [
    r.defectosEstampado.manchas ? `Manchas: ${r.defectosEstampado.manchas}` : null,
    r.defectosEstampado.faltaPintura ? `Pintura: ${r.defectosEstampado.faltaPintura}` : null,
    r.defectosEstampado.repise ? `Repise: ${r.defectosEstampado.repise}` : null,
    r.defectosEstampado.grasa ? `Grasa: ${r.defectosEstampado.grasa}` : null,
    r.defectosEstampado.penetracion ? `Penetración: ${r.defectosEstampado.penetracion}` : null,
    r.defectosEstampado.descases ? `Descases: ${r.defectosEstampado.descases}` : null,
    r.defectosEstampado.quemadas ? `Quemadas: ${r.defectosEstampado.quemadas}` : null,
    r.defectosEstampado.logosCorridos ? `Logos: ${r.defectosEstampado.logosCorridos}` : null,
  ].filter(Boolean);
  return list.join(' · ') || 'Sin defectos';
}

export default function SegundasDashboard() {
  const [records, setRecords] = useState<SegundasRecord[]>(() => loadSegundasRecords());
  const [subView, setSubView] = useState<'resumen' | 'fallas_ref' | 'planilla' | 'pareto'>('resumen');
  
  // ── Filtros de Tiempo y Selección ──
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'year'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(7); // Agosto (0-indexed 7) por defecto
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [tecnicaFilter, setTecnicaFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');
  const [referenciaFilter, setReferenciaFilter] = useState<string>('all'); // Base de tela (C280T, ME1002, ML1002)
  const [disenoFilter, setDisenoFilter] = useState<string>('all'); // Diseño (Referencia en el taller)

  // ── Estados de la Vista Diagnóstico de Fallas por Diseño (Referencia) ──
  const [fallasDesignSearch, setFallasDesignSearch] = useState<string>('');
  const [fallasViewMode, setFallasViewMode] = useState<'cards' | 'chart' | 'matrix'>('cards');
  const [fallasSortBy, setFallasSortBy] = useState<'fallas' | 'revisadas' | 'pct' | 'nombre'>('fallas');
  const [showTelaComparison, setShowTelaComparison] = useState<boolean>(false);

  // ── Estados de Top Diseños Dinámico (Debajo del Gráfico de Comparativa) ──
  const [topDesignMetric, setTopDesignMetric] = useState<'segundas' | 'estampado' | 'revisadas' | 'pctSegundas'>('segundas');
  const [topDesignLimit, setTopDesignLimit] = useState<number>(10);
  const [topDesignSortOrder, setTopDesignSortOrder] = useState<'desc' | 'asc'>('desc');
  const [topDesignSearch, setTopDesignSearch] = useState<string>('');
  const [topDesignProcessFilter, setTopDesignProcessFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');
  const [hiddenTopDesigns, setHiddenTopDesigns] = useState<string[]>([]);
  const [isDesignManagerOpen, setIsDesignManagerOpen] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalProcessFilter, setModalProcessFilter] = useState<'all' | 'REACTIVO' | 'PIGMENTO'>('all');

  // Filtros de Planilla y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'optimo' | 'alerta' | 'critico'>('all');
  const [sortBy, setSortBy] = useState<'fecha' | 'revisadas' | 'pctEstampado' | 'totalSegundas'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [comparativaGrouping, setComparativaGrouping] = useState<'dia' | 'diseno'>('dia');
  const [showAllDefectColumns, setShowAllDefectColumns] = useState<boolean>(false);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SegundasRecord | null>(null);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<SegundasRecord | null>(null);

  // ── Feedback y Notificaciones Visuales (Reemplazo moderno de alert) ──
  const [toast, setToast] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message?: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = String(Date.now());
    setToast({ id, type, title, message });
    setTimeout(() => {
      setToast(curr => (curr?.id === id ? null : curr));
    }, 4500);
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // ── Estado del Modal de Carga Periódica (Acumular Historial vs Reemplazar) ──
  const [importPending, setImportPending] = useState<{
    fileName: string;
    importedRecords: SegundasRecord[];
    detectedMonths: { key: string; label: string; count: number; month: number; year: number }[];
    newRecords: SegundasRecord[];
    duplicatesCount: number;
  } | null>(null);

  // Form State
  const [formFecha, setFormFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [formRevisadoras, setFormRevisadoras] = useState('');
  const [formReferencia, setFormReferencia] = useState('');
  const [formDimensiones, setFormDimensiones] = useState('');
  const [formDiseno, setFormDiseno] = useState('');
  const [formColor, setFormColor] = useState('EST');
  const [formTecnica, setFormTecnica] = useState<'REACTIVO' | 'PIGMENTO'>('REACTIVO');
  const [formTotalRevisada, setFormTotalRevisada] = useState<number>(1000);
  const [formCantBuena, setFormCantBuena] = useState<number>(850);
  const [formPegas, setFormPegas] = useState<number>(30);
  const [formArrLat, setFormArrLat] = useState<number>(50);
  const [formArrCab, setFormArrCab] = useState<number>(40);
  const [formManchas, setFormManchas] = useState<number>(15);
  const [formRepise, setFormRepise] = useState<number>(5);
  const [formFaltaPintura, setFormFaltaPintura] = useState<number>(5);
  const [formLogosCorridos, setFormLogosCorridos] = useState<number>(0);
  const [formPenetracion, setFormPenetracion] = useState<number>(2);
  const [formGrasa, setFormGrasa] = useState<number>(2);
  const [formDescases, setFormDescases] = useState<number>(1);
  const [formQuemadas, setFormQuemadas] = useState<number>(0);
  const [formObservaciones, setFormObservaciones] = useState('');

  const updateRecords = (newRecords: SegundasRecord[]) => {
    setRecords(newRecords);
    saveSegundasRecords(newRecords);
  };

  // Navegación de meses
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // Lista única de telas base en los datos (C280T, ME1002, ML1002)
  const availableReferences = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.referencia) set.add(r.referencia.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [records]);

  // Lista única de Diseños (Referencias de taller) en los datos
  const availableDisenos = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.diseno) set.add(r.diseno.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [records]);

  // ── Meses disponibles con datos en todo el historial acumulado ──
  const availableMonthsInRecords = useMemo(() => {
    const map: Record<string, { label: string; month: number; year: number; count: number }> = {};
    records.forEach(r => {
      const f = normalizeExcelDate(r.fecha);
      const parts = f.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
          const key = `${y}-${m}`;
          if (!map[key]) {
            map[key] = { label: `${MONTH_NAMES[m]} ${y}`, month: m, year: y, count: 0 };
          }
          map[key].count++;
        }
      }
    });
    return Object.values(map).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
  }, [records]);

  // ── FILTRADO POR TIEMPO, TÉCNICA, DISEÑO Y TELA BASE ──
  const timeFilteredRecords = useMemo(() => {
    return records.filter(r => {
      // Filtro de técnica
      const tecnica = r.tecnica || inferTecnica(r.diseno, r.referencia);
      if (tecnicaFilter !== 'all' && tecnica !== tecnicaFilter) return false;

      // Filtro de tela base (referencia textil: C280T, ME1002, ML1002)
      if (referenciaFilter !== 'all' && (r.referencia || '').trim().toUpperCase() !== referenciaFilter.toUpperCase()) return false;

      // Filtro de diseño (referencia de taller: C MINNIE, NAVIDAD ANDU, etc.)
      if (disenoFilter !== 'all' && (r.diseno || '').trim().toUpperCase() !== disenoFilter.toUpperCase()) return false;

      // Filtro de tiempo
      if (timeFilter === 'all') return true;

      if (!r.fecha) return false;
      const normalized = normalizeExcelDate(r.fecha);
      const parts = normalized.split('-');
      if (parts.length < 2) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-indexed

      if (timeFilter === 'year') {
        return y === selectedYear;
      }
      if (timeFilter === 'month') {
        return y === selectedYear && m === selectedMonth;
      }

      return true;
    });
  }, [records, timeFilter, selectedMonth, selectedYear, tecnicaFilter, referenciaFilter, disenoFilter]);

  // ── Registros activos (excluyendo diseños ocultos en el Top) ──
  // Afecta a: Gráfica comparativa, KPIs, Matriz Pareto y Diagnóstico de fallas
  const visibleRecords = useMemo(() => {
    if (hiddenTopDesigns.length === 0) return timeFilteredRecords;
    const hiddenSet = new Set(hiddenTopDesigns.map(s => s.trim().toUpperCase()));
    return timeFilteredRecords.filter(r => !hiddenSet.has((r.diseno || '').trim().toUpperCase()));
  }, [timeFilteredRecords, hiddenTopDesigns]);

  // Cálculos Ejecutivos Globales del periodo seleccionado
  const totals = useMemo(() => {
    return visibleRecords.reduce(
      (acc, r) => {
        acc.revisada += r.cantTotalRevisada || 0;
        acc.buena += r.cantBuena || 0;
        acc.pegas += r.pegas || 0;
        acc.arreLaterales += r.arreLaterales || 0;
        acc.arreCabeceras += r.arreCabeceras || 0;
        acc.estampado += r.defectosEstampado?.totalEstampado || 0;
        acc.manchas += r.defectosEstampado?.manchas || 0;
        acc.repise += r.defectosEstampado?.repise || 0;
        acc.faltaPintura += r.defectosEstampado?.faltaPintura || 0;
        acc.logosCorridos += r.defectosEstampado?.logosCorridos || 0;
        acc.penetracion += r.defectosEstampado?.penetracion || 0;
        acc.grasa += r.defectosEstampado?.grasa || 0;
        acc.descases += r.defectosEstampado?.descases || 0;
        acc.quemadas += r.defectosEstampado?.quemadas || 0;
        
        const seg = r.totalSegundas || (r.pegas + r.arreLaterales + r.arreCabeceras + (r.defectosEstampado?.totalEstampado || 0));
        acc.totalSegundas += seg;

        const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);
        if (tec === 'REACTIVO') {
          acc.reactivoRevisada += r.cantTotalRevisada || 0;
          acc.reactivoBuenas += r.cantBuena || 0;
          acc.reactivoSegundas += seg;
        } else {
          acc.pigmentoRevisada += r.cantTotalRevisada || 0;
          acc.pigmentoBuenas += r.cantBuena || 0;
          acc.pigmentoSegundas += seg;
        }

        return acc;
      },
      {
        revisada: 0,
        buena: 0,
        pegas: 0,
        arreLaterales: 0,
        arreCabeceras: 0,
        estampado: 0,
        manchas: 0,
        repise: 0,
        faltaPintura: 0,
        logosCorridos: 0,
        penetracion: 0,
        grasa: 0,
        descases: 0,
        quemadas: 0,
        totalSegundas: 0,
        reactivoRevisada: 0,
        reactivoBuenas: 0,
        reactivoSegundas: 0,
        pigmentoRevisada: 0,
        pigmentoBuenas: 0,
        pigmentoSegundas: 0,
      }
    );
  }, [visibleRecords]);

  // Segundas generadas en otros procesos (Tintorería, Tejeduría, etc.)
  const segundasOtrosProcesos = Math.max(0, totals.revisada - (totals.buena + totals.totalSegundas));
  const pctGlobalBuena = totals.revisada > 0 ? totals.buena / totals.revisada : 0;
  const pctGlobalSegundas = totals.revisada > 0 ? totals.totalSegundas / totals.revisada : 0;
  const pctGlobalOtrosProcesos = totals.revisada > 0 ? segundasOtrosProcesos / totals.revisada : 0;
  const pctGlobalEstampado = totals.revisada > 0 ? totals.estampado / totals.revisada : 0;
  const pctGlobalLaterales = totals.revisada > 0 ? totals.arreLaterales / totals.revisada : 0;
  const pctGlobalCabeceras = totals.revisada > 0 ? totals.arreCabeceras / totals.revisada : 0;
  const pctGlobalPegas = totals.revisada > 0 ? totals.pegas / totals.revisada : 0;

  // ── DESGLOSE Y DIAGNÓSTICO DE FALLAS POR REFERENCIA ──
  const defectsByReference = useMemo(() => {
    const map = new Map<string, {
      referencia: string;
      dimensiones: string;
      tecnica: string;
      totalRevisadas: number;
      totalBuenas: number;
      totalSegundas: number;
      totalEstampado: number;
      manchas: number;
      faltaPintura: number;
      repise: number;
      grasa: number;
      penetracion: number;
      descases: number;
      quemadas: number;
      logosCorridos: number;
      pegas: number;
      arreLaterales: number;
      arreCabeceras: number;
      disenos: string[];
      topDefectoEstampado: string;
      topDefectoEstampadoCant: number;
      topDefectoPct: number;
    }>();

    visibleRecords.forEach(r => {
      const ref = r.referencia || 'Sin Ref';
      const existing = map.get(ref) || {
        referencia: ref,
        dimensiones: r.dimensiones || '',
        tecnica: r.tecnica || inferTecnica(r.diseno, r.referencia),
        totalRevisadas: 0,
        totalBuenas: 0,
        totalSegundas: 0,
        totalEstampado: 0,
        manchas: 0,
        faltaPintura: 0,
        repise: 0,
        grasa: 0,
        penetracion: 0,
        descases: 0,
        quemadas: 0,
        logosCorridos: 0,
        pegas: 0,
        arreLaterales: 0,
        arreCabeceras: 0,
        disenos: [],
        topDefectoEstampado: '',
        topDefectoEstampadoCant: 0,
        topDefectoPct: 0
      };

      existing.totalRevisadas += r.cantTotalRevisada || 0;
      existing.totalBuenas += r.cantBuena || 0;
      existing.totalSegundas += r.totalSegundas || 0;
      existing.totalEstampado += r.defectosEstampado?.totalEstampado || 0;
      existing.manchas += r.defectosEstampado?.manchas || 0;
      existing.faltaPintura += r.defectosEstampado?.faltaPintura || 0;
      existing.repise += r.defectosEstampado?.repise || 0;
      existing.grasa += r.defectosEstampado?.grasa || 0;
      existing.penetracion += r.defectosEstampado?.penetracion || 0;
      existing.descases += r.defectosEstampado?.descases || 0;
      existing.quemadas += r.defectosEstampado?.quemadas || 0;
      existing.logosCorridos += r.defectosEstampado?.logosCorridos || 0;
      existing.pegas += r.pegas || 0;
      existing.arreLaterales += r.arreLaterales || 0;
      existing.arreCabeceras += r.arreCabeceras || 0;

      if (r.diseno && !existing.disenos.includes(r.diseno)) {
        existing.disenos.push(r.diseno);
      }

      map.set(ref, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalRevisadas - a.totalRevisadas)
      .map(item => {
        const defects = [
          { name: 'Manchas', cant: item.manchas },
          { name: 'Falta Pintura', cant: item.faltaPintura },
          { name: 'Repise', cant: item.repise },
          { name: 'Grasa', cant: item.grasa },
          { name: 'Penetración', cant: item.penetracion },
          { name: 'Descases', cant: item.descases },
          { name: 'Quemadas', cant: item.quemadas },
          { name: 'Logos Corridos', cant: item.logosCorridos },
        ].sort((a, b) => b.cant - a.cant);

        const top = defects[0] || { name: 'Sin defectos', cant: 0 };
        const pct = item.totalEstampado > 0 ? (top.cant / item.totalEstampado) * 100 : 0;

        return {
          ...item,
          topDefectoEstampado: top.name,
          topDefectoEstampadoCant: top.cant,
          topDefectoPct: Number(pct.toFixed(1))
        };
      });
  }, [visibleRecords]);

  // Gráfico de tipos de fallas comparando referencias
  const fallasPorRefChartData = useMemo(() => {
    return [
      {
        tipo: 'Manchas',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.manchas]))
      },
      {
        tipo: 'Falta Pintura',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.faltaPintura]))
      },
      {
        tipo: 'Repise',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.repise]))
      },
      {
        tipo: 'Grasa',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.grasa]))
      },
      {
        tipo: 'Penetración',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.penetracion]))
      },
      {
        tipo: 'Descases',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.descases]))
      },
      {
        tipo: 'Quemadas',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.quemadas]))
      },
      {
        tipo: 'Logos Corridos',
        ...Object.fromEntries(defectsByReference.map(d => [d.referencia, d.logosCorridos]))
      },
    ];
  }, [defectsByReference]);

  // ── DESGLOSE Y DIAGNÓSTICO DE FALLAS POR DISEÑO (REFERENCIA EN TALLER) ──
  const defectsByDesign = useMemo(() => {
    const map = new Map<string, {
      diseno: string;
      referencia: string;
      dimensiones: string;
      tecnica: 'REACTIVO' | 'PIGMENTO';
      totalRevisadas: number;
      totalBuenas: number;
      totalSegundas: number;
      totalEstampado: number;
      manchas: number;
      faltaPintura: number;
      repise: number;
      grasa: number;
      penetracion: number;
      descases: number;
      quemadas: number;
      logosCorridos: number;
      pegas: number;
      arreLaterales: number;
      arreCabeceras: number;
      lotesCount: number;
    }>();

    visibleRecords.forEach(r => {
      const dis = (r.diseno || 'SIN DISEÑO').trim().toUpperCase();
      const existing = map.get(dis) || {
        diseno: dis,
        referencia: r.referencia || 'C280T',
        dimensiones: r.dimensiones || '',
        tecnica: (r.tecnica || inferTecnica(r.diseno, r.referencia)) as 'REACTIVO' | 'PIGMENTO',
        totalRevisadas: 0,
        totalBuenas: 0,
        totalSegundas: 0,
        totalEstampado: 0,
        manchas: 0,
        faltaPintura: 0,
        repise: 0,
        grasa: 0,
        penetracion: 0,
        descases: 0,
        quemadas: 0,
        logosCorridos: 0,
        pegas: 0,
        arreLaterales: 0,
        arreCabeceras: 0,
        lotesCount: 0,
      };

      existing.totalRevisadas += r.cantTotalRevisada || 0;
      existing.totalBuenas += r.cantBuena || 0;
      existing.totalSegundas += r.totalSegundas || 0;
      existing.totalEstampado += r.defectosEstampado?.totalEstampado || 0;
      existing.manchas += r.defectosEstampado?.manchas || 0;
      existing.faltaPintura += r.defectosEstampado?.faltaPintura || 0;
      existing.repise += r.defectosEstampado?.repise || 0;
      existing.grasa += r.defectosEstampado?.grasa || 0;
      existing.penetracion += r.defectosEstampado?.penetracion || 0;
      existing.descases += r.defectosEstampado?.descases || 0;
      existing.quemadas += r.defectosEstampado?.quemadas || 0;
      existing.logosCorridos += r.defectosEstampado?.logosCorridos || 0;
      existing.pegas += r.pegas || 0;
      existing.arreLaterales += r.arreLaterales || 0;
      existing.arreCabeceras += r.arreCabeceras || 0;
      existing.lotesCount += 1;

      map.set(dis, existing);
    });

    return Array.from(map.values()).map(item => {
      const defs = [
        { name: 'Manchas', cant: item.manchas, color: DEFECT_COLORS[0] },
        { name: 'Falta Pintura', cant: item.faltaPintura, color: DEFECT_COLORS[1] },
        { name: 'Repise', cant: item.repise, color: DEFECT_COLORS[2] },
        { name: 'Grasa', cant: item.grasa, color: DEFECT_COLORS[3] },
        { name: 'Penetración', cant: item.penetracion, color: DEFECT_COLORS[4] },
        { name: 'Descases', cant: item.descases, color: DEFECT_COLORS[5] },
        { name: 'Quemadas', cant: item.quemadas, color: DEFECT_COLORS[6] },
        { name: 'Logos Corridos', cant: item.logosCorridos, color: DEFECT_COLORS[7] },
      ]
        .filter(d => d.cant > 0)
        .sort((a, b) => b.cant - a.cant)
        .map(d => ({
          ...d,
          pct: item.totalEstampado > 0 ? Number(((d.cant / item.totalEstampado) * 100).toFixed(1)) : 0
        }));

      const top = defs[0] || { name: 'Sin defectos directos', cant: 0, pct: 0, color: '#10b981' };
      const pctEst = item.totalRevisadas > 0 ? (item.totalEstampado / item.totalRevisadas) * 100 : 0;
      const pctBue = item.totalRevisadas > 0 ? (item.totalBuenas / item.totalRevisadas) * 100 : 0;

      return {
        ...item,
        topDefectoEstampado: top.name,
        topDefectoEstampadoCant: top.cant,
        topDefectoPct: top.pct,
        defectos: defs,
        pctEstampado: Number(pctEst.toFixed(2)),
        pctBuenas: Number(pctBue.toFixed(1)),
      };
    });
  }, [visibleRecords]);

  // Filtrado y ordenación de Diseños para la vista de Fallas
  const filteredDefectsByDesign = useMemo(() => {
    return defectsByDesign
      .filter(d => {
        if (!fallasDesignSearch) return true;
        const q = fallasDesignSearch.toLowerCase();
        return d.diseno.toLowerCase().includes(q) || d.referencia.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (fallasSortBy === 'fallas') return b.totalEstampado - a.totalEstampado;
        if (fallasSortBy === 'revisadas') return b.totalRevisadas - a.totalRevisadas;
        if (fallasSortBy === 'pct') return b.pctEstampado - a.pctEstampado;
        if (fallasSortBy === 'nombre') return a.diseno.localeCompare(b.diseno);
        return b.totalEstampado - a.totalEstampado;
      });
  }, [defectsByDesign, fallasDesignSearch, fallasSortBy]);

  // Datos para el gráfico comparativo de fallas por diseño
  const fallasPorDisenoChartData = useMemo(() => {
    return filteredDefectsByDesign
      .filter(d => d.totalEstampado > 0)
      .slice(0, 12)
      .map(d => ({
        diseno: d.diseno,
        tecnica: d.tecnica,
        'Manchas': d.manchas,
        'Falta Pintura': d.faltaPintura,
        'Repise': d.repise,
        'Grasa': d.grasa,
        'Penetración': d.penetracion,
        'Descases': d.descases,
        'Quemadas': d.quemadas,
        'Logos Corridos': d.logosCorridos,
        totalEstampado: d.totalEstampado,
      }));
  }, [filteredDefectsByDesign]);

  // Opciones de Métrica para el Top Diseños de Calidad
  const TOP_DESIGN_METRICS = [
    { id: 'segundas' as const, label: 'Segundas Totales', unit: 'pz' },
    { id: 'estampado' as const, label: 'Fallas Estampación', unit: 'pz' },
    { id: 'revisadas' as const, label: 'Total Revisadas', unit: 'pz' },
    { id: 'pctSegundas' as const, label: '% de Segundas', unit: '%' },
  ];

  // ── TOP DISEÑOS DINÁMICO PARA EL DASHBOARD COMPARATIVO ──
  const allTopDesigns = useMemo(() => {
    const map = new Map<string, {
      name: string;
      process: 'REACTIVO' | 'PIGMENTO';
      referencia: string;
      totalSegundas: number;
      defectosEstampado: number;
      totalRevisadas: number;
      buenas: number;
      pctSegundas: number;
      topDefecto: string;
      topDefectoCant: number;
      count: number;
    }>();

    timeFilteredRecords.forEach(r => {
      const name = (r.diseno || 'SIN DISEÑO').trim().toUpperCase();
      const existing = map.get(name) || {
        name,
        process: (r.tecnica || inferTecnica(r.diseno, r.referencia)) as 'REACTIVO' | 'PIGMENTO',
        referencia: r.referencia || '',
        totalSegundas: 0,
        defectosEstampado: 0,
        totalRevisadas: 0,
        buenas: 0,
        pctSegundas: 0,
        topDefecto: '',
        topDefectoCant: 0,
        count: 0
      };

      const seg = r.totalSegundas || (r.pegas + r.arreLaterales + r.arreCabeceras + (r.defectosEstampado?.totalEstampado || 0));
      existing.totalSegundas += seg;
      existing.defectosEstampado += r.defectosEstampado?.totalEstampado || 0;
      existing.totalRevisadas += r.cantTotalRevisada || 0;
      existing.buenas += r.cantBuena || 0;
      existing.count += 1;

      map.set(name, existing);
    });

    return Array.from(map.values()).map(d => {
      const designInfo = defectsByDesign.find(x => x.diseno === d.name);
      const pct = d.totalRevisadas > 0 ? (d.totalSegundas / d.totalRevisadas) * 100 : 0;
      return {
        ...d,
        pctSegundas: Number(pct.toFixed(1)),
        topDefecto: designInfo?.topDefectoEstampado || 'Sin fallas',
        topDefectoCant: designInfo?.topDefectoEstampadoCant || 0
      };
    });
  }, [timeFilteredRecords, defectsByDesign]);

  const activeTopDesignsList = useMemo(() => {
    let list = allTopDesigns.map(d => {
      let value = 0;
      if (topDesignMetric === 'segundas') value = d.totalSegundas;
      else if (topDesignMetric === 'estampado') value = d.defectosEstampado;
      else if (topDesignMetric === 'revisadas') value = d.totalRevisadas;
      else if (topDesignMetric === 'pctSegundas') value = d.pctSegundas;

      return {
        ...d,
        value
      };
    });

    // Filtro de diseños ocultos
    list = list.filter(d => !hiddenTopDesigns.includes(d.name));

    // Filtro de proceso (REACTIVO / PIGMENTO)
    if (topDesignProcessFilter !== 'all') {
      list = list.filter(d => d.process === topDesignProcessFilter);
    }

    // Búsqueda
    if (topDesignSearch.trim()) {
      const q = topDesignSearch.trim().toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }

    // Orden (Desc / Asc)
    if (topDesignSortOrder === 'asc') {
      list = [...list].sort((a, b) => a.value - b.value);
    } else {
      list = [...list].sort((a, b) => b.value - a.value);
    }

    // Límite (Top 5, Top 10, Top 20, Todos)
    if (topDesignLimit > 0) {
      list = list.slice(0, topDesignLimit);
    }

    return list;
  }, [allTopDesigns, hiddenTopDesigns, topDesignMetric, topDesignProcessFilter, topDesignSearch, topDesignSortOrder, topDesignLimit]);

  const totalMetricSum = useMemo(() => {
    return allTopDesigns.reduce((acc, d) => {
      if (topDesignMetric === 'segundas') return acc + d.totalSegundas;
      if (topDesignMetric === 'estampado') return acc + d.defectosEstampado;
      if (topDesignMetric === 'revisadas') return acc + d.totalRevisadas;
      return acc + d.pctSegundas;
    }, 0);
  }, [allTopDesigns, topDesignMetric]);

  const modalDesignsList = useMemo(() => {
    let list = allTopDesigns;
    if (modalProcessFilter !== 'all') {
      list = list.filter(d => d.process === modalProcessFilter);
    }
    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [allTopDesigns, modalProcessFilter, modalSearch]);

  const toggleHideDesign = (name: string) => {
    setHiddenTopDesigns(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  };

  const showAllDesigns = () => {
    setHiddenTopDesigns([]);
  };

  const hideAllDesigns = () => {
    setHiddenTopDesigns(allTopDesigns.map(d => d.name));
  };

  const invertHiddenDesigns = () => {
    setHiddenTopDesigns(prev =>
      allTopDesigns.map(d => d.name).filter(name => !prev.includes(name))
    );
  };

  // Gráfica Comparativa Primeras vs Segundas
  const comparativaData = useMemo(() => {
    if (comparativaGrouping === 'dia') {
      const dayMap = new Map<string, {
        label: string;
        estampadas: number;
        segundas: number;
        primeras: number;
        pctPrimeras: number;
      }>();

      visibleRecords.forEach(r => {
        const dateKey = r.fecha || 'Sin fecha';
        const [, m, d] = dateKey.split('-');
        const shortLabel = d && m ? `${parseInt(d, 10)}-${MONTH_NAMES[parseInt(m, 10) - 1]?.slice(0, 3)}` : dateKey;

        const est = r.cantTotalRevisada || 0;
        const seg = r.totalSegundas || (r.pegas + r.arreLaterales + r.arreCabeceras + (r.defectosEstampado?.totalEstampado || 0));
        const prim = r.cantBuena || Math.max(0, est - seg);

        const current = dayMap.get(dateKey) || {
          label: shortLabel,
          estampadas: 0,
          segundas: 0,
          primeras: 0,
          pctPrimeras: 0
        };

        current.estampadas += est;
        current.segundas += seg;
        current.primeras += prim;
        dayMap.set(dateKey, current);
      });

      return Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, val]) => ({
          ...val,
          pctPrimeras: val.estampadas > 0 ? Number(((val.primeras / val.estampadas) * 100).toFixed(1)) : 0
        }));
    } else {
      const desMap = new Map<string, {
        label: string;
        estampadas: number;
        segundas: number;
        primeras: number;
        pctPrimeras: number;
        tecnica: string;
      }>();

      visibleRecords.forEach(r => {
        const name = (r.diseno || 'SIN DISEÑO').trim();
        const est = r.cantTotalRevisada || 0;
        const seg = r.totalSegundas || (r.pegas + r.arreLaterales + r.arreCabeceras + (r.defectosEstampado?.totalEstampado || 0));
        const prim = r.cantBuena || Math.max(0, est - seg);
        const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);

        const current = desMap.get(name) || {
          label: name,
          estampadas: 0,
          segundas: 0,
          primeras: 0,
          pctPrimeras: 0,
          tecnica: tec
        };

        current.estampadas += est;
        current.segundas += seg;
        current.primeras += prim;
        desMap.set(name, current);
      });

      return Array.from(desMap.values())
        .sort((a, b) => b.estampadas - a.estampadas)
        .slice(0, 10)
        .map(val => ({
          ...val,
          pctPrimeras: val.estampadas > 0 ? Number(((val.primeras / val.estampadas) * 100).toFixed(1)) : 0
        }));
    }
  }, [visibleRecords, comparativaGrouping]);

  // Pareto global
  const paretoDefectosData = useMemo(() => {
    const rawDefects = [
      { name: 'Manchas', count: totals.manchas, color: DEFECT_COLORS[0] },
      { name: 'Falta Pintura', count: totals.faltaPintura, color: DEFECT_COLORS[1] },
      { name: 'Repise', count: totals.repise, color: DEFECT_COLORS[2] },
      { name: 'Grasa', count: totals.grasa, color: DEFECT_COLORS[3] },
      { name: 'Penetración', count: totals.penetracion, color: DEFECT_COLORS[4] },
      { name: 'Descases', count: totals.descases, color: DEFECT_COLORS[5] },
      { name: 'Quemadas', count: totals.quemadas, color: DEFECT_COLORS[6] },
      { name: 'Logos Corridos', count: totals.logosCorridos, color: DEFECT_COLORS[7] },
    ].sort((a, b) => b.count - a.count);

    let cumulative = 0;
    const totalEst = totals.estampado || 1;
    return rawDefects.map(d => {
      cumulative += d.count;
      return {
        ...d,
        pct: (d.count / totalEst) * 100,
        cumulativePct: Number(((cumulative / totalEst) * 100).toFixed(1))
      };
    });
  }, [totals]);

  // Filtrado y Ordenación de la Planilla
  const filteredRecords = useMemo(() => {
    return visibleRecords
      .filter(r => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          (r.diseno || '').toLowerCase().includes(query) ||
          (r.referencia || '').toLowerCase().includes(query) ||
          (r.revisadoras || '').toLowerCase().includes(query) ||
          (r.tecnica || '').toLowerCase().includes(query) ||
          (r.observaciones || '').toLowerCase().includes(query);

        if (!matchesSearch) return false;

        if (filterSeverity === 'optimo') return (r.pctEstampado || 0) < 0.015;
        if (filterSeverity === 'alerta') return (r.pctEstampado || 0) >= 0.015 && (r.pctEstampado || 0) <= 0.03;
        if (filterSeverity === 'critico') return (r.pctEstampado || 0) > 0.03;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'fecha') diff = (a.fecha || '').localeCompare(b.fecha || '');
        else if (sortBy === 'revisadas') diff = (a.cantTotalRevisada || 0) - (b.cantTotalRevisada || 0);
        else if (sortBy === 'pctEstampado') diff = (a.pctEstampado || 0) - (b.pctEstampado || 0);
        else if (sortBy === 'totalSegundas') diff = (a.totalSegundas || 0) - (b.totalSegundas || 0);

        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [visibleRecords, searchTerm, filterSeverity, sortBy, sortOrder]);

  // Modal Handlers
  const handleOpenNewModal = () => {
    setEditingRecord(null);
    setFormFecha(new Date().toISOString().slice(0, 10));
    setFormRevisadoras('BLANCA-MAYULIS-HEIDY-TATIANA');
    setFormReferencia('C280T');
    setFormDimensiones('60*120-280');
    setFormDiseno('');
    setFormColor('EST');
    setFormTecnica('REACTIVO');
    setFormTotalRevisada(2000);
    setFormCantBuena(1600);
    setFormPegas(80);
    setFormArrLat(150);
    setFormArrCab(130);
    setFormManchas(20);
    setFormRepise(5);
    setFormFaltaPintura(10);
    setFormLogosCorridos(0);
    setFormPenetracion(2);
    setFormGrasa(3);
    setFormDescases(0);
    setFormQuemadas(0);
    setFormObservaciones('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rec: SegundasRecord) => {
    setEditingRecord(rec);
    setFormFecha(rec.fecha || new Date().toISOString().slice(0, 10));
    setFormRevisadoras(rec.revisadoras || '');
    setFormReferencia(rec.referencia || '');
    setFormDimensiones(rec.dimensiones || '');
    setFormDiseno(rec.diseno || '');
    setFormColor(rec.color || 'EST');
    setFormTecnica(rec.tecnica || inferTecnica(rec.diseno, rec.referencia));
    setFormTotalRevisada(rec.cantTotalRevisada || 0);
    setFormCantBuena(rec.cantBuena || 0);
    setFormPegas(rec.pegas || 0);
    setFormArrLat(rec.arreLaterales || 0);
    setFormArrCab(rec.arreCabeceras || 0);
    setFormManchas(rec.defectosEstampado?.manchas || 0);
    setFormRepise(rec.defectosEstampado?.repise || 0);
    setFormFaltaPintura(rec.defectosEstampado?.faltaPintura || 0);
    setFormLogosCorridos(rec.defectosEstampado?.logosCorridos || 0);
    setFormPenetracion(rec.defectosEstampado?.penetracion || 0);
    setFormGrasa(rec.defectosEstampado?.grasa || 0);
    setFormDescases(rec.defectosEstampado?.descases || 0);
    setFormQuemadas(rec.defectosEstampado?.quemadas || 0);
    setFormObservaciones(rec.observaciones || '');
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const totalEstampado =
      formManchas + formRepise + formFaltaPintura + formLogosCorridos +
      formPenetracion + formGrasa + formDescases + formQuemadas;

    const totalSeg = formPegas + formArrLat + formArrCab + totalEstampado;
    const totalRev = formTotalRevisada || 1;

    const recordData: SegundasRecord = {
      id: editingRecord ? editingRecord.id : `seg-${Date.now()}`,
      fecha: formFecha,
      revisadoras: formRevisadoras.trim(),
      referencia: formReferencia.trim(),
      dimensiones: formDimensiones.trim(),
      diseno: formDiseno.trim().toUpperCase(),
      color: formColor.trim(),
      tecnica: formTecnica,
      cantTotalRevisada: formTotalRevisada,
      cantBuena: formCantBuena,
      pegas: formPegas,
      arreLaterales: formArrLat,
      pctLaterales: formArrLat / totalRev,
      arreCabeceras: formArrCab,
      pctCabeceras: formArrCab / totalRev,
      observaciones: formObservaciones.trim(),
      defectosEstampado: {
        manchas: formManchas,
        repise: formRepise,
        faltaPintura: formFaltaPintura,
        logosCorridos: formLogosCorridos,
        penetracion: formPenetracion,
        grasa: formGrasa,
        descases: formDescases,
        quemadas: formQuemadas,
        totalEstampado
      },
      pctEstampado: totalEstampado / totalRev,
      totalSegundas: totalSeg,
      pctTotalSegundas: totalSeg / totalRev
    };

    if (editingRecord) {
      updateRecords(records.map(r => r.id === editingRecord.id ? recordData : r));
    } else {
      updateRecords([recordData, ...records]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteRecord = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Registro de Inspección',
      message: '¿Estás seguro de que deseas eliminar este registro de segundas? Esta acción actualizará los indicadores de calidad.',
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: () => {
        updateRecords(records.filter(r => r.id !== id));
        if (selectedDetailRecord?.id === id) setSelectedDetailRecord(null);
        showToast('info', 'Registro eliminado', 'La inspección fue retirada del historial.');
        setConfirmDialog(null);
      }
    });
  };

  const handleResetDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restablecer Datos Originales',
      message: '¿Deseas restablecer los registros originales de la planilla de segundas? Se perderán las modificaciones no exportadas.',
      confirmText: 'Restablecer',
      danger: true,
      onConfirm: () => {
        updateRecords(INITIAL_SEGUNDAS_RECORDS);
        showToast('info', 'Datos restablecidos', 'Se han restaurado los registros originales del taller.');
        setConfirmDialog(null);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const imported: SegundasRecord[] = [];
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
          if (!raw || raw.length < 2) continue;

          // Detección dinámica: si raw[1] ya tiene cantidades numéricas en col 8 o 9, los datos inician en fila 2 (índice 1)
          const startRow = (Number(raw[1]?.[8]) > 0 || Number(raw[1]?.[9]) > 0) ? 1 : 2;

          for (let r = startRow; r < raw.length; r++) {
            const row = raw[r];
            if (!row) continue;
            // Omitir fila si en cualquiera de las primeras columnas dice 'TOTAL'
            const isTotalRow = row.slice(0, 8).some(cell => String(cell || '').trim().toUpperCase() === 'TOTAL');
            if (isTotalRow) continue;
            if (!row[8] && !row[9]) continue;

            const fechaStr = normalizeExcelDate(row[0]);
            if (!fechaStr) continue;

            const totalRev = Number(row[8]) || 0;
            const cantBuena = Number(row[9]) || 0;
            const pegas = Number(row[10]) || 0;
            const arreLat = Number(row[11]) || 0;
            const arreCab = Number(row[13]) || 0;

            const manchas = Number(row[16]) || 0;
            const repise = Number(row[17]) || 0;
            const faltaPintura = Number(row[18]) || 0;
            const logosCorridos = Number(row[19]) || 0;
            const penetracion = Number(row[20]) || 0;
            const grasa = Number(row[21]) || 0;
            const descases = Number(row[22]) || 0;
            const quemadas = Number(row[23]) || 0;
            const totalEstampado = manchas + repise + faltaPintura + logosCorridos + penetracion + grasa + descases + quemadas;
            const totalSegundas = pegas + arreLat + arreCab + totalEstampado;

            const diseno = String(row[6] || '').trim();
            const referencia = String(row[4] || '').trim();

            imported.push({
              id: `seg-imp-${r}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              fecha: fechaStr,
              revisadoras: String(row[1] || '').trim(),
              referencia,
              dimensiones: String(row[5] || '').trim(),
              diseno,
              color: row[7] ? String(row[7]).trim() : 'EST',
              tecnica: inferTecnica(diseno, referencia),
              cantTotalRevisada: totalRev,
              cantBuena,
              pegas,
              arreLaterales: arreLat,
              pctLaterales: totalRev > 0 ? Number((arreLat / totalRev).toFixed(6)) : 0,
              arreCabeceras: arreCab,
              pctCabeceras: totalRev > 0 ? Number((arreCab / totalRev).toFixed(6)) : 0,
              observaciones: row[15] ? String(row[15]).trim() : '',
              defectosEstampado: {
                manchas,
                repise,
                faltaPintura,
                logosCorridos,
                penetracion,
                grasa,
                descases,
                quemadas,
                totalEstampado
              },
              pctEstampado: totalRev > 0 ? Number((totalEstampado / totalRev).toFixed(6)) : 0,
              totalSegundas,
              pctTotalSegundas: totalRev > 0 ? Number((totalSegundas / totalRev).toFixed(6)) : 0
            });
          }
        }

        if (imported.length === 0) {
          showToast('error', 'Archivo sin datos válidos', 'No se encontraron filas con información de inspección en el archivo.');
          return;
        }

        // Agrupar períodos / meses detectados en el archivo
        const monthsMap: Record<string, { label: string; count: number; month: number; year: number }> = {};
        imported.forEach(r => {
          const parts = r.fecha.split('-');
          if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
              const key = `${y}-${m}`;
              const label = `${MONTH_NAMES[m]} ${y}`;
              if (!monthsMap[key]) {
                monthsMap[key] = { label, count: 0, month: m, year: y };
              }
              monthsMap[key].count++;
            }
          }
        });
        const detectedMonths = Object.entries(monthsMap).map(([key, data]) => ({ key, ...data }));

        // Análisis de duplicados contra el historial actual
        const existingFingerprints = new Set(records.map(getRecordFingerprint));
        const newRecords = imported.filter(r => !existingFingerprints.has(getRecordFingerprint(r)));
        const duplicatesCount = imported.length - newRecords.length;

        // Abrir modal de confirmación inteligente
        setImportPending({
          fileName: file.name,
          importedRecords: imported,
          detectedMonths,
          newRecords,
          duplicatesCount
        });
      } catch (err) {
        console.error(err);
        showToast('error', 'Error al procesar archivo', 'Ocurrió un error al leer el archivo Excel.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmAccumulate = () => {
    if (!importPending) return;
    const toAdd = importPending.newRecords;
    const merged = [...toAdd, ...records];
    updateRecords(merged);

    // Auto-navegar al mes predominante de los datos importados para visualización inmediata
    if (importPending.detectedMonths.length > 0) {
      const primary = importPending.detectedMonths.reduce((prev, curr) => curr.count > prev.count ? curr : prev);
      setSelectedMonth(primary.month);
      setSelectedYear(primary.year);
      setTimeFilter('month');
    }

    const periodStr = importPending.detectedMonths.map(m => m.label).join(', ');
    showToast(
      'success',
      '¡Historial Acumulado con Éxito!',
      `Se incorporaron ${toAdd.length} registros nuevos (${periodStr}). El historial ahora conserva ${merged.length} registros en total.`
    );
    setImportPending(null);
  };

  const handleConfirmReplace = () => {
    if (!importPending) return;
    updateRecords(importPending.importedRecords);

    if (importPending.detectedMonths.length > 0) {
      const primary = importPending.detectedMonths.reduce((prev, curr) => curr.count > prev.count ? curr : prev);
      setSelectedMonth(primary.month);
      setSelectedYear(primary.year);
      setTimeFilter('month');
    }

    const periodStr = importPending.detectedMonths.map(m => m.label).join(', ');
    showToast(
      'info',
      'Historial Reemplazado',
      `Se guardaron ${importPending.importedRecords.length} registros de ${periodStr} como base única del historial.`
    );
    setImportPending(null);
  };

  const handleExportExcel = () => {
    const rows = filteredRecords.map(r => ({
      'FECHA': r.fecha,
      'TÉCNICA': r.tecnica || inferTecnica(r.diseno, r.referencia),
      'DISEÑO': r.diseno,
      'REFERENCIA': r.referencia,
      'DIMENSIONES': r.dimensiones,
      'REVISADORAS': r.revisadoras,
      'CANT. REVISADAS (TOTAL)': r.cantTotalRevisada,
      'CANT. PRIMERAS (BUENAS)': r.cantBuena,
      '% PRIMERA CALIDAD': `${((r.cantBuena / (r.cantTotalRevisada || 1)) * 100).toFixed(2)}%`,
      'PEGAS': r.pegas,
      'ARRE. LATERALES': r.arreLaterales,
      'ARRE. CABECERAS': r.arreCabeceras,
      'DEFECTOS ESTAMPADO': r.defectosEstampado?.totalEstampado || 0,
      'FALLA PRINCIPAL': getTopDefect(r)?.name || 'Ninguna',
      'MANCHAS': r.defectosEstampado?.manchas || 0,
      'REPISE': r.defectosEstampado?.repise || 0,
      'FALTA PINTURA': r.defectosEstampado?.faltaPintura || 0,
      'GRASA': r.defectosEstampado?.grasa || 0,
      'PENETRACIÓN': r.defectosEstampado?.penetracion || 0,
      'DESCASES': r.defectosEstampado?.descases || 0,
      'QUEMADAS': r.defectosEstampado?.quemadas || 0,
      'LOGOS CORRIDOS': r.defectosEstampado?.logosCorridos || 0,
      '% DEFECTO ESTAMPADO': `${((r.pctEstampado || 0) * 100).toFixed(2)}%`,
      'TOTAL SEGUNDAS (FÓRMULA)': r.totalSegundas || 0,
      '% TOTAL SEGUNDAS': `${((r.pctTotalSegundas || 0) * 100).toFixed(2)}%`,
      'OBSERVACIONES': r.observaciones || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Segundas y Primeras');
    XLSX.writeFile(wb, `Reporte_Segundas_Calidad_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('success', 'Reporte Excel Descargado', 'El archivo de inspección de calidad se ha guardado exitosamente.');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ── BARRA SUPERIOR DE FILTRO TEMPORAL, TÉCNICA Y REFERENCIA ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navegador de Mes / Año */}
          {timeFilter === 'month' && (
            <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2.5 py-0.5 text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                <span>{MONTH_NAMES[selectedMonth]}</span>
                <span className="text-slate-400 font-semibold">{selectedYear}</span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {timeFilter === 'year' && (
            <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedYear(y => y - 1)}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Año anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 py-0.5 text-xs font-black text-slate-800 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                <span>{selectedYear}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedYear(y => y + 1)}
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Año siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Chips de Periodo */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
            {[
              { id: 'all', label: 'Todo el Histórico' },
              { id: 'month', label: 'Mes' },
              { id: 'year', label: 'Año' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTimeFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === f.id
                    ? 'bg-white text-rose-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>


          {/* Filtro por Tela Base (C280T, ME1002, ML1002) */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase px-1.5">REF:</span>
            <button
              type="button"
              onClick={() => setReferenciaFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                referenciaFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            {availableReferences.map(ref => (
              <button
                key={ref}
                type="button"
                onClick={() => setReferenciaFilter(ref)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  referenciaFilter === ref
                    ? 'bg-blue-600 text-white shadow-2xs font-black'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                {ref}
              </button>
            ))}
          </div>

          {/* Filtro Técnica */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setTecnicaFilter('all');
                setTopDesignProcessFilter('all');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tecnicaFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Técnicas
            </button>
            <button
              type="button"
              onClick={() => {
                setTecnicaFilter('REACTIVO');
                setTopDesignProcessFilter('REACTIVO');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tecnicaFilter === 'REACTIVO'
                  ? 'bg-purple-600 text-white shadow-2xs font-black'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              Reactivo
            </button>
            <button
              type="button"
              onClick={() => {
                setTecnicaFilter('PIGMENTO');
                setTopDesignProcessFilter('PIGMENTO');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tecnicaFilter === 'PIGMENTO'
                  ? 'bg-amber-600 text-white shadow-2xs font-black'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Pigmento
            </button>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Badge de Historial Acumulado */}
          

          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all border border-slate-200 shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Cargar Excel</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl cursor-pointer transition-all shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Inspección</span>
          </button>
          
        </div>
      </div>

      {/* ── ALERTA INFORMATIVA SI EL MES SELECCIONADO ESTÁ EN CERO ── */}
      {timeFilter === 'month' && timeFilteredRecords.length === 0 && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
              <Calendar className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">
                No hay registros de inspección registrados en {MONTH_NAMES[selectedMonth]} {selectedYear}
              </p>
              <div className="text-[11px] text-amber-800 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>Meses con datos en el historial:</span>
                {availableMonthsInRecords.length > 0 ? (
                  availableMonthsInRecords.map(m => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => {
                        setSelectedMonth(m.month);
                        setSelectedYear(m.year);
                        setTimeFilter('month');
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-amber-100 border border-amber-200 rounded-md font-bold text-amber-900 transition-colors cursor-pointer shadow-2xs"
                    >
                      {m.label} ({m.count} lotes)
                    </button>
                  ))
                ) : (
                  <span className="italic">No hay datos aún. Haz clic en "Cargar Excel" para importar el archivo del mes.</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTimeFilter('all')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            Ver Todo el Histórico ({records.length})
          </button>
        </div>
      )}

      {/* ── KPI CARDS EJECUTIVOS: BALANCE GENERAL Y COMPOSICIÓN ── */}
      <div className="space-y-2.5">
        {/* Nivel 1: Balance General de Inspección (100% del Lote) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Total Estampadas */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide leading-tight">
                Total Revisadas
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                {fmtInt(totals.revisada)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight">
                {timeFilteredRecords.length} lotes evaluados (100%)
              </p>
            </div>
          </div>

          {/* Card 2: 1ª Calidad (Buenas) */}
          <div className="bg-white rounded-2xl border border-emerald-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-emerald-50/20">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-extrabold text-emerald-600 uppercase tracking-wide leading-tight">
                1ª Calidad (Buenas)
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight mt-0.5">
                {fmtInt(totals.buena)}
              </p>
              <p className="text-[10px] text-emerald-600 font-bold mt-0.5 leading-tight">
                {fmtPct(pctGlobalBuena)} Rendimiento conforme
              </p>
            </div>
          </div>

          {/* Card 3: Segundas Totales */}
          <div className="bg-white rounded-2xl border border-amber-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-amber-50/20">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-extrabold text-amber-700 uppercase tracking-wide leading-tight">
                Segundas Taller
              </p>
              <p className="text-xl sm:text-2xl font-black text-amber-800 font-mono tracking-tight mt-0.5">
                {fmtInt(totals.totalSegundas)}
              </p>
              <p className="text-[10px] text-amber-700 font-bold mt-0.5 leading-tight">
                {fmtPct(pctGlobalSegundas)} Arreglos, pegas y estampado
              </p>
            </div>
          </div>

          {/* Card 4: Segundas Otros Procesos */}
          <div className="bg-white rounded-2xl border border-purple-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-purple-50/20">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <Factory className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-extrabold text-purple-700 uppercase tracking-wide leading-tight">
                Segundas Otros Procesos
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-800 font-mono tracking-tight mt-0.5">
                {fmtInt(segundasOtrosProcesos)}
              </p>
              <p className="text-[10px] text-purple-700 font-medium mt-0.5 leading-tight">
                {fmtPct(pctGlobalOtrosProcesos)} Tintorería, tejeduría y otros
              </p>
            </div>
          </div>
        </div>

        {/* Nivel 2: Composición Interna de Segundas (Arreglos + Pegas + Estampado = Segundas Totales) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Subcard 1: Arreglos Confección */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wide leading-tight">
                Arreglos
              </p>
              <p className="text-base sm:text-lg font-black text-sky-800 font-mono tracking-tight">
                {fmtInt(totals.arreLaterales + totals.arreCabeceras)}
              </p>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">
                {fmtInt(totals.arreLaterales)} lat · {fmtInt(totals.arreCabeceras)} cab ({totals.totalSegundas > 0 ? (((totals.arreLaterales + totals.arreCabeceras) / totals.totalSegundas) * 100).toFixed(0) : 0}% segundas)
              </p>
            </div>
          </div>

          {/* Subcard 2: Pegas */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Scissors className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide leading-tight">
                Pegas 
              </p>
              <p className="text-base sm:text-lg font-black text-indigo-800 font-mono tracking-tight">
                {fmtInt(totals.pegas)}
              </p>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">
                ({totals.totalSegundas > 0 ? ((totals.pegas / totals.totalSegundas) * 100).toFixed(0) : 0}% segundas)
              </p>
            </div>
          </div>

          {/* Subcard 3: Defectos Estampado */}
          <div className="bg-white rounded-2xl border border-rose-200/90 p-3 sm:p-3.5 shadow-xs flex items-center gap-2.5 bg-gradient-to-br from-white to-rose-50/20">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wide leading-tight">
                Defectos Estampado
              </p>
              <p className="text-base sm:text-lg font-black text-rose-700 font-mono tracking-tight">
                {fmtInt(totals.estampado)}
              </p>
              <p className="text-[9px] text-rose-600 font-extrabold leading-tight">
                {fmtPct(pctGlobalEstampado)} ({totals.totalSegundas > 0 ? ((totals.estampado / totals.totalSegundas) * 100).toFixed(0) : 0}% segundas)
              </p>
            </div>
          </div>

          {/* Subcard 4: Por Técnica */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex flex-col justify-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 leading-tight">
              Volumen por Técnica
            </p>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">REACTIVO</span>
                <span className="font-extrabold text-slate-800 text-[11px]">{fmtInt(totals.reactivoRevisada)} pz</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded">PIGMENTO</span>
                <span className="font-extrabold text-slate-800 text-[11px]">{fmtInt(totals.pigmentoRevisada)} pz</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SELECTOR DE SUB-VISTAS PRINCIPALES ── */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-bold text-[11px] hidden md:inline">Vistas de Calidad:</span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setSubView('resumen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'resumen' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dashboard Comparativo
            </button>
            <button
              type="button"
              onClick={() => setSubView('fallas_ref')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                subView === 'fallas_ref' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Fallas por Diseño
            </button>
            <button
              type="button"
              onClick={() => setSubView('planilla')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'planilla' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {`Planilla (${filteredRecords.length})`}
            </button>
            <button
              type="button"
              onClick={() => setSubView('pareto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'pareto' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matriz
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VISTA 1: DASHBOARD COMPARATIVO PRIMERAS VS SEGUNDAS
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'resumen' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
                  <GitCompare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Comparativa de Calidad: Primeras vs Segundas
                    </h3>
                    {disenoFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold">
                        <span>Diseño: {disenoFilter}</span>
                        <button
                          type="button"
                          onClick={() => setDisenoFilter('all')}
                          className="hover:text-red-600 p-0.5 cursor-pointer"
                          title="Quitar filtro de diseño"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {hiddenTopDesigns.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                        <EyeOff className="w-3 h-3 text-amber-600" />
                        <span>{hiddenTopDesigns.length} oculto{hiddenTopDesigns.length === 1 ? '' : 's'}</span>
                      </span>
                    )}
                    {tecnicaFilter !== 'all' && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        tecnicaFilter === 'REACTIVO' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {tecnicaFilter}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Prendas conformes de primera vs segundas totales acumuladas.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setComparativaGrouping('dia')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    comparativaGrouping === 'dia' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Día a Día
                </button>
                <button
                  type="button"
                  onClick={() => setComparativaGrouping('diseno')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    comparativaGrouping === 'diseno' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top Diseños
                </button>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={comparativaData}
                  margin={{ top: 15, right: 15, left: -15, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    angle={comparativaGrouping === 'diseno' ? -25 : 0}
                    textAnchor={comparativaGrouping === 'diseno' ? 'end' : 'middle'}
                    interval={0}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    tickFormatter={(v) => fmtInt(v)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#10b981' }}
                    stroke="#10b981"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-800 min-w-[200px]">
                          <p className="font-black text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                            <span>{d.label}</span>
                            {d.tecnica && (
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                d.tecnica === 'REACTIVO' ? 'bg-purple-900 text-purple-200' : 'bg-amber-900 text-amber-200'
                              }`}>
                                {d.tecnica}
                              </span>
                            )}
                          </p>
                          <div className="space-y-1 font-mono">
                            <div className="flex justify-between text-slate-300">
                              <span>Total Estampadas:</span>
                              <strong className="text-white">{fmtInt(d.estampadas)}</strong>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>Primeras (Buenas):</span>
                              <strong>{fmtInt(d.primeras)} ({d.pctPrimeras}%)</strong>
                            </div>
                            <div className="flex justify-between text-rose-400">
                              <span>Segundas (Fallas):</span>
                              <strong>{fmtInt(d.segundas)} ({((d.segundas / (d.estampadas || 1)) * 100).toFixed(1)}%)</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: '10px' }}
                    formatter={(value) => <span className="text-xs text-slate-600 font-bold">{value}</span>}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="primeras"
                    name="Primeras (Buenas)"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="segundas"
                    name="Segundas (Fallas)"
                    fill="#f43f5e"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="pctPrimeras"
                    name="% Eficiencia Primeras"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#059669' }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              TOP DISEÑOS DINÁMICO (CALIDAD / SEGUNDAS)
              ESTILO IDÉNTICO A PRODUCCIÓN
          ─────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header del Card con Controles Rápidos */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 truncate">
                      {topDesignSortOrder === 'desc'
                        ? (topDesignMetric === 'segundas' ? 'Top diseños con más segundas' :
                           topDesignMetric === 'estampado' ? 'Top diseños con más fallas de estampado' :
                           topDesignMetric === 'revisadas' ? 'Top diseños más producidos' : 'Top diseños con mayor % de segundas')
                        : (topDesignMetric === 'segundas' ? 'Diseños con menos segundas' :
                           topDesignMetric === 'estampado' ? 'Diseños con menos fallas' :
                           topDesignMetric === 'revisadas' ? 'Diseños menos producidos' : 'Diseños con menor % de segundas')}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.label} · {topDesignLimit > 0 ? `hasta ${topDesignLimit} diseños` : 'todos'} ({activeTopDesignsList.length} visible{activeTopDesignsList.length === 1 ? '' : 's'}{hiddenTopDesigns.length > 0 ? ` · ${hiddenTopDesigns.length} oculto${hiddenTopDesigns.length === 1 ? '' : 's'}` : ''})
                    </p>
                  </div>
                </div>

                {/* Botones de acción en la cabecera */}
                <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                  {/* Selector de Métrica */}
                  <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold">
                    {TOP_DESIGN_METRICS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTopDesignMetric(m.id as any)}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          topDesignMetric === m.id
                            ? 'bg-white text-rose-700 shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Selector de Top N */}
                  <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold">
                    {[5, 10, 20, 0].map(limit => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => setTopDesignLimit(limit)}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          topDesignLimit === limit
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
                    onClick={() => setTopDesignSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="p-1.5 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    title={topDesignSortOrder === 'desc' ? 'Orden actual: Mayor a menor. Clic para invertir' : 'Orden actual: Menor a mayor. Clic para invertir'}
                  >
                    {topDesignSortOrder === 'desc' ? (
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
                      hiddenTopDesigns.length > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-slate-100'
                    }`}
                    title="Configurar qué diseños ocultar o mostrar"
                  >
                    {hiddenTopDesigns.length > 0 ? (
                      <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>Ocultar diseños</span>
                    {hiddenTopDesigns.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                        {hiddenTopDesigns.length}
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
                    value={topDesignSearch}
                    onChange={e => setTopDesignSearch(e.target.value)}
                    placeholder="Buscar diseño..."
                    className="w-full pl-8 pr-7 py-1 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-400 focus:bg-white focus:outline-hidden transition-all"
                  />
                  {topDesignSearch && (
                    <button
                      type="button"
                      onClick={() => setTopDesignSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filtro de proceso (Reactivo / Pigmento) */}
                <div className="flex bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 text-[10px] font-bold shrink-0">
                  {(['all', 'REACTIVO', 'PIGMENTO'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setTopDesignProcessFilter(p);
                        setTecnicaFilter(p);
                      }}
                      className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                        topDesignProcessFilter === p
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
              {hiddenTopDesigns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs mb-3">
                  <div className="flex items-center gap-1 text-amber-800 font-bold shrink-0 text-[11px]">
                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ocultos ({hiddenTopDesigns.length}):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 max-h-16 overflow-y-auto no-scrollbar">
                    {hiddenTopDesigns.map(name => (
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
            {activeTopDesignsList.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 my-2">
                <EyeOff className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">No hay diseños para mostrar</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {topDesignSearch ? 'Ningún diseño coincide con la búsqueda' : 'Todos los diseños seleccionados están ocultos'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {hiddenTopDesigns.length > 0 && (
                    <button
                      type="button"
                      onClick={showAllDesigns}
                      className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Mostrar todos los diseños ({hiddenTopDesigns.length} ocultos)
                    </button>
                  )}
                  {topDesignSearch && (
                    <button
                      type="button"
                      onClick={() => setTopDesignSearch('')}
                      className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full overflow-y-auto no-scrollbar" style={{ maxHeight: activeTopDesignsList.length > 10 ? 460 : undefined }}>
                <div style={{ height: Math.max(220, activeTopDesignsList.length * 36) }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeTopDesignsList} layout="vertical" margin={{ top: 0, right: 65, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        width={130}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const name = payload.value;
                          const isFiltered = disenoFilter === name;
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={-5}
                                y={3}
                                textAnchor="end"
                                fill={isFiltered ? '#2563eb' : '#334155'}
                                fontWeight={isFiltered ? 900 : 800}
                                fontSize={9}
                                className="cursor-pointer hover:fill-blue-600 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDisenoFilter(prev => prev === name ? 'all' : name);
                                }}
                              >
                                {isFiltered ? `▶ ${name}` : name}
                              </text>
                            </g>
                          );
                        }}
                      />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const item = payload[0].payload;
                          const isReactivo = item.process === 'REACTIVO';
                          const unit = TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.unit || 'pz';

                          return (
                            <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xl text-xs space-y-1.5 min-w-[220px] pointer-events-none">
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
                                <span className="text-slate-500 font-semibold">{TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.label}:</span>
                                <span className="font-mono font-black text-slate-900 text-sm">
                                  {topDesignMetric === 'pctSegundas' ? `${item.value}%` : fmtInt(item.value)} <span className="text-[10px] text-slate-500">{unit}</span>
                                </span>
                              </div>
                              <div className="space-y-0.5 font-mono text-[11px] pt-1 border-t border-slate-100">
                                <div className="flex justify-between text-slate-600">
                                  <span>Total Estampadas:</span>
                                  <strong>{fmtInt(item.totalRevisadas)}</strong>
                                </div>
                                <div className="flex justify-between text-emerald-700">
                                  <span>Buenas (1ª):</span>
                                  <strong>{fmtInt(item.buenas)}</strong>
                                </div>
                                <div className="flex justify-between text-rose-700">
                                  <span>Segundas:</span>
                                  <strong>{fmtInt(item.totalSegundas)} ({item.pctSegundas}%)</strong>
                                </div>
                                <div className="flex justify-between text-amber-800">
                                  <span>Def. Estampado:</span>
                                  <strong>{fmtInt(item.defectosEstampado)}</strong>
                                </div>
                              </div>
                              {item.topDefecto && (
                                <div className="pt-1 border-t border-slate-100 text-[10px] text-rose-700 font-semibold">
                                  Falla principal: <strong>{item.topDefecto}</strong> ({item.topDefectoCant} pz)
                                </div>
                              )}
                              <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-0.5 text-[10px] text-slate-500 font-medium">
                                <div className="flex items-center gap-1 text-amber-700">
                                  <EyeOff className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Clic en la barra: <strong>Ocultar de todas las gráficas</strong></span>
                                </div>
                                <div className="text-blue-600">
                                  <span>🔍 Clic en el nombre: <strong>Ver día a día en la comparativa</strong></span>
                                </div>
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
                          formatter: (v: any) => topDesignMetric === 'pctSegundas' ? `${v}%` : fmtInt(Number(v))
                        }}
                      >
                        {activeTopDesignsList.map((d, i) => (
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

            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
              <span>💡 Haz clic en una barra para ocultar/mostrar ese diseño de las gráficas · Haz clic en el nombre para filtrar su comparativa día a día</span>
              {hiddenTopDesigns.length > 0 && (
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 2: DIAGNÓSTICO DE FALLAS POR DISEÑO (REFERENCIA EN TALLER)
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'fallas_ref' && (
        <div className="space-y-4">
          {/* Barra de Controles y Herramientas de la Vista de Fallas por Diseño */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-600" />
                  Diagnóstico de Fallas por Diseño (Referencia)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Identifica qué defecto específico (Falta de Pintura, Manchas, Repise, Grasa, etc.) predomina en cada diseño estampado.
                </p>
              </div>

              {/* Selector de Modo de Visualización */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFallasViewMode('cards')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    fallasViewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Tarjetas ({filteredDefectsByDesign.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFallasViewMode('chart')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    fallasViewMode === 'chart' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Gráfico Comparativo
                </button>
                <button
                  type="button"
                  onClick={() => setFallasViewMode('matrix')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    fallasViewMode === 'matrix' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Matriz de Defectos (8)
                </button>
              </div>
            </div>

            {/* Filtros locales de la vista: Búsqueda, Orden y Chips rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[180px] max-w-[320px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar diseño (ej. MINNIE, NAVIDAD, GRANJA)..."
                    value={fallasDesignSearch}
                    onChange={(e) => setFallasDesignSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-800"
                  />
                  {fallasDesignSearch && (
                    <button
                      type="button"
                      onClick={() => setFallasDesignSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Selector de Orden */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold">Ordenar:</span>
                  <select
                    value={fallasSortBy}
                    onChange={(e) => setFallasSortBy(e.target.value as any)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="fallas">Mayor Fallas Estampado</option>
                    <option value="revisadas">Mayor Cantidad Estampada</option>
                    <option value="pct">Mayor % de Falla</option>
                    <option value="nombre">Nombre (A - Z)</option>
                  </select>
                </div>
              </div>

              {/* Chips de acceso directo a los Diseños con más defectos */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Diseño:</span>
                <button
                  type="button"
                  onClick={() => setFallasDesignSearch('')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    !fallasDesignSearch ? 'bg-slate-900 text-white font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                {defectsByDesign
                  .filter(d => d.totalEstampado > 0)
                  .slice(0, 7)
                  .map(d => (
                    <button
                      key={d.diseno}
                      type="button"
                      onClick={() => setFallasDesignSearch(d.diseno)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                        fallasDesignSearch.toUpperCase() === d.diseno
                          ? 'bg-rose-600 text-white font-black shadow-2xs'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                      }`}
                    >
                      {d.diseno} ({d.totalEstampado})
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* MODO 1: TARJETAS DETALLADAS POR CADA DISEÑO */}
          {fallasViewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDefectsByDesign.map((d) => {
                const hasDefects = d.totalEstampado > 0;
                return (
                  <div
                    key={d.diseno}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3.5 transition-all ${
                      hasDefects ? 'border-slate-200/90 hover:border-rose-300' : 'border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/20'
                    }`}
                  >
                    <div>
                      {/* Cabecera del Diseño */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                        <div>
                          <h4 className="text-base font-black text-slate-900 tracking-tight">
                            {d.diseno}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={`text-[9px] font-extrabold px-2 py-0.2 rounded-md ${
                              d.tecnica === 'REACTIVO'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {d.tecnica}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              Ref {d.referencia}
                            </span>
                            {d.dimensiones && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {d.dimensiones}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-slate-900 font-mono">{fmtInt(d.totalRevisadas)}</span>
                          <span className="block text-[9px] text-slate-400 uppercase">Revisadas</span>
                          <span className="block text-[9px] font-bold text-emerald-700 font-mono">
                            {fmtPct(d.pctBuenas / 100, 1)} Buenas
                          </span>
                        </div>
                      </div>

                      {/* CAJA DE FALLA PREDOMINANTE EN ESTE DISEÑO */}
                      {hasDefects ? (
                        <div className="bg-rose-50/90 border border-rose-200 p-3 rounded-xl mb-3 shadow-2xs">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-rose-700">
                            <span>Falla Predominante:</span>
                            <span className="font-mono">{d.topDefectoEstampadoCant} pz ({d.topDefectoPct}%)</span>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <strong className="text-base font-black text-rose-950">
                              {d.topDefectoEstampado}
                            </strong>
                            <span className="text-[11px] font-bold text-rose-700 font-mono">
                              {d.totalEstampado} fallas tot. ({d.pctEstampado}%)
                            </span>
                          </div>
                          {/* Barra visual de peso de la falla */}
                          <div className="w-full bg-rose-200/70 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-rose-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, d.topDefectoPct)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50/90 border border-emerald-200 p-3 rounded-xl mb-3 text-center">
                          <span className="text-xs font-black text-emerald-800 flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            100% Sin Fallas de Estampación
                          </span>
                          <p className="text-[10px] text-emerald-600 mt-0.5">Todas las prendas salieron conformes de estampado.</p>
                        </div>
                      )}

                      {/* DESGLOSE DETALLADO DE LOS 8 DEFECTOS */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Desglose de Defectos ({d.totalEstampado} pz):
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.manchas > 0 ? 'bg-red-50/80 border-red-200 text-red-950' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Manchas:</span>
                            <strong className={d.manchas > 0 ? 'text-red-700 font-black' : 'text-slate-400'}>
                              {d.manchas} {d.manchas > 0 && d.totalEstampado > 0 ? `(${((d.manchas/d.totalEstampado)*100).toFixed(0)}%)` : ''}
                            </strong>
                          </div>

                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.faltaPintura > 0 ? 'bg-orange-50/80 border-orange-200 text-orange-950' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Falta Pint.:</span>
                            <strong className={d.faltaPintura > 0 ? 'text-orange-700 font-black' : 'text-slate-400'}>
                              {d.faltaPintura} {d.faltaPintura > 0 && d.totalEstampado > 0 ? `(${((d.faltaPintura/d.totalEstampado)*100).toFixed(0)}%)` : ''}
                            </strong>
                          </div>

                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.repise > 0 ? 'bg-amber-50/80 border-amber-200 text-amber-950' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Repise:</span>
                            <strong className={d.repise > 0 ? 'text-amber-800 font-black' : 'text-slate-400'}>
                              {d.repise} {d.repise > 0 && d.totalEstampado > 0 ? `(${((d.repise/d.totalEstampado)*100).toFixed(0)}%)` : ''}
                            </strong>
                          </div>

                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.grasa > 0 ? 'bg-purple-50/80 border-purple-200 text-purple-950' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Grasa:</span>
                            <strong className={d.grasa > 0 ? 'text-purple-700 font-black' : 'text-slate-400'}>
                              {d.grasa} {d.grasa > 0 && d.totalEstampado > 0 ? `(${((d.grasa/d.totalEstampado)*100).toFixed(0)}%)` : ''}
                            </strong>
                          </div>

                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.penetracion > 0 ? 'bg-blue-50/80 border-blue-200 text-blue-950' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Penetrac.:</span>
                            <strong className={d.penetracion > 0 ? 'text-blue-700 font-black' : 'text-slate-400'}>
                              {d.penetracion}
                            </strong>
                          </div>

                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.descases > 0 ? 'bg-cyan-50/80 border-cyan-200 text-cyan-950' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Descases:</span>
                            <strong className={d.descases > 0 ? 'text-cyan-700 font-black' : 'text-slate-400'}>
                              {d.descases}
                            </strong>
                          </div>

                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.quemadas > 0 ? 'bg-pink-50/80 border-pink-200 text-pink-950' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Quemadas:</span>
                            <strong className={d.quemadas > 0 ? 'text-pink-700 font-black' : 'text-slate-400'}>
                              {d.quemadas}
                            </strong>
                          </div>

                          <div className={`flex justify-between p-1.5 rounded-lg border ${
                            d.logosCorridos > 0 ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            <span className="text-slate-600">Logos:</span>
                            <strong className={d.logosCorridos > 0 ? 'text-slate-800 font-black' : 'text-slate-400'}>
                              {d.logosCorridos}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pie de la tarjeta: Confección y Enlace rápido a Planilla */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>Confecc: <strong className="text-slate-700">{d.arreLaterales + d.arreCabeceras}</strong> pz</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm(d.diseno);
                          setSubView('planilla');
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                      >
                        Ver en Planilla &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 2: GRÁFICO COMPARATIVO DE DEFECTOS POR DISEÑO */}
          {fallasViewMode === 'chart' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/80">
                  <BarChart3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Comparativa de Defectos de Estampado en Top Diseños (Referencias)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Barras apiladas mostrando qué porcentaje y cantidad de cada defecto compone las fallas de cada diseño.
                  </p>
                </div>
              </div>

              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart
                    data={fallasPorDisenoChartData}
                    margin={{ top: 15, right: 15, left: -15, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="diseno"
                      tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                      stroke="#cbd5e1"
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      stroke="#cbd5e1"
                      tickFormatter={(v) => fmtInt(v)}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-800 min-w-[210px]">
                            <p className="font-black text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                              <span>{d.diseno}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                d.tecnica === 'REACTIVO' ? 'bg-purple-900 text-purple-200' : 'bg-amber-900 text-amber-200'
                              }`}>
                                {d.tecnica}
                              </span>
                            </p>
                            <p className="text-[11px] text-rose-400 font-mono font-bold mb-2">
                              Total Fallas Estampado: {d.totalEstampado} piezas
                            </p>
                            <div className="space-y-1 font-mono text-[11px]">
                              {d['Manchas'] > 0 && <div className="flex justify-between text-red-300"><span>• Manchas:</span><strong>{d['Manchas']}</strong></div>}
                              {d['Falta Pintura'] > 0 && <div className="flex justify-between text-orange-300"><span>• Falta Pintura:</span><strong>{d['Falta Pintura']}</strong></div>}
                              {d['Repise'] > 0 && <div className="flex justify-between text-amber-300"><span>• Repise:</span><strong>{d['Repise']}</strong></div>}
                              {d['Grasa'] > 0 && <div className="flex justify-between text-purple-300"><span>• Grasa:</span><strong>{d['Grasa']}</strong></div>}
                              {d['Penetración'] > 0 && <div className="flex justify-between text-blue-300"><span>• Penetración:</span><strong>{d['Penetración']}</strong></div>}
                              {d['Descases'] > 0 && <div className="flex justify-between text-cyan-300"><span>• Descases:</span><strong>{d['Descases']}</strong></div>}
                              {d['Quemadas'] > 0 && <div className="flex justify-between text-pink-300"><span>• Quemadas:</span><strong>{d['Quemadas']}</strong></div>}
                              {d['Logos Corridos'] > 0 && <div className="flex justify-between text-slate-300"><span>• Logos Corridos:</span><strong>{d['Logos Corridos']}</strong></div>}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ paddingBottom: '10px' }}
                      formatter={(val) => <span className="text-xs font-bold text-slate-600">{val}</span>}
                    />
                    <Bar dataKey="Manchas" fill="#ef4444" stackId="a" isAnimationActive={false} />
                    <Bar dataKey="Falta Pintura" fill="#f97316" stackId="a" isAnimationActive={false} />
                    <Bar dataKey="Repise" fill="#f59e0b" stackId="a" isAnimationActive={false} />
                    <Bar dataKey="Grasa" fill="#8b5cf6" stackId="a" isAnimationActive={false} />
                    <Bar dataKey="Penetración" fill="#3b82f6" stackId="a" isAnimationActive={false} />
                    <Bar dataKey="Descases" fill="#06b6d4" stackId="a" isAnimationActive={false} />
                    <Bar dataKey="Quemadas" fill="#ec4899" stackId="a" isAnimationActive={false} />
                    <Bar dataKey="Logos Corridos" fill="#64748b" stackId="a" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* MODO 3: MATRIZ COMPLETA DE DEFECTOS POR DISEÑO */}
          {fallasViewMode === 'matrix' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Diseño</th>
                      <th className="py-2.5 px-2">Técnica</th>
                      <th className="py-2.5 px-2">Ref</th>
                      <th className="py-2.5 px-2 text-right">Revisadas</th>
                      <th className="py-2.5 px-2 text-right">Primeras</th>
                      <th className="py-2.5 px-3">Falla Principal</th>
                      <th className="py-2.5 px-2 text-right text-red-700 bg-red-50/50">Manchas</th>
                      <th className="py-2.5 px-2 text-right text-orange-700 bg-orange-50/50">Falta Pint.</th>
                      <th className="py-2.5 px-2 text-right text-amber-700 bg-amber-50/50">Repise</th>
                      <th className="py-2.5 px-2 text-right text-purple-700 bg-purple-50/50">Grasa</th>
                      <th className="py-2.5 px-2 text-right text-blue-700 bg-blue-50/50">Penetrac.</th>
                      <th className="py-2.5 px-2 text-right text-cyan-700 bg-cyan-50/50">Descases</th>
                      <th className="py-2.5 px-2 text-right text-pink-700 bg-pink-50/50">Quemadas</th>
                      <th className="py-2.5 px-2 text-right text-slate-700 bg-slate-100">Logos</th>
                      <th className="py-2.5 px-3 text-right bg-rose-50 text-rose-900 font-black">Tot. Fallas</th>
                      <th className="py-2.5 px-2 text-center">% Falla</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {filteredDefectsByDesign.map((d) => (
                      <tr key={d.diseno} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold font-sans text-slate-900">
                          {d.diseno}
                        </td>
                        <td className="py-2.5 px-2 font-sans">
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                            d.tecnica === 'REACTIVO' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-800'
                          }`}>
                            {d.tecnica}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-slate-500">{d.referencia}</td>
                        <td className="py-2.5 px-2 text-right font-black text-slate-900">{fmtInt(d.totalRevisadas)}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-700">{fmtInt(d.totalBuenas)}</td>
                        <td className="py-2.5 px-3 font-sans">
                          {d.totalEstampado > 0 ? (
                            <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              {d.topDefectoEstampado} ({d.topDefectoEstampadoCant})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700">Sin fallas</span>
                          )}
                        </td>
                        <td className={`py-2.5 px-2 text-right ${d.manchas > 0 ? 'font-bold text-red-700 bg-red-50/20' : 'text-slate-300'}`}>{d.manchas}</td>
                        <td className={`py-2.5 px-2 text-right ${d.faltaPintura > 0 ? 'font-bold text-orange-700 bg-orange-50/20' : 'text-slate-300'}`}>{d.faltaPintura}</td>
                        <td className={`py-2.5 px-2 text-right ${d.repise > 0 ? 'font-bold text-amber-700 bg-amber-50/20' : 'text-slate-300'}`}>{d.repise}</td>
                        <td className={`py-2.5 px-2 text-right ${d.grasa > 0 ? 'font-bold text-purple-700 bg-purple-50/20' : 'text-slate-300'}`}>{d.grasa}</td>
                        <td className={`py-2.5 px-2 text-right ${d.penetracion > 0 ? 'font-bold text-blue-700 bg-blue-50/20' : 'text-slate-300'}`}>{d.penetracion}</td>
                        <td className={`py-2.5 px-2 text-right ${d.descases > 0 ? 'font-bold text-cyan-700 bg-cyan-50/20' : 'text-slate-300'}`}>{d.descases}</td>
                        <td className={`py-2.5 px-2 text-right ${d.quemadas > 0 ? 'font-bold text-pink-700 bg-pink-50/20' : 'text-slate-300'}`}>{d.quemadas}</td>
                        <td className={`py-2.5 px-2 text-right ${d.logosCorridos > 0 ? 'font-bold text-slate-800 bg-slate-100/50' : 'text-slate-300'}`}>{d.logosCorridos}</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-700 bg-rose-50/60">{d.totalEstampado}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            d.pctEstampado > 3 ? 'bg-rose-100 text-rose-800' : d.pctEstampado > 1.5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {d.pctEstampado}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECCIÓN SUPLEMENTARIA COLAPSABLE: RESUMEN POR TELA BASE (C280T vs ME1002 vs ML1002) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-black text-slate-700">
                  Resumen Complementario por Código de Tela Base (C280T, ME1002, ML1002)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTelaComparison(prev => !prev)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                {showTelaComparison ? 'Ocultar Resumen de Telas' : 'Mostrar Resumen de Telas'}
              </button>
            </div>

            {showTelaComparison && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {defectsByReference.map(refData => (
                    <div key={refData.referencia} className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-mono font-black text-sm text-slate-900">{refData.referencia}</span>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">{refData.tecnica}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Estampadas: <strong className="text-slate-800">{fmtInt(refData.totalRevisadas)}</strong></p>
                      <p className="text-[11px] text-rose-700 font-bold mt-1">Falla Principal: {refData.topDefectoEstampado} ({refData.topDefectoEstampadoCant} pz)</p>
                    </div>
                  ))}
                </div>

                <div className="h-[250px] w-full bg-white p-3 rounded-xl border border-slate-200">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={fallasPorRefChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <RechartsTooltip />
                      <Legend iconSize={8} formatter={(val) => <span className="text-xs font-bold text-slate-600">{val}</span>} />
                      {defectsByReference.map(refItem => (
                        <Bar
                          key={refItem.referencia}
                          dataKey={refItem.referencia}
                          name={`Tela ${refItem.referencia}`}
                          fill={REF_COLORS[refItem.referencia] || '#64748b'}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 3: PLANILLA DETALLADA DE INSPECCIONES (CON FALLA PRINCIPAL)
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'planilla' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          {/* Barra de Filtros y Búsqueda */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por diseño, referencia, técnica, revisadoras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-800"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Botón para expandir desglose completo de defectos (como en el Excel) */}
              <button
                type="button"
                onClick={() => setShowAllDefectColumns(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  showAllDefectColumns
                    ? 'bg-rose-50 text-rose-700 border-rose-300 font-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showAllDefectColumns ? 'Ocultar Columnas de Fallas' : 'Ver Columnas de Fallas (8)'}</span>
              </button>

              {/* Filtro Severidad */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterSeverity('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({timeFilteredRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity('optimo')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'optimo' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  &lt;1.5% Óptimo
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity('alerta')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'alerta' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  1.5% - 3% Alerta
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity('critico')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterSeverity === 'critico' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  &gt;3% Crítico
                </button>
              </div>
            </div>

            {/* Selector de Orden */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Ordenar:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="fecha">Fecha</option>
                <option value="revisadas">Mayor Cant. Revisada</option>
                <option value="pctEstampado">Mayor % Estampado</option>
                <option value="totalSegundas">Mayor Segundas Totales</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-xs"
              >
                {sortOrder === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          </div>

          {/* Tabla de Registros */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3 whitespace-nowrap">Fecha / Tela Base</th>
                  <th className="py-2.5 px-3">Técnica</th>
                  <th className="py-2.5 px-3">Diseño (Referencia)</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Medidas</th>
                  <th className="py-2.5 px-3 text-right">Revisadas</th>
                  <th className="py-2.5 px-3 text-right">Primeras (Buenas)</th>
                  <th className="py-2.5 px-3 text-right">Pegas</th>
                  <th className="py-2.5 px-3 text-right">Arr. Lat.</th>
                  <th className="py-2.5 px-3 text-right">Arr. Cab.</th>
                  <th className="py-2.5 px-3 text-right">Def. Estampado (Tipo)</th>

                  {/* Columnas expandidas de defectos de estampado si showAllDefectColumns es true */}
                  {showAllDefectColumns && (
                    <>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Manchas</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Falta Pint.</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Repise</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Grasa</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Penetrac.</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Descases</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Quemadas</th>
                      <th className="py-2.5 px-2 text-right bg-rose-50/50 text-rose-700">Logos</th>
                    </>
                  )}

                  <th className="py-2.5 px-3 text-center">% Estamp.</th>
                  <th className="py-2.5 px-3 text-right">Tot. Segundas</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={showAllDefectColumns ? 21 : 13} className="py-8 text-center text-slate-400">
                      No se encontraron registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const isCritical = (r.pctEstampado || 0) > 0.03;
                    const isAlert = (r.pctEstampado || 0) >= 0.015 && (r.pctEstampado || 0) <= 0.03;
                    const pctEstColor = isCritical
                      ? 'text-rose-700 bg-rose-100'
                      : isAlert
                      ? 'text-amber-700 bg-amber-100'
                      : 'text-emerald-700 bg-emerald-100';

                    const tec = r.tecnica || inferTecnica(r.diseno, r.referencia);
                    const topDef = getTopDefect(r);
                    const summary = getDefectsSummary(r);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <p className="font-bold text-slate-900">{r.fecha}</p>
                          <span className="text-[10px] font-semibold text-slate-500 font-mono">Tela {r.referencia}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            tec === 'REACTIVO'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {tec}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-black text-slate-800">{r.diseno}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[140px]" title={r.revisadoras}>
                            {r.revisadoras}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {r.dimensiones}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                          {fmtInt(r.cantTotalRevisada)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-emerald-700">{fmtInt(r.cantBuena)}</span>
                          <span className="block text-[9px] text-slate-400">
                            {fmtPct(r.cantBuena / (r.cantTotalRevisada || 1), 1)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {fmtInt(r.pegas)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          <span>{fmtInt(r.arreLaterales)}</span>
                          <span className="block text-[9px] text-slate-400">{fmtPct(r.pctLaterales, 1)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          <span>{fmtInt(r.arreCabeceras)}</span>
                          <span className="block text-[9px] text-slate-400">{fmtPct(r.pctCabeceras, 1)}</span>
                        </td>

                        {/* Columna Def. Estampado con IDENTIFICADOR CLARO DEL TIPO DE FALLA */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailRecord(r)}
                            className="text-right cursor-pointer group"
                            title={summary}
                          >
                            <span className="font-mono font-black text-rose-700 group-hover:underline">
                              {fmtInt(r.defectosEstampado?.totalEstampado || 0)}
                            </span>
                            {topDef && (
                              <span className="block text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.2 rounded mt-0.5 truncate max-w-[110px]">
                                {topDef.name}: {topDef.count}
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Columnas expandidas de los 8 defectos */}
                        {showAllDefectColumns && (
                          <>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.manchas || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.faltaPintura || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.repise || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.grasa || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.penetracion || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.descases || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.quemadas || 0}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 bg-rose-50/20">{r.defectosEstampado?.logosCorridos || 0}</td>
                          </>
                        )}

                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md ${pctEstColor}`}>
                            {fmtPct(r.pctEstampado)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="font-bold text-amber-800">{fmtInt(r.totalSegundas)}</span>
                          <span className="block text-[9px] text-slate-400">{fmtPct(r.pctTotalSegundas, 1)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailRecord(r)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Ver detalle de fallas"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(r)}
                              className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Editar fila"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(r.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pie de Tabla con Totales */}
          <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Mostrando <strong className="text-slate-900">{filteredRecords.length}</strong> de {timeFilteredRecords.length} inspecciones filtradas
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <span className="text-slate-600">Revisadas: <strong className="text-slate-900">{fmtInt(totals.revisada)}</strong></span>
              <span className="text-emerald-700">Primeras: <strong className="text-emerald-800">{fmtInt(totals.buena)}</strong></span>
              <span className="text-rose-700">Def. Estampado: <strong className="text-rose-800">{fmtInt(totals.estampado)}</strong></span>
              <span className="text-amber-700">Segundas: <strong className="text-amber-800">{fmtInt(totals.totalSegundas)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 4: MATRIZ PARETO
      ─────────────────────────────────────────────────────────────── */}
      {subView === 'pareto' && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            Matriz de Defectos de Estampación y Regla 80/20
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Causas prioritarias identificadas en planta durante el periodo evaluado.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2 px-3">Tipo de Defecto</th>
                  <th className="py-2 px-3 text-right">Cantidad (Piezas)</th>
                  <th className="py-2 px-3 text-right">% Frecuencia</th>
                  <th className="py-2 px-3 text-right">% Acumulado</th>
                  <th className="py-2 px-3">Clasificación</th>
                  <th className="py-2 px-3">Causa Común en Taller</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paretoDefectosData.map((d) => (
                  <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                      {fmtInt(d.count)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {d.pct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                      {d.cumulativePct}%
                    </td>
                    <td className="py-2.5 px-3">
                      {d.cumulativePct <= 80 ? (
                        <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                          Prioridad A (80%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          Secundaria (20%)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {d.name === 'Manchas' && 'Salpicaduras de rasqueta o exceso de carga'}
                      {d.name === 'Falta Pintura' && 'Malla tapada por secado o presión irregular'}
                      {d.name === 'Repise' && 'Doble pasada o movimiento de toalla'}
                      {d.name === 'Grasa' && 'Lubricante de cadenas o contacto mecánico'}
                      {d.name === 'Penetración' && 'Viscosidad baja de pasta reactiva'}
                      {d.name === 'Descases' && 'Descalce de marcos en registro'}
                      {d.name === 'Quemadas' && 'Sobretemperatura en túnel'}
                      {d.name === 'Logos Corridos' && 'Estiramiento en mesa de estampado'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: DETALLE COMPLETO DE UN LOTE ── */}
      {selectedDetailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  Detalle de Inspección
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {selectedDetailRecord.diseno} ({selectedDetailRecord.referencia})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center font-mono">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Estampadas</p>
                  <p className="text-sm font-black text-slate-800">{fmtInt(selectedDetailRecord.cantTotalRevisada)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase">Primeras</p>
                  <p className="text-sm font-black text-emerald-700">{fmtInt(selectedDetailRecord.cantBuena)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-700 font-bold uppercase">Segundas</p>
                  <p className="text-sm font-black text-amber-800">{fmtInt(selectedDetailRecord.totalSegundas)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-rose-600 font-bold uppercase">% Estampado</p>
                  <p className="text-sm font-black text-rose-700">{fmtPct(selectedDetailRecord.pctEstampado)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Desglose de Todos los Defectos de Estampado:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Manchas', val: selectedDetailRecord.defectosEstampado?.manchas || 0, isRed: true },
                    { label: 'Falta Pintura', val: selectedDetailRecord.defectosEstampado?.faltaPintura || 0, isRed: true },
                    { label: 'Repise', val: selectedDetailRecord.defectosEstampado?.repise || 0, isRed: true },
                    { label: 'Grasa', val: selectedDetailRecord.defectosEstampado?.grasa || 0, isRed: true },
                    { label: 'Penetración', val: selectedDetailRecord.defectosEstampado?.penetracion || 0 },
                    { label: 'Descases', val: selectedDetailRecord.defectosEstampado?.descases || 0 },
                    { label: 'Quemadas', val: selectedDetailRecord.defectosEstampado?.quemadas || 0 },
                    { label: 'Logos Corridos', val: selectedDetailRecord.defectosEstampado?.logosCorridos || 0 },
                  ].map(d => (
                    <div key={d.label} className={`p-2 rounded-xl text-center border ${d.isRed ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-[10px] text-slate-500 block truncate">{d.label}</span>
                      <strong className={`text-sm font-mono font-black ${d.isRed ? 'text-rose-700' : 'text-slate-800'}`}>
                        {d.val}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block">Pegas</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedDetailRecord.pegas}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block">Arr. Laterales</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedDetailRecord.arreLaterales}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block">Arr. Cabeceras</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedDetailRecord.arreCabeceras}</span>
                </div>
              </div>

              {selectedDetailRecord.observaciones && (
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 text-amber-900">
                  <strong>Observación:</strong> {selectedDetailRecord.observaciones}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA / EDITAR INSPECCIÓN ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                {editingRecord ? 'Editar Inspección de Calidad' : 'Nueva Inspección de Segundas'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Técnica</label>
                  <select
                    value={formTecnica}
                    onChange={(e) => setFormTecnica(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-800"
                  >
                    <option value="REACTIVO">REACTIVO</option>
                    <option value="PIGMENTO">PIGMENTO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Referencia</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: C280T"
                    value={formReferencia}
                    onChange={(e) => setFormReferencia(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Medidas / Gramaje</label>
                  <input
                    type="text"
                    placeholder="ej: 60*120-280"
                    value={formDimensiones}
                    onChange={(e) => setFormDimensiones(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Diseño</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: C MINNIE"
                    value={formDiseno}
                    onChange={(e) => setFormDiseno(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Revisadoras (Equipo)</label>
                  <input
                    type="text"
                    placeholder="ej: BLANCA-MAYULIS-HEIDY-TATIANA"
                    value={formRevisadoras}
                    onChange={(e) => setFormRevisadoras(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                  Cantidades de Producción (Balance: Revisadas − Seg. Taller − Seg. Otros Procesos = Primeras)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Total Revisadas</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formTotalRevisada}
                      onChange={(e) => setFormTotalRevisada(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 mb-1">Primeras (Buenas)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formCantBuena}
                      onChange={(e) => setFormCantBuena(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-emerald-300 font-bold font-mono text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Pegas</label>
                    <input
                      type="number"
                      min="0"
                      value={formPegas}
                      onChange={(e) => setFormPegas(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-700 mb-1">Arr. Laterales</label>
                    <input
                      type="number"
                      min="0"
                      value={formArrLat}
                      onChange={(e) => setFormArrLat(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-sky-300 font-mono text-sky-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 mb-1">Arr. Cabeceras</label>
                    <input
                      type="number"
                      min="0"
                      value={formArrCab}
                      onChange={(e) => setFormArrCab(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-indigo-300 font-mono text-indigo-800"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/40 p-3 rounded-2xl border border-rose-200/70">
                <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider block mb-2">
                  Defectos Directos de Estampación (Piezas)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Manchas', val: formManchas, set: setFormManchas },
                    { label: 'Falta Pintura', val: formFaltaPintura, set: setFormFaltaPintura },
                    { label: 'Repise', val: formRepise, set: setFormRepise },
                    { label: 'Grasa', val: formGrasa, set: setFormGrasa },
                    { label: 'Penetración', val: formPenetracion, set: setFormPenetracion },
                    { label: 'Descases', val: formDescases, set: setFormDescases },
                    { label: 'Quemadas', val: formQuemadas, set: setFormQuemadas },
                    { label: 'Logos Corridos', val: formLogosCorridos, set: setFormLogosCorridos },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{f.label}</label>
                      <input
                        type="number"
                        min="0"
                        value={f.val}
                        onChange={(e) => f.set(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance de Producción en Tiempo Real (Mini Control Dashboard) */}
              {(() => {
                const totalEstLive =
                  formManchas + formRepise + formFaltaPintura + formLogosCorridos +
                  formPenetracion + formGrasa + formDescases + formQuemadas;
                const totalSegTallerLive = formPegas + formArrLat + formArrCab + totalEstLive;
                const otrosProcesosLive = formTotalRevisada - (formCantBuena + totalSegTallerLive);
                const isBalanced = otrosProcesosLive === 0;
                const isOverTotal = otrosProcesosLive < 0;

                const pctBuenas = formTotalRevisada > 0 ? ((formCantBuena / formTotalRevisada) * 100).toFixed(1) : '0';
                const pctTaller = formTotalRevisada > 0 ? ((totalSegTallerLive / formTotalRevisada) * 100).toFixed(1) : '0';
                const pctOtros = formTotalRevisada > 0 && otrosProcesosLive > 0 ? ((otrosProcesosLive / formTotalRevisada) * 100).toFixed(1) : '0';

                return (
                  <div className="bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100/70 rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3">
                    {/* Encabezado y Estado */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                          isOverTotal ? 'bg-rose-100 text-rose-700' : isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs block leading-tight">
                            Balance del Lote en Tiempo Real
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Revisadas = Primeras + Seg. Taller + Seg. Otros Procesos
                          </span>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 font-black px-2.5 py-1 rounded-xl text-[10px] border shadow-2xs ${
                        isOverTotal
                          ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                          : isBalanced
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                      }`}>
                        {isOverTotal && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        {isBalanced && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {!isBalanced && !isOverTotal && <Factory className="w-3.5 h-3.5 text-purple-600" />}
                        {isOverTotal
                          ? `Exceso de ${Math.abs(otrosProcesosLive)} pz sobre revisadas`
                          : isBalanced
                            ? '✓ 100% Cuadre exacto (Taller)'
                            : `${otrosProcesosLive} pz Segundas Otros Procesos`}
                      </span>
                    </div>

                    {/* Barra visual de distribución porcentual */}
                    {formTotalRevisada > 0 && (
                      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden flex shadow-inner">
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, (formCantBuena / formTotalRevisada) * 100))}%` }}
                          className="bg-emerald-500 h-full transition-all duration-300"
                          title={`Primeras Buenas: ${formCantBuena} (${pctBuenas}%)`}
                        />
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, (totalSegTallerLive / formTotalRevisada) * 100))}%` }}
                          className="bg-amber-500 h-full transition-all duration-300"
                          title={`Segundas Taller: ${totalSegTallerLive} (${pctTaller}%)`}
                        />
                        {otrosProcesosLive > 0 && (
                          <div
                            style={{ width: `${Math.min(100, (otrosProcesosLive / formTotalRevisada) * 100)}%` }}
                            className="bg-purple-500 h-full transition-all duration-300"
                            title={`Segundas Otros Procesos: ${otrosProcesosLive} (${pctOtros}%)`}
                          />
                        )}
                      </div>
                    )}

                    {/* 4 Mini Tarjetas de Distribución */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Revisadas</span>
                        <span className="text-sm font-black text-slate-900 font-mono">{formTotalRevisada}</span>
                        <span className="text-[9px] text-slate-400 block">100% lote</span>
                      </div>

                      <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200/80 shadow-2xs">
                        <span className="text-[9px] font-bold text-emerald-700 block uppercase">1ª Buenas</span>
                        <span className="text-sm font-black text-emerald-800 font-mono">{formCantBuena}</span>
                        <span className="text-[9px] text-emerald-600 font-semibold block">{pctBuenas}%</span>
                      </div>

                      <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-200/80 shadow-2xs">
                        <span className="text-[9px] font-bold text-amber-800 block uppercase">Seg. Taller</span>
                        <span className="text-sm font-black text-amber-900 font-mono">{totalSegTallerLive}</span>
                        <span className="text-[9px] text-amber-700 font-semibold block">{pctTaller}% ({formPegas}p·{formArrLat+formArrCab}a·{totalEstLive}e)</span>
                      </div>

                      <div className={`p-2 rounded-xl border shadow-2xs ${
                        isOverTotal ? 'bg-rose-50 border-rose-200' : 'bg-purple-50/60 border-purple-200/80'
                      }`}>
                        <span className={`text-[9px] font-bold block uppercase ${isOverTotal ? 'text-rose-700' : 'text-purple-700'}`}>
                          {isOverTotal ? 'Descuadre' : 'Seg. Otros Proc.'}
                        </span>
                        <span className={`text-sm font-black font-mono ${isOverTotal ? 'text-rose-800' : 'text-purple-900'}`}>
                          {otrosProcesosLive}
                        </span>
                        <span className={`text-[9px] font-semibold block ${isOverTotal ? 'text-rose-600' : 'text-purple-600'}`}>
                          {isOverTotal ? 'Exceso' : `${pctOtros}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Observaciones</label>
                <input
                  type="text"
                  placeholder="ej: Ajuste de rasqueta en segundo turno..."
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                >
                  {editingRecord ? 'Guardar Cambios' : 'Registrar Inspección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: GESTIÓN DE DISEÑOS VISIBLES (TOP DISEÑOS) ── */}
      {isDesignManagerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Gestión de Diseños Visibles
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Activa o desactiva qué diseños ver en el gráfico
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDesignManagerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
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
                  {allTopDesigns.length - hiddenTopDesigns.length} de {allTopDesigns.length} visibles
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
                  const isHidden = hiddenTopDesigns.includes(d.name);
                  const isReactivo = d.process === 'REACTIVO';
                  const metricUnit = TOP_DESIGN_METRICS.find(m => m.id === topDesignMetric)?.unit || 'pz';
                  let metricVal = 0;
                  if (topDesignMetric === 'segundas') metricVal = d.totalSegundas;
                  else if (topDesignMetric === 'estampado') metricVal = d.defectosEstampado;
                  else if (topDesignMetric === 'revisadas') metricVal = d.totalRevisadas;
                  else if (topDesignMetric === 'pctSegundas') metricVal = d.pctSegundas;

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
                              {d.count} lote{d.count === 1 ? '' : 's'} · Segundas: {fmtInt(d.totalSegundas)} ({d.pctSegundas}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono text-xs font-black text-slate-800">
                          {topDesignMetric === 'pctSegundas' ? `${metricVal}%` : fmtInt(metricVal)} <span className="text-[10px] font-semibold text-slate-400">{metricUnit}</span>
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
                Listo ({allTopDesigns.length - hiddenTopDesigns.length} visibles)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modern Floating Toast Notification ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm sm:max-w-md w-full pointer-events-none p-2">
          <div
            className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-slate-900/95 text-white border-emerald-500/40 shadow-emerald-950/30'
                : toast.type === 'error'
                ? 'bg-slate-900/95 text-white border-rose-500/40 shadow-rose-950/30'
                : 'bg-slate-900/95 text-white border-blue-500/40 shadow-blue-950/30'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                toast.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : toast.type === 'error'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 stroke-[2.5]" />}
              {toast.type === 'info' && <Info className="w-5 h-5 stroke-[2.5]" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight">
                {toast.title}
              </h4>
              {toast.message && (
                <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed font-medium">
                  {toast.message}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de Carga Periódica de Excel (Acumular Historial vs Reemplazar) ── */}
      {importPending && (
        <div className="fixed inset-0 z-[9997] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Carga Mensual de Planilla de Calidad</h3>
                  <p className="text-xs text-emerald-100 font-medium truncate max-w-[280px]">
                    {importPending.fileName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportPending(null)}
                className="p-1.5 rounded-xl hover:bg-white/20 transition-colors text-white/80 hover:text-white cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Resumen de Detección */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">En Archivo</span>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{importPending.importedRecords.length}</p>
                  <span className="text-[10px] text-slate-500 font-medium">registros</span>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">En Historial</span>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{records.length}</p>
                  <span className="text-[10px] text-slate-500 font-medium">guardados</span>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200/80 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Nuevos</span>
                  <p className="text-lg font-black text-emerald-700 mt-0.5">+{importPending.newRecords.length}</p>
                  <span className="text-[10px] text-emerald-600 font-medium">a incorporar</span>
                </div>
              </div>

              {/* Períodos detectados */}
              <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Mes(es) detectado(s) en este archivo:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {importPending.detectedMonths.map(m => (
                    <span key={m.key} className="px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-900 text-xs font-extrabold border border-emerald-200">
                      {m.label} ({m.count} lotes)
                    </span>
                  ))}
                </div>
                {importPending.duplicatesCount > 0 && (
                  <p className="text-[11px] text-slate-500 font-medium mt-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{importPending.duplicatesCount} registros ya existían en el historial y se conservarán sin duplicar.</span>
                  </p>
                )}
              </div>

              {/* Opciones de carga */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-bold text-slate-800">
                  ¿Cómo deseas cargar esta planilla mensual?
                </p>

                {/* Opción A: Acumular (Recomendada) */}
                <button
                  type="button"
                  onClick={handleConfirmAccumulate}
                  className="w-full text-left p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 hover:bg-emerald-100/80 transition-all cursor-pointer group shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-950">Acumular y Mantener Todo el Historial</span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-600 text-white tracking-wider">Recomendado</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium mt-0.5 leading-relaxed">
                        Mantiene intactos todos los meses anteriores ({records.length} registros) y agrega los {importPending.newRecords.length} nuevos lotes de este mes.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Opción B: Reemplazar */}
                <button
                  type="button"
                  onClick={handleConfirmReplace}
                  className="w-full text-left p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 group-hover:text-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800">Reemplazar Todo el Historial</span>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                        Borra el historial previo y deja únicamente los {importPending.importedRecords.length} registros de este archivo.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setImportPending(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Confirmation Modal ── */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden p-6 transition-all transform">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmDialog.danger
                    ? 'bg-rose-50 border-rose-100 text-rose-600'
                    : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}
              >
                {confirmDialog.danger ? (
                  <AlertTriangle className="w-6 h-6 stroke-[2]" />
                ) : (
                  <Info className="w-6 h-6 stroke-[2]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-normal">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                  confirmDialog.danger
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                {confirmDialog.danger && <Trash2 className="w-3.5 h-3.5" />}
                {confirmDialog.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
