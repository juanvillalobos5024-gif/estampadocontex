import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend, ComposedChart, Line
} from 'recharts';
import { Table, Award, Zap, TrendingUp, Calendar, Layers, BarChart3 } from 'lucide-react';
import { DailyProductionRecord } from '../types';
import { getRecordKg, getRecordGolpes } from '../lib/dataService';

interface ProductionChartsProps {
  records: DailyProductionRecord[];
  weightUnit: 'kg' | 'g';
  periodLabel?: string;
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

export default function ProductionCharts({ records, weightUnit, periodLabel }: ProductionChartsProps) {
  const [metric, setMetric] = useState<ProductionMetric>('kg');

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

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalKg = records.reduce((a, r) => a + getRecordKg(r), 0);
    const totalUnits = records.reduce((a, r) => a + (r.units || 0), 0);
    const totalGolpes = records.reduce((a, r) => a + getRecordGolpes(r), 0);
    const byDate = new Map<string, number>();
    records.forEach(r => byDate.set(r.date, (byDate.get(r.date) || 0) + getRecordKg(r)));
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
  }, [records]);

  // ── Serie temporal (por día, o por mes si el rango es amplio) ──
  const { timeline, groupedByMonth } = useMemo(() => {
    const dates = records.map(r => r.date).sort();
    let byMonth = false;
    if (dates.length > 0) {
      const span = (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000;
      byMonth = span > 62;
    }

    const map = new Map<string, { key: string; label: string; reactivo: number; pigmento: number; total: number }>();
    records.forEach(r => {
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
  }, [records, metric, weightUnit]);

  // ── Distribución por proceso ──
  const processData = useMemo(() => {
    let reactivo = 0;
    let pigmento = 0;
    records.forEach(r => {
      const v = valueOf(r);
      if (r.process === 'REACTIVO') reactivo += v; else pigmento += v;
    });
    return [
      { name: 'Reactivo', value: round(reactivo), color: REACTIVO_COLOR },
      { name: 'Pigmento', value: round(pigmento), color: PIGMENTO_COLOR },
    ].filter(d => d.value > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, metric, weightUnit]);

  const processTotal = processData.reduce((a, d) => a + d.value, 0);
  const reactivoItem = processData.find(d => d.name === 'Reactivo');
  const pigmentoItem = processData.find(d => d.name === 'Pigmento');
  const reactivoVal = reactivoItem?.value || 0;
  const pigmentoVal = pigmentoItem?.value || 0;
  const reactivoPct = processTotal > 0 ? (reactivoVal / processTotal) * 100 : 0;
  const pigmentoPct = processTotal > 0 ? (pigmentoVal / processTotal) * 100 : 0;

  // ── Top diseños ──
  const designData = useMemo(() => {
    const map = new Map<string, { value: number; process: string }>();
    records.forEach(r => {
      const name = r.designName || 'SIN NOMBRE';
      const e = map.get(name) || { value: 0, process: r.process };
      e.value += valueOf(r);
      map.set(name, e);
    });
    return Array.from(map.entries())
      .map(([name, e]) => ({ name, value: round(e.value), process: e.process }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, metric, weightUnit]);

  // ── Por turno ──
  const shiftData = useMemo(() => {
    const map = new Map<number, number>();
    records.forEach(r => map.set(r.shift || 1, (map.get(r.shift || 1) || 0) + valueOf(r)));
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([shift, value]) => ({ name: `Turno ${shift}`, value: round(value), shift }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, metric, weightUnit]);

  const unitLabel = metricMeta[metric].unit;
  const fmtMetric = (n: number) => (metric === 'kg' && weightUnit === 'kg' ? fmtDec(n) : fmtInt(n));

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
      {/* ── KPIs EJECUTIVOS DE PRODUCCIÓN ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/80">
            <Table className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Tela producida</p>
            <p className="text-lg sm:text-2xl font-black text-amber-950 font-mono tracking-tight">
              {fmtDec(kpis.totalKg * wFactor, weightUnit === 'kg' ? 2 : 0)} <span className="text-xs font-bold text-amber-700">{wLabel}</span>
            </p>
            <p className="text-[9px] text-amber-600/80 font-medium truncate">
              Prom. {fmtDec(kpis.avgKgDay * wFactor, weightUnit === 'kg' ? 1 : 0)} {wLabel}/día
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/80">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Unidades</p>
            <p className="text-lg sm:text-2xl font-black text-blue-700 font-mono tracking-tight">
              {fmtInt(kpis.totalUnits)} <span className="text-xs font-bold text-blue-500">pz</span>
            </p>
            <p className="text-[9px] text-blue-600/80 font-medium truncate">Prom. {fmtInt(kpis.avgUnitsDay)} pz/día</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Golpes totales</p>
            <p className="text-lg sm:text-2xl font-black text-purple-900 font-mono tracking-tight">
              {fmtInt(kpis.totalGolpes)}
            </p>
            <p className="text-[9px] text-purple-600/80 font-medium truncate">En {kpis.days} día{kpis.days === 1 ? '' : 's'} de producción</p>
          </div>
        </div>

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

      {/* ── SELECTOR DE MÉTRICA COMPACTO ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-800">
            Métrica a Graficar {periodLabel ? <span className="text-slate-400 font-semibold hidden sm:inline">· {periodLabel}</span> : null}
          </span>
        </div>
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
      </div>

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
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Top diseños más producidos</h3>
              <p className="text-[10px] text-slate-400 font-medium">{metricMeta[metric].label} · hasta 10 diseños</p>
            </div>
          </div>
          <div style={{ height: Math.max(220, designData.length * 36) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={designData} layout="vertical" margin={{ top: 0, right: 35, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={105}
                  tick={{ fontSize: 9, fill: '#475569', fontWeight: 800 }}
                />
                <RechartsTooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ ...tooltipStyle, borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  formatter={(value: any) => [`${fmtMetric(Number(value))} ${unitLabel}`, metricMeta[metric].label]}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16} isAnimationActive={false} label={{ position: 'right', fontSize: 9, fill: '#475569', fontWeight: 700, formatter: (v: any) => fmtMetric(Number(v)) }}>
                  {designData.map((_, i) => <Cell key={i} fill={DESIGN_COLORS[i % DESIGN_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
    </div>
  );
}
