import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend, PieChart, Pie, ComposedChart, Line
} from 'recharts';
import { Table, Award, Zap, TrendingUp, Calendar, Layers, BarChart3 } from 'lucide-react';
import { DailyProductionRecord } from '../types';

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

const getGolpes = (r: DailyProductionRecord): number =>
  r.golpes || (r.widthM <= 0.40 ? Math.round(r.units / 5) : Math.round(r.units / 3));

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
    if (metric === 'kg') return (r.kgDay || 0) * wFactor;
    if (metric === 'units') return r.units || 0;
    return getGolpes(r);
  };

  const round = (n: number) => (metric === 'kg' ? Number(n.toFixed(weightUnit === 'kg' ? 2 : 0)) : Math.round(n));

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalKg = records.reduce((a, r) => a + (r.kgDay || 0), 0);
    const totalUnits = records.reduce((a, r) => a + (r.units || 0), 0);
    const totalGolpes = records.reduce((a, r) => a + getGolpes(r), 0);
    const byDate = new Map<string, number>();
    records.forEach(r => byDate.set(r.date, (byDate.get(r.date) || 0) + (r.kgDay || 0)));
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
      <div className="bg-white rounded-3xl border border-dashed border-slate-300 py-16 text-center shrink-0">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-500">No hay registros de producción para el periodo seleccionado</p>
        <p className="text-xs text-slate-400 mt-1">Cambia el periodo o registra golpes en el Reporte Diario para ver las gráficas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="production-charts-view">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Table className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tela producida</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono">
              {fmtDec(kpis.totalKg * wFactor, weightUnit === 'kg' ? 2 : 0)} {wLabel}
            </p>
            <p className="text-[9px] text-slate-400 font-medium">
              Prom. {fmtDec(kpis.avgKgDay * wFactor, weightUnit === 'kg' ? 1 : 0)} {wLabel} / día
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-sky-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unidades</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono">{fmtInt(kpis.totalUnits)} pz</p>
            <p className="text-[9px] text-slate-400 font-medium">Prom. {fmtInt(kpis.avgUnitsDay)} pz / día</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Golpes totales</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono">{fmtInt(kpis.totalGolpes)}</p>
            <p className="text-[9px] text-slate-400 font-medium">En {kpis.days} día{kpis.days === 1 ? '' : 's'} de producción</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mejor día</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono">{kpis.bestDay ? dayLabel(kpis.bestDay) : '-'}</p>
            <p className="text-[9px] text-slate-400 font-medium">
              {fmtDec(kpis.bestKg * wFactor, weightUnit === 'kg' ? 2 : 0)} {wLabel} de tela
            </p>
          </div>
        </div>
      </div>

      {/* ── Selector de métrica ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-700">
            Métrica a graficar{periodLabel ? <span className="text-slate-400 font-semibold"> · {periodLabel}</span> : null}
          </span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {(['kg', 'units', 'golpes'] as ProductionMetric[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                metric === m ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m === 'kg' ? (weightUnit === 'kg' ? 'Kilos' : 'Gramos') : m === 'units' ? 'Unidades' : 'Golpes'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Serie temporal + Distribución por proceso ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {metricMeta[metric].label} producidos {groupedByMonth ? 'por mes' : 'por día'}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Barras por proceso · línea = acumulado del periodo</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: any) => [`${fmtMetric(Number(value))} ${unitLabel}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Bar yAxisId="left" dataKey="Reactivo" stackId="p" fill={REACTIVO_COLOR} maxBarSize={36} />
                <Bar yAxisId="left" dataKey="Pigmento" stackId="p" fill={PIGMENTO_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line yAxisId="right" type="monotone" dataKey="acumulado" name="Acumulado" stroke="#0f172a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Reactivo vs Pigmento</h3>
              <p className="text-[10px] text-slate-400 font-medium">{metricMeta[metric].label}</p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={processData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  stroke="none"
                >
                  {processData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: any) => [`${fmtMetric(Number(value))} ${unitLabel}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-1">
            {processData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {fmtMetric(d.value)} {unitLabel}
                  <span className="text-slate-400 font-semibold ml-1.5">
                    ({processTotal > 0 ? fmtDec((d.value / processTotal) * 100, 1) : '0'}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top diseños + Por turno ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Top diseños más producidos</h3>
              <p className="text-[10px] text-slate-400 font-medium">{metricMeta[metric].label} · hasta 10 diseños</p>
            </div>
          </div>
          <div style={{ height: Math.max(220, designData.length * 38) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={designData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={130}
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 'bold' }}
                />
                <RechartsTooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => [`${fmtMetric(Number(value))} ${unitLabel}`, metricMeta[metric].label]}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} label={{ position: 'right', fontSize: 10, fill: '#475569', formatter: (v: any) => fmtMetric(Number(v)) }}>
                  {designData.map((_, i) => <Cell key={i} fill={DESIGN_COLORS[i % DESIGN_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Producción por turno</h3>
              <p className="text-[10px] text-slate-400 font-medium">{metricMeta[metric].label}</p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shiftData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => [`${fmtMetric(Number(value))} ${unitLabel}`, metricMeta[metric].label]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
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
