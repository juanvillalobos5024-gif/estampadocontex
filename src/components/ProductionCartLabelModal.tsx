import React, { useEffect, useState, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Printer, Download, X, QrCode, Tag, CheckCircle2,
  Calendar, Clock, User, Layers, Info, Copy, Check,
  ShoppingCart, ArrowRight, Gauge, Scale, Sparkles
} from 'lucide-react';
import { WorkOrder, Design, PantoneColor } from '../types';

export type CartProductionStage =
  | 'En Estampado'
  | 'Estampado Finalizado (Esperando Horno)'
  | 'En Horno / Termofijado'
  | 'En Revisión y Calidad'
  | 'En Confección / Doblez / Empaque'
  | 'Empacado / Finalizado';

export interface CartLabelPayload {
  version: '1.0';
  app: 'CONTEX';
  type: 'PRODUCTION_CART';
  cartNumber: number;
  cartLabel: string;
  orderId: string;
  orderNumber: string;
  designName: string;
  productReference: string;
  productType: string;
  units: number;
  totalMeters: number;
  totalKg: number;
  technique: 'REACTIVO' | 'PIGMENTO';
  stage: CartProductionStage;
  operator: string;
  timestamp: string;
  totalColors: number;
  colors: string[];
}

interface ProductionCartLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder | null;
  designs: Design[];
  pantones: PantoneColor[];
  defaultCartNumber?: number;
}

export default function ProductionCartLabelModal({
  isOpen,
  onClose,
  order,
  designs,
  pantones,
  defaultCartNumber = 1
}: ProductionCartLabelModalProps) {
  const [cartNumber, setCartNumber] = useState<number>(defaultCartNumber);
  const [selectedStage, setSelectedStage] = useState<CartProductionStage>('Estampado Finalizado (Esperando Horno)');
  const [customUnits, setCustomUnits] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const lastPayloadRef = useRef<string>('');

  useEffect(() => {
    setCartNumber(defaultCartNumber);
  }, [defaultCartNumber]);

  // Encontrar el diseño de la orden
  const design = useMemo(() => {
    return order?.designId ? designs.find(d => d.id === order.designId) : null;
  }, [order?.designId, designs]);

  const isReactive = (order?.lineType || design?.lineType)?.toLowerCase() === 'reactivo';
  const techniqueLabel: 'REACTIVO' | 'PIGMENTO' = isReactive ? 'REACTIVO' : 'PIGMENTO';

  // Métricas de producción (unidades, metros, peso en tela)
  const effectiveUnits = customUnits && parseInt(customUnits, 10) > 0
    ? parseInt(customUnits, 10)
    : (order?.targetQuantity || 100);

  const metrics = useMemo(() => {
    const isPigmentoToalla = order?.productType === 'Toallas' && !isReactive;
    const widthM = isPigmentoToalla ? 0.35 : ((design?.widthCm || 60) / 100);
    const heightM = isPigmentoToalla ? 0.60 : ((design?.heightCm || 120) / 100);
    const areaM2 = widthM * heightM;
    const unitWeightG = isPigmentoToalla ? 63 : (design?.unitWeight || Math.round(areaM2 * (design?.gramaje || 280)));
    const totalKg = Number(((effectiveUnits * unitWeightG) / 1000).toFixed(1));
    const totalMeters = Number((effectiveUnits * heightM).toFixed(1));

    return {
      widthM,
      heightM,
      areaM2,
      unitWeightG,
      totalKg,
      totalMeters
    };
  }, [order?.productType, isReactive, design, effectiveUnits]);

  // Lista de colores del diseño
  const colorCodes = useMemo(() => {
    if (design?.colors?.length) {
      return design.colors.map(c => c.pantoneCode);
    }
    return order?.pantoneCode ? [order.pantoneCode] : [];
  }, [design, order?.pantoneCode]);

  // Generar QR de forma controlada sin loops infinitos
  useEffect(() => {
    if (!isOpen || !order) {
      setQrDataUrl('');
      lastPayloadRef.current = '';
      return;
    }

    const orderNumber = order.id ? order.id.slice(-5).toUpperCase() : '00001';
    const payload: CartLabelPayload = {
      version: '1.0',
      app: 'CONTEX',
      type: 'PRODUCTION_CART',
      cartNumber: cartNumber,
      cartLabel: `CARRO #${String(cartNumber).padStart(2, '0')}`,
      orderId: order.id || '',
      orderNumber: `#${orderNumber}`,
      designName: order.designName || design?.name || 'DISEÑO ESTÁNDAR',
      productReference: order.productReference || order.designName || order.productType || 'Toalla',
      productType: order.productType || 'Toallas',
      units: effectiveUnits,
      totalMeters: metrics.totalMeters,
      totalKg: metrics.totalKg,
      technique: techniqueLabel,
      stage: selectedStage,
      operator: order.assignedTo || 'Prensista',
      timestamp: new Date().toISOString(),
      totalColors: colorCodes.length || 1,
      colors: colorCodes
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
      .catch(err => console.error('Error generando QR de carro:', err));
  }, [isOpen, order?.id, cartNumber, effectiveUnits, metrics.totalKg, metrics.totalMeters, techniqueLabel, selectedStage, order?.assignedTo, colorCodes, design?.name, order?.productReference, order?.productType, order?.designName]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyPayload = () => {
    if (!qrDataUrl) return;
    const orderNumber = order.id ? order.id.slice(-5).toUpperCase() : '00001';
    const text = `CONTEX - FICHA DE CARRO #${cartNumber}\nOT #${orderNumber} | ${order.designName || 'Diseño'}\nUnidades: ${effectiveUnits} pz | Peso: ${metrics.totalKg} Kg | Metros: ${metrics.totalMeters} m\nTécnica: ${techniqueLabel}\nEstado: ${selectedStage}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `Ficha_Carro_${cartNumber}_OT-${order.id?.slice(-5) || '000'}.png`;
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
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Ficha y Etiqueta de Carro de Producción</h3>
              <p className="text-xs text-indigo-200/80">Trazabilidad de lote, unidades, peso y etapas en planta</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ajuste: Asignar Carro # y Estado Actual */}
        <div className="bg-slate-100/90 border-b border-slate-200/80 p-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Asignar Carro Físico # */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" /> Carro Físico #:
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCartNumber(num)}
                  className={`w-7 h-7 rounded-lg font-mono font-black text-xs transition-all cursor-pointer ${
                    cartNumber === num
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {num}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="99"
                value={cartNumber}
                onChange={e => setCartNumber(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-12 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-mono font-black text-xs text-indigo-700"
                title="Escribir otro número de carro"
              />
            </div>
          </div>

          {/* Estado de Etapa */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 uppercase tracking-wider">Etapa:</span>
            <select
              value={selectedStage}
              onChange={e => setSelectedStage(e.target.value as CartProductionStage)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="En Estampado">1. En Estampado / Llenándose</option>
              <option value="Estampado Finalizado (Esperando Horno)">2. Estampado Finalizado (➔ Horno)</option>
              <option value="En Horno / Termofijado">3. En Horno / Termofijado</option>
              <option value="En Revisión y Calidad">4. En Revisión y Calidad</option>
              <option value="En Confección / Doblez / Empaque">5. En Empaque / Confección</option>
              <option value="Empacado / Finalizado">6. Empacado / Finalizado</option>
            </select>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Ajuste de Unidades en el Carro */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-700">Prendas / Toallas cargadas en este carro:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                placeholder={order.targetQuantity.toString()}
                value={customUnits}
                onChange={e => setCustomUnits(e.target.value)}
                className="w-28 bg-white border border-slate-300 rounded-xl px-3 py-1 font-mono font-black text-indigo-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="font-bold text-slate-500">Unidades</span>
            </div>
          </div>

          {/* ── FICHA / ETIQUETA IMPRIMIBLE DE CARRO ── */}
          <div className="flex justify-center">
            <div
              ref={labelRef}
              id="printable-cart-label"
              className="w-full max-w-lg bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden font-sans text-slate-900"
              style={{ minHeight: '300px' }}
            >
              {/* Cabecera institucional con número de Carro grande */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-base flex items-center justify-center shadow-xs">
                    C
                  </div>
                  <div>
                    <h4 className="font-black text-base tracking-tight leading-none text-slate-900">CONTEX ESTAMPACIÓN</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">Control de Carro en Planta</p>
                  </div>
                </div>

                {/* Número de Carro en formato gigante tipo chapa industrial */}
                <div className="bg-indigo-900 text-white px-3.5 py-1.5 rounded-xl border border-indigo-950 flex items-center gap-2 shadow-xs">
                  <ShoppingCart className="w-4 h-4 text-indigo-300" />
                  <span className="font-mono font-black text-lg tracking-tight">CARRO #{String(cartNumber).padStart(2, '0')}</span>
                </div>
              </div>

              {/* Estado de Etapa destacado */}
              <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Estado / Etapa:</span>
                <span className="font-black text-xs text-indigo-950 uppercase tracking-tight flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  {selectedStage}
                </span>
              </div>

              {/* Grid: Información del Lote + Código QR */}
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Lado izquierdo: Metadatos del Lote */}
                <div className="col-span-7 space-y-2">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Diseño y Referencia</span>
                    <p className="font-black text-base text-slate-900 leading-tight truncate">
                      {order.designName || design?.name || 'DISEÑO ESTÁNDAR'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-600 truncate mt-0.5">
                      {order.productReference || order.productType}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[8px] font-black uppercase text-slate-400 block">OT / Lote</span>
                      <span className="font-mono font-black text-slate-900">
                        OT #{order.id ? order.id.slice(-5).toUpperCase() : '00001'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase text-slate-400 block">Técnica</span>
                      <span className={`inline-block text-[9px] font-black px-1.5 py-0.2 rounded border ${
                        techniqueLabel === 'REACTIVO'
                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        {techniqueLabel}
                      </span>
                    </div>
                  </div>

                  {/* 3 Métricas Clave de Carga */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-200 text-center">
                    <div className="bg-blue-50/70 p-1.5 rounded-lg border border-blue-200/60">
                      <span className="text-[8px] font-black uppercase text-blue-600 block">Unidades</span>
                      <span className="font-mono font-black text-sm text-blue-900 leading-none">
                        {effectiveUnits}
                      </span>
                    </div>
                    <div className="bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-200/60">
                      <span className="text-[8px] font-black uppercase text-emerald-600 block">Tela Total</span>
                      <span className="font-mono font-black text-sm text-emerald-900 leading-none">
                        {metrics.totalKg} <span className="text-[9px] font-bold">Kg</span>
                      </span>
                    </div>
                    <div className="bg-purple-50/70 p-1.5 rounded-lg border border-purple-200/60">
                      <span className="text-[8px] font-black uppercase text-purple-600 block">Longitud</span>
                      <span className="font-mono font-black text-sm text-purple-900 leading-none">
                        {metrics.totalMeters} <span className="text-[9px] font-bold">m</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lado derecho: Código QR de Trazabilidad de Carro */}
                <div className="col-span-5 flex flex-col items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Código QR de Ficha de Carro"
                      className="w-28 h-28 sm:w-32 sm:h-32 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-28 h-28 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center">
                      <QrCode className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <span className="text-[8px] font-black text-slate-600 mt-1 uppercase tracking-tight">
                    Escanear en Hornos / Empaque
                  </span>
                </div>
              </div>

              {/* Marcos / Tintas amarradas a este carro */}
              {colorCodes.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-dashed border-slate-300">
                  <div className="flex items-center justify-between text-[8px] font-bold uppercase text-slate-400 mb-1">
                    <span>Marcos / Colores de la orden ({colorCodes.length}):</span>
                    <span>Operador: {order.assignedTo || 'Prensista'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {colorCodes.map((code, i) => {
                      const p = pantones.find(x => x.code.toLowerCase().trim() === code.toLowerCase().trim());
                      return (
                        <div key={i} className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-200">
                          <span className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: p?.hex || '#94a3b8' }} />
                          <span className="font-bold text-slate-800">{code}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pie de Ficha */}
              <div className="mt-2.5 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-400 font-medium">
                <span>Fecha emisión: {new Date().toLocaleDateString('es-ES')}</span>
                <span>Ficha Viajera de Planta · CONTEX</span>
              </div>
            </div>
          </div>

          {/* Guía Operativa para la planta */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 text-xs text-indigo-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Uso de la Ficha en el Carro:</p>
              <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                Coloca esta hoja impresa en la funda plástica transparente del <strong>Carro #{cartNumber}</strong>. Cada vez que el carro ruede a Hornos, Calidad o Empaque, el operario escanea el QR con su cámara para verificar la orden y avanzar el estado de la tela con un solo toque.
              </p>
            </div>
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPayload}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Copiar texto resumen del carro"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
            <button
              onClick={handleDownloadImage}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Guardar código QR en imagen"
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ficha de Carro</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
