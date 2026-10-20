import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera, CameraOff, X, CheckCircle2, AlertTriangle, ShieldCheck,
  RotateCcw, Sparkles, Layers, Search, Upload, Info, ArrowRight, Zap,
  ShoppingCart, Check, ChevronRight, Scale, Gauge
} from 'lucide-react';
import { WorkOrder, PantoneColor, Design } from '../types';
import { BucketLabelPayload } from './InkBucketLabelModal';
import { CartLabelPayload, CartProductionStage } from './ProductionCartLabelModal';

interface InkBucketScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  selectedOrderId?: string;
  designs: Design[];
  pantones: PantoneColor[];
  onConfirmMountToMachine?: (orderId: string, pantoneCode: string) => Promise<void>;
}

const CART_STAGES: CartProductionStage[] = [
  'En Estampado',
  'Estampado Finalizado (Esperando Horno)',
  'En Horno / Termofijado',
  'En Revisión y Calidad',
  'En Confección / Doblez / Empaque',
  'Empacado / Finalizado'
];

export default function InkBucketScannerModal({
  isOpen,
  onClose,
  workOrders,
  selectedOrderId,
  designs,
  pantones,
  onConfirmMountToMachine
}: InkBucketScannerModalProps) {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedPayload, setScannedPayload] = useState<BucketLabelPayload | null>(null);
  const [scannedCartPayload, setScannedCartPayload] = useState<CartLabelPayload | null>(null);
  const [cartStageUpdated, setCartStageUpdated] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [isProcessingMount, setIsProcessingMount] = useState<boolean>(false);
  const [mountSuccess, setMountSuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const pantonesRef = useRef<PantoneColor[]>(pantones);
  const selectedOrderIdRef = useRef<string | undefined>(selectedOrderId);

  useEffect(() => {
    pantonesRef.current = pantones;
  }, [pantones]);

  useEffect(() => {
    selectedOrderIdRef.current = selectedOrderId;
  }, [selectedOrderId]);

  // Reproducir sonido de confirmación (bip industrial agradable)
  const playBeep = useCallback((success: boolean = true) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Ignorar si el navegador bloquea audio sin interacción previa
    }
  }, []);

  // Detener la cámara y el ciclo de escaneo
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Función de decodificación frame a frame (optimizada y throttled a ~3-4 FPS para evitar freeze de CPU)
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      scanLoopRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const now = performance.now();
    // Throttle: procesar frame máximo una vez cada 250ms (ahorra 95% de CPU y evita congelar la interfaz)
    if (now - lastScanTimeRef.current < 250) {
      scanLoopRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    lastScanTimeRef.current = now;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      scanLoopRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    // Downscale del canvas a resolución óptima ligera (máx 360px) para decodificación casi instantánea
    const maxDim = 360;
    const scale = Math.min(maxDim / (video.videoWidth || 640), maxDim / (video.videoHeight || 480), 1);
    const targetW = Math.round((video.videoWidth || 640) * scale);
    const targetH = Math.round((video.videoHeight || 480) * scale);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.drawImage(video, 0, 0, targetW, targetH);
    const imageData = ctx.getImageData(0, 0, targetW, targetH);

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
      try {
        const parsed = JSON.parse(code.data);
        if (parsed && parsed.type === 'PRODUCTION_CART') {
          setScannedCartPayload(parsed);
          setScannedPayload(null);
          setCartStageUpdated(false);
          playBeep(true);
          stopCamera();
          return;
        }
        if (parsed && (parsed.type === 'INK_BUCKET' || parsed.pantoneCode)) {
          setScannedPayload(parsed);
          setScannedCartPayload(null);
          playBeep(true);
          stopCamera();
          return;
        }
      } catch {
        // Podría ser un código de texto plano como "PANTONE 18-1662"
        const foundPantone = pantonesRef.current.find(p => p.code.toLowerCase().includes(code.data.toLowerCase()));
        if (foundPantone) {
          setScannedPayload({
            version: '1.0',
            app: 'CONTEX',
            type: 'INK_BUCKET',
            orderId: selectedOrderIdRef.current || '',
            orderNumber: '#00000',
            designName: 'Identificado por Tono',
            pantoneCode: foundPantone.code,
            pantoneHex: foundPantone.hex,
            frameIndex: 1,
            totalFrames: 1,
            kg: 5,
            process: 'PIGMENTO',
            operator: 'Operador',
            timestamp: new Date().toISOString(),
            formulas: (foundPantone.formulas || []).map(f => ({
              component: f.component,
              percentage: f.percentage,
              grams: 5 * f.percentage
            }))
          });
          playBeep(true);
          stopCamera();
          return;
        }
      }
    }

    scanLoopRef.current = requestAnimationFrame(scanFrame);
  }, [playBeep, stopCamera]);

  // Iniciar la cámara del dispositivo
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setMountSuccess(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo o navegador.');
      }

      // Priorizar cámara trasera (environment) para enfocar recipientes
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        lastScanTimeRef.current = performance.now();
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn('Error al acceder a la cámara:', err);
      setCameraError(err?.message || 'No se pudo acceder a la cámara. Revisa los permisos o ingresa el código manualmente.');
      setCameraActive(false);
    }
  }, [scanFrame]);

  useEffect(() => {
    if (isOpen) {
      setScannedPayload(null);
      setMountSuccess(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Analizar si el balde escaneado coincide con la orden seleccionada
  const targetOrder = selectedOrderId
    ? workOrders.find(o => o.id === selectedOrderId)
    : scannedPayload?.orderId
    ? workOrders.find(o => o.id === scannedPayload.orderId)
    : null;

  const orderMatches = Boolean(
    targetOrder &&
    scannedPayload &&
    (!selectedOrderId || targetOrder.id === selectedOrderId || (scannedPayload.orderId && scannedPayload.orderId === targetOrder.id))
  );

  // Comprobar si el color del balde pertenece al diseño de la orden
  const targetDesign = targetOrder?.designId ? designs.find(d => d.id === targetOrder.designId) : null;
  const colorBelongsToDesign = Boolean(
    targetDesign?.colors?.some(c =>
      scannedPayload?.pantoneCode &&
      c.pantoneCode.toLowerCase().trim() === scannedPayload.pantoneCode.toLowerCase().trim()
    ) ||
    (targetOrder?.pantoneCode && scannedPayload?.pantoneCode && targetOrder.pantoneCode.toLowerCase().trim() === scannedPayload.pantoneCode.toLowerCase().trim())
  );

  const isFullyVerified = orderMatches && colorBelongsToDesign;

  // Manejo de carga de imagen con QR desde archivo (fallback si no hay cámara activa)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          try {
            const parsed = JSON.parse(code.data);
            if (parsed && parsed.type === 'PRODUCTION_CART') {
              setScannedCartPayload(parsed);
              setScannedPayload(null);
              setCartStageUpdated(false);
              playBeep(true);
              stopCamera();
              return;
            }
            if (parsed && (parsed.type === 'INK_BUCKET' || parsed.pantoneCode)) {
              setScannedPayload(parsed);
              setScannedCartPayload(null);
              playBeep(true);
              stopCamera();
              return;
            }
            setCameraError('El código QR no pertenece a un balde ni a un carro de CONTEX.');
          } catch {
            setCameraError('El código QR de la imagen no contiene datos de CONTEX reconocidos.');
          }
        } else {
          setCameraError('No se detectó ningún código QR en la imagen seleccionada.');
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    const clean = manualCode.trim().toLowerCase();

    // Comprobar si se escribió un número de carro (ej: "carro 1", "carro #2", "1")
    const cartMatch = clean.match(/^(?:carro\s*#?|c#?)?(\d+)$/i);
    if (cartMatch) {
      const num = parseInt(cartMatch[1], 10);
      const target = (selectedOrderId ? workOrders.find(o => o.id === selectedOrderId) : null) || workOrders[0];
      if (target) {
        const d = target.designId ? designs.find(item => item.id === target.designId) : null;
        const isReactive = (target.lineType || d?.lineType)?.toLowerCase() === 'reactivo';
        const isPigmentoToalla = target.productType === 'Toallas' && !isReactive;
        const widthM = isPigmentoToalla ? 0.35 : ((d?.widthCm || 60) / 100);
        const heightM = isPigmentoToalla ? 0.60 : ((d?.heightCm || 120) / 100);
        const unitWeightG = isPigmentoToalla ? 63 : (d?.unitWeight || Math.round(widthM * heightM * (d?.gramaje || 280)));
        const totalKg = Number(((target.targetQuantity * unitWeightG) / 1000).toFixed(1));
        const totalMeters = Number((target.targetQuantity * heightM).toFixed(1));

        setScannedCartPayload({
          version: '1.0',
          app: 'CONTEX',
          type: 'PRODUCTION_CART',
          cartNumber: num || 1,
          cartLabel: `CARRO #${String(num || 1).padStart(2, '0')}`,
          orderId: target.id || '',
          orderNumber: `#${target.id ? target.id.slice(-5).toUpperCase() : '0001'}`,
          designName: target.designName || d?.name || 'DISEÑO CONTEX',
          productReference: target.productReference || target.productType || 'Toallas',
          productType: target.productType || 'Toallas',
          units: target.targetQuantity || 100,
          totalMeters: totalMeters,
          totalKg: totalKg,
          technique: isReactive ? 'REACTIVO' : 'PIGMENTO',
          stage: 'Estampado Finalizado (Esperando Horno)',
          operator: target.assignedTo || 'Prensista',
          timestamp: new Date().toISOString(),
          totalColors: d?.colors?.length || 1,
          colors: d?.colors ? d.colors.map(c => c.pantoneCode) : []
        });
        setScannedPayload(null);
        setCartStageUpdated(false);
        playBeep(true);
        stopCamera();
        return;
      }
    }

    const foundPantone = pantones.find(p => p.code.toLowerCase().includes(clean) || p.name?.toLowerCase().includes(clean));

    if (foundPantone) {
      setScannedPayload({
        version: '1.0',
        app: 'CONTEX',
        type: 'INK_BUCKET',
        orderId: selectedOrderId || '',
        orderNumber: '#MANUAL',
        designName: 'Búsqueda Manual',
        pantoneCode: foundPantone.code,
        pantoneHex: foundPantone.hex,
        frameIndex: 1,
        totalFrames: 1,
        kg: 5,
        process: 'PIGMENTO',
        operator: 'Prensista',
        timestamp: new Date().toISOString(),
        formulas: (foundPantone.formulas || []).map(f => ({
          component: f.component,
          percentage: f.percentage,
          grams: 5 * f.percentage
        }))
      });
      setScannedCartPayload(null);
      playBeep(true);
      stopCamera();
    } else {
      setCameraError(`No se encontró ningún Pantone o Carro que coincida con "${manualCode}".`);
    }
  };

  const handleConfirmMount = async () => {
    if (!scannedPayload || !onConfirmMountToMachine) return;
    setIsProcessingMount(true);
    try {
      const orderIdToMount = targetOrder?.id || scannedPayload.orderId;
      await onConfirmMountToMachine(orderIdToMount, scannedPayload.pantoneCode);
      setMountSuccess(true);
      playBeep(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setCameraError('Error al confirmar montaje: ' + (err?.message || err));
    } finally {
      setIsProcessingMount(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="bg-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Escáner de Baldes y Carros</h3>
              <p className="text-xs text-slate-400">Verificación de tintas y trazabilidad de carros por etapas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Cámara / Resultados */}
        <div className="p-4 sm:p-6 space-y-4">
          {scannedCartPayload ? (
            /* ── RESULTADO DE ESCANEO DE CARRO DE PRODUCCIÓN ── */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Tarjeta Principal de Carro */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-indigo-800 shadow-md">
                <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white text-indigo-950 font-black text-base flex items-center justify-center shadow-xs">
                      <ShoppingCart className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-mono font-black text-lg tracking-tight text-white leading-none">
                        CARRO #{String(scannedCartPayload.cartNumber).padStart(2, '0')}
                      </h4>
                      <p className="text-[10px] font-bold text-indigo-200/80 uppercase tracking-wider mt-1">
                        Hoja de Ruta de Planta
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-black text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-lg">
                    {scannedCartPayload.orderNumber}
                  </span>
                </div>

                {/* Etapa Actual con pulso */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-indigo-200 tracking-wider">
                    Etapa Actual:
                  </span>
                  <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {scannedCartPayload.stage}
                  </span>
                </div>
              </div>

              {/* Métricas clave del carro: Unidades, Metros, Kilos */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
                  <span className="text-[9px] font-black uppercase text-blue-600 block">Unidades</span>
                  <span className="font-mono font-black text-base text-blue-950">
                    {scannedCartPayload.units}
                  </span>
                  <span className="text-[9px] font-bold text-blue-700 block mt-0.5">piezas</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <span className="text-[9px] font-black uppercase text-emerald-600 block">Tela Total</span>
                  <span className="font-mono font-black text-base text-emerald-950">
                    {scannedCartPayload.totalKg}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 block mt-0.5">Kg</span>
                </div>
                <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
                  <span className="text-[9px] font-black uppercase text-purple-600 block">Metros Tela</span>
                  <span className="font-mono font-black text-base text-purple-950">
                    {scannedCartPayload.totalMeters}
                  </span>
                  <span className="text-[9px] font-bold text-purple-700 block mt-0.5">metros</span>
                </div>
              </div>

              {/* Ficha de Lote y Diseño */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Diseño:</span>
                  <span className="font-black text-slate-900">{scannedCartPayload.designName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Referencia:</span>
                  <span className="font-bold text-slate-800">{scannedCartPayload.productReference} ({scannedCartPayload.productType})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Técnica:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                    scannedCartPayload.technique === 'REACTIVO'
                      ? 'bg-purple-100 text-purple-900 border-purple-200'
                      : 'bg-amber-100 text-amber-900 border-amber-200'
                  }`}>
                    {scannedCartPayload.technique}
                  </span>
                </div>

                {/* Marcos / Tintas vinculadas */}
                {scannedCartPayload.colors && scannedCartPayload.colors.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-500 uppercase text-[9px] block mb-1">
                      Marcos / Colores vinculados ({scannedCartPayload.colors.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {scannedCartPayload.colors.map((c, i) => {
                        const p = pantones.find(x => x.code.toLowerCase().trim() === c.toLowerCase().trim());
                        return (
                          <div key={i} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-mono text-[10px]">
                            <span className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: p?.hex || '#94a3b8' }} />
                            <span className="font-bold text-slate-800">{c}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Selector / Actualizador de Etapa para el Carro */}
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-indigo-950 flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-600" /> Cambiar Etapa del Carro:
                  </span>
                  {cartStageUpdated && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full animate-fade-in flex items-center gap-1">
                      <Check className="w-3 h-3" /> Etapa actualizada
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CART_STAGES.map((stg, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setScannedCartPayload({
                          ...scannedCartPayload,
                          stage: stg
                        });
                        setCartStageUpdated(true);
                        playBeep(true);
                      }}
                      className={`p-2 rounded-xl text-[10px] font-bold text-left transition-all border cursor-pointer ${
                        scannedCartPayload.stage === stg
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white text-slate-700 border-indigo-100 hover:bg-indigo-100/60'
                      }`}
                    >
                      <span className="block opacity-60 text-[8px]">Paso {i + 1}</span>
                      <span className="truncate block font-black">{stg.replace(/ \(Esperando Horno\)/, '')}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setScannedCartPayload(null);
                    setScannedPayload(null);
                    setCartStageUpdated(false);
                    startCamera();
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Escanear Otro Carro o Balde</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : !scannedPayload ? (
            <>
              {/* Visor de Video en Vivo */}
              <div className="relative w-full aspect-4/3 sm:aspect-16/10 bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraActive ? (
                  <>
                    {/* Cuadro de enfoque y animación láser de escaneo industrial */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                      <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-blue-500/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]">
                        {/* Esquinas decorativas de escáner */}
                        <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-blue-400 -mt-1 -ml-1 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-blue-400 -mt-1 -mr-1 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-blue-400 -mb-1 -ml-1 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-blue-400 -mb-1 -mr-1 rounded-br-lg" />

                        {/* Línea roja láser móvil */}
                        <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
                      <span className="bg-slate-900/90 text-slate-200 text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700/80 shadow-md">
                        Apunta el código QR de la etiqueta del balde
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-slate-400 space-y-3">
                    <CameraOff className="w-12 h-12 mx-auto text-slate-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-300">Cámara no conectada o bloqueada</p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                        {cameraError || 'Permite el acceso a la cámara en el navegador o carga una foto de la etiqueta.'}
                      </p>
                    </div>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Reintentar Cámara
                    </button>
                  </div>
                )}
              </div>

              {/* Métodos Alternativos: Subir Foto o Búsqueda Manual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Cargar foto */}
                <label className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Subir foto de la etiqueta</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                {/* Búsqueda manual rápida */}
                <form onSubmit={handleManualSearch} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Buscar Pantone o Carro (ej: 18-1662 o Carro 1)..."
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shrink-0 transition-colors cursor-pointer flex items-center justify-center"
                    title="Buscar por código"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* ── RESULTADO DE VERIFICACIÓN DE BALDE Y FÓRMULA ── */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Banner de Validación */}
              {isFullyVerified ? (
                <div className="bg-emerald-50 border-2 border-emerald-500/80 rounded-2xl p-4 text-emerald-950 flex items-start gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-emerald-950 leading-tight">
                      ✓ FÓRMULA VERIFICADA — BALDE CORRECTO
                    </h4>
                    <p className="text-xs text-emerald-800 mt-1">
                      El balde coincide al 100% con la Orden activa <strong>#{scannedPayload.orderNumber}</strong> ({scannedPayload.designName}). La tinta está aprobada para cargar en máquina.
                    </p>
                  </div>
                </div>
              ) : orderMatches && !colorBelongsToDesign ? (
                <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-4 text-amber-950 flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-amber-950 leading-tight">
                      ATENCIÓN: TONO NO RECONOCIDO EN ESTE DISEÑO
                    </h4>
                    <p className="text-xs text-amber-800 mt-1">
                      La orden coincide pero el Pantone <strong>{scannedPayload.pantoneCode}</strong> no está listado en los marcos de este diseño. Verifica con laboratorio antes de estampar.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-4 text-rose-950 flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-rose-950 leading-tight">
                      ALERTA: ESTE BALDE CORRESPONDE A OTRA ORDEN
                    </h4>
                    <p className="text-xs text-rose-800 mt-1">
                      Este recipiente fue rotulado para la <strong>OT {scannedPayload.orderNumber}</strong> ({scannedPayload.designName}).
                      {targetOrder ? ` Tu orden activa actual es la #${targetOrder.id?.slice(-5) || ''}.` : ''} ¡No lo cargues en la máquina para evitar errores de color!
                    </p>
                  </div>
                </div>
              )}

              {/* Ficha técnica del balde escaneado */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg border border-slate-300 shadow-sm shrink-0"
                      style={{ backgroundColor: scannedPayload.pantoneHex }}
                    />
                    <div>
                      <h5 className="font-black text-base text-slate-900 leading-none">
                        {scannedPayload.pantoneCode}
                      </h5>
                      <span className="text-[10px] font-bold text-slate-500">
                        Marco {scannedPayload.frameIndex} de {scannedPayload.totalFrames} · Proceso {scannedPayload.process}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Peso Neto</span>
                    <span className="font-mono font-black text-base text-blue-700">
                      {scannedPayload.kg} Kg
                    </span>
                  </div>
                </div>

                {/* Desglose de componentes pesados en laboratorio */}
                {scannedPayload.formulas && scannedPayload.formulas.length > 0 ? (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Fórmula pesada registrada en laboratorio:
                    </span>
                    <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 space-y-1">
                      {scannedPayload.formulas.map((f, i) => (
                        <div key={i} className="flex justify-between items-center text-xs font-mono text-slate-700">
                          <span className="font-medium text-slate-800">• {f.component}</span>
                          <span className="font-bold text-blue-700">{f.grams.toFixed(1)} g</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sin desglose de componentes en el QR.</p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>Operador: {scannedPayload.operator || 'Laboratorio'}</span>
                  <span>Fecha: {new Date(scannedPayload.timestamp).toLocaleDateString('es-ES')}</span>
                </div>
              </div>

              {/* Botón de acción si es confirmado */}
              {mountSuccess ? (
                <div className="p-3 bg-emerald-100 text-emerald-900 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>¡Tinta montada en máquina con éxito!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setScannedPayload(null);
                      setMountSuccess(false);
                      startCamera();
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Escanear Otro Balde</span>
                  </button>

                  {onConfirmMountToMachine && (
                    <button
                      onClick={handleConfirmMount}
                      disabled={isProcessingMount}
                      className="flex-1 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{isProcessingMount ? 'Confirmando...' : 'Confirmar en Máquina'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-3 sm:px-6 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            Sistema de Verificación de Laboratorio CONTEX
          </span>
          <button
            onClick={onClose}
            className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
