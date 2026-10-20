import React, { useEffect, useState, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Printer, Download, X, QrCode, Tag, CheckCircle2,
  Calendar, Clock, User, Layers, Info, Copy, Check
} from 'lucide-react';
import { WorkOrder, PantoneColor, Design } from '../types';

export interface BucketLabelPayload {
  version: '1.0';
  app: 'CONTEX';
  type: 'INK_BUCKET';
  orderId: string;
  orderNumber: string;
  designName: string;
  pantoneCode: string;
  pantoneHex: string;
  frameIndex: number;
  totalFrames: number;
  kg: number;
  process: 'REACTIVO' | 'PIGMENTO';
  operator: string;
  timestamp: string;
  formulas?: Array<{ component: string; percentage: number; grams: number }>;
}

interface InkBucketLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder | null;
  pantones: PantoneColor[];
  designs: Design[];
  initialColorIndex?: number;
  operatorName?: string;
}

export default function InkBucketLabelModal({
  isOpen,
  onClose,
  order,
  pantones,
  designs,
  initialColorIndex = 0,
  operatorName = 'Laboratorio CONTEX'
}: InkBucketLabelModalProps) {
  const [selectedColorIdx, setSelectedColorIdx] = useState<number>(initialColorIndex);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [customKg, setCustomKg] = useState<string>('');
  const labelRef = useRef<HTMLDivElement>(null);
  const lastPayloadRef = useRef<string>('');

  useEffect(() => {
    setSelectedColorIdx(initialColorIndex);
  }, [initialColorIndex]);

  // Obtener el diseño y los colores de la orden
  const design = order?.designId ? designs.find(d => d.id === order.designId) : null;
  const isReactive = (order?.lineType || design?.lineType)?.toLowerCase() === 'reactivo';
  const processLabel = isReactive ? 'REACTIVO' : 'PIGMENTO';

  // Lista de tonos de la orden (MEMOIZADA para evitar re-creación en cada render)
  const colorsList = useMemo(() => {
    if (design?.colors?.length) {
      return design.colors.map((c, i) => {
        const pantone = pantones.find(p => p.code.toLowerCase().trim() === c.pantoneCode.toLowerCase().trim());
        const historyKg = order?.preparedHistory?.[c.pantoneCode] || [];
        const totalPreparedKg = historyKg.reduce((a, b) => a + b, 0);
        return {
          idx: i,
          pantoneCode: c.pantoneCode,
          pantoneHex: pantone?.hex || '#64748b',
          pantoneName: pantone?.name || 'Tono de Diseño',
          formulas: pantone?.formulas || [],
          totalPreparedKg: totalPreparedKg > 0 ? totalPreparedKg : 5
        };
      });
    }
    if (order?.pantoneCode) {
      return [{
        idx: 0,
        pantoneCode: order.pantoneCode,
        pantoneHex: order.pantoneHex || '#64748b',
        pantoneName: 'Tono Individual',
        formulas: pantones.find(p => p.code === order.pantoneCode)?.formulas || [],
        totalPreparedKg: (order.targetGrammage ? order.targetGrammage / 1000 : 5)
      }];
    }
    return [];
  }, [design, order, pantones]);

  const activeColor = colorsList[selectedColorIdx] || colorsList[0];

  // Determinar los kilos a rotular en la etiqueta
  const effectiveKg = customKg && parseFloat(customKg) > 0
    ? parseFloat(customKg)
    : (activeColor?.totalPreparedKg || 5);

  // Generar el código QR únicamente cuando cambie la carga real
  useEffect(() => {
    if (!isOpen || !order || !activeColor) {
      setQrDataUrl('');
      lastPayloadRef.current = '';
      return;
    }

    const orderNumber = order.id ? order.id.slice(-5).toUpperCase() : '00001';
    const payload: BucketLabelPayload = {
      version: '1.0',
      app: 'CONTEX',
      type: 'INK_BUCKET',
      orderId: order.id || '',
      orderNumber: `#${orderNumber}`,
      designName: order.designName || design?.name || 'DISEÑO ESTÁNDAR',
      pantoneCode: activeColor.pantoneCode,
      pantoneHex: activeColor.pantoneHex,
      frameIndex: activeColor.idx + 1,
      totalFrames: colorsList.length || 1,
      kg: Number(effectiveKg.toFixed(2)),
      process: processLabel,
      operator: order.assignedTo || operatorName,
      timestamp: new Date().toISOString(),
      formulas: (activeColor.formulas || []).map(f => ({
        component: f.component,
        percentage: f.percentage,
        grams: Number((effectiveKg * f.percentage).toFixed(2))
      }))
    };

    const payloadString = JSON.stringify(payload);
    if (lastPayloadRef.current === payloadString) return;
    lastPayloadRef.current = payloadString;

    QRCode.toDataURL(payloadString, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Error generando QR de balde:', err));
  }, [isOpen, order?.id, activeColor?.pantoneCode, effectiveKg, processLabel, operatorName, colorsList.length, design?.name]);

  if (!isOpen || !order || !activeColor) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyPayload = () => {
    if (!qrDataUrl) return;
    const orderNumber = order.id ? order.id.slice(-5).toUpperCase() : '00001';
    const text = `CONTEX - BALDE DE TINTA\nOT #${orderNumber} | ${order.designName || 'Diseño'}\nPantone: ${activeColor.pantoneCode}\nPeso: ${effectiveKg.toFixed(2)} Kg\nProceso: ${processLabel}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `Etiqueta_Balde_${activeColor.pantoneCode}_OT-${order.id?.slice(-5) || '000'}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[75] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Etiqueta Adhesiva para Balde de Tinta</h3>
              <p className="text-xs text-indigo-200/80">Código QR de verificación para prensista y control de laboratorio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de tonos si la orden tiene múltiples marcos */}
        {colorsList.length > 1 && (
          <div className="bg-slate-100/90 border-b border-slate-200/80 p-3 sm:px-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" /> Baldes / Marcos:
            </span>
            {colorsList.map((c, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedColorIdx(i);
                  setCustomKg('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  selectedColorIdx === i
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-300 font-black'
                    : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300/80'
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c.pantoneHex }} />
                <span>M{i + 1}: {c.pantoneCode}</span>
                <span className="text-[10px] opacity-75 font-mono">{c.totalPreparedKg}k</span>
              </button>
            ))}
          </div>
        )}

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Ajuste manual de Kilos rotulados (opcional si este balde tiene un peso diferente) */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-700">Peso rotulado en este recipiente:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0.1"
                placeholder={activeColor.totalPreparedKg.toString()}
                value={customKg}
                onChange={e => setCustomKg(e.target.value)}
                className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-1 font-mono font-black text-blue-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="font-bold text-slate-500">Kg de Tinta</span>
            </div>
          </div>

          {/* ── VISTA PREVIA DE LA ETIQUETA ADHESIVA (PRINTABLE STICKER) ── */}
          <div className="flex justify-center">
            <div
              ref={labelRef}
              id="printable-bucket-label"
              className="w-full max-w-md bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden font-sans text-slate-900"
              style={{ minHeight: '260px' }}
            >
              {/* Barra superior de marca */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                    C
                  </div>
                  <div>
                    <h4 className="font-black text-sm tracking-tight leading-none text-slate-900">CONTEX ESTAMPACIÓN</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5">Control de Tintas de Laboratorio</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                    processLabel === 'REACTIVO'
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {processLabel}
                  </span>
                  <p className="text-[10px] font-mono font-bold text-slate-600 mt-0.5">
                    OT #{order.id ? order.id.slice(-5).toUpperCase() : '00001'}
                  </p>
                </div>
              </div>

              {/* Contenido principal: Datos + Código QR */}
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Lado izquierdo: Datos del balde */}
                <div className="col-span-7 space-y-2">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Diseño</span>
                    <p className="font-black text-sm sm:text-base text-slate-900 leading-tight truncate">
                      {order.designName || design?.name || 'DISEÑO ESTÁNDAR'}
                    </p>
                    <p className="text-[10px] font-medium text-slate-500 truncate">
                      {order.productType} · {order.targetQuantity} pz
                    </p>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider">Tono / Marco</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div
                        className="w-4 h-4 rounded-md border border-slate-300 shrink-0"
                        style={{ backgroundColor: activeColor.pantoneHex }}
                      />
                      <span className="font-black text-sm text-slate-900 font-mono leading-none">
                        {activeColor.pantoneCode}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 ml-auto font-mono">
                        M{activeColor.idx + 1}/{colorsList.length || 1}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[8px] font-black uppercase text-slate-400 block">Peso Neto</span>
                      <span className="font-mono font-black text-lg text-blue-700 leading-none">
                        {effectiveKg.toFixed(2)} <span className="text-xs font-bold text-blue-500">Kg</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-black uppercase text-slate-400 block">Fecha y Turno</span>
                      <span className="text-[10px] font-mono font-bold text-slate-600 block">
                        {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lado derecho: Código QR de alta resolución */}
                <div className="col-span-5 flex flex-col items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Código QR de Verificación de Balde"
                      className="w-28 h-28 sm:w-32 sm:h-32 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-28 h-28 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center">
                      <QrCode className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <span className="text-[8px] font-black text-slate-500 mt-1 uppercase tracking-tight">
                    Escanear en Máquina
                  </span>
                </div>
              </div>

              {/* Desglose rápido de fórmula al pie de la etiqueta */}
              {activeColor.formulas && activeColor.formulas.length > 0 && (
                <div className="mt-3 pt-2 border-t border-dashed border-slate-300">
                  <span className="text-[8px] font-bold uppercase text-slate-400 block mb-1">
                    Fórmula pesada ({effectiveKg.toFixed(1)} Kg de pasta):
                  </span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono text-slate-600">
                    {activeColor.formulas.map((f, i) => (
                      <div key={i} className="flex justify-between truncate">
                        <span className="truncate pr-1">• {f.component}</span>
                        <span className="font-bold shrink-0">{(effectiveKg * f.percentage).toFixed(1)}g</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pie de etiqueta */}
              <div className="mt-2.5 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-400 font-medium">
                <span>Operador: {order.assignedTo || operatorName}</span>
                <span>CONTEX Sistema de Calidad Textil</span>
              </div>
            </div>
          </div>

          {/* Información y Consejos para el taller */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">¿Cómo utilizar esta etiqueta en el taller?</p>
              <p className="text-[11px] text-blue-800/90 leading-relaxed">
                Pega este adhesivo directamente en el balde de plástico de 5 Kg, 10 Kg o 20 Kg. Cuando el prensista vaya a cargar la máquina, puede pulsar <strong>"Escanear Balde"</strong> con la cámara de su teléfono o tablet para comprobar al instante que el tono y la fórmula corresponden exactamente a la orden activa.
              </p>
            </div>
          </div>
        </div>

        {/* Footer del Modal con Acciones de Impresión y Descarga */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPayload}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Copiar resumen del balde"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
            <button
              onClick={handleDownloadImage}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Descargar imagen PNG del QR"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Guardar QR</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Etiqueta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
