export interface PantoneFormulaComponent {
  component: string;
  description: string;
  percentage: number; // Porcentaje de 0 a 100
}

export interface PantoneColor {
  id?: string;
  code: string;       // Código Pantone, ej: "185 C"
  name: string;       // Nombre amigable, ej: "Rojo Vibrante Corporativo"
  hex: string;        // Representación en color HEX, ej: "#E21933"
  mesh: string;       // Recomendación de malla, ej: "90 hilos"
  squeegee: string;   // Dureza del rasero/squeegee, ej: "75 Shore"
  notes: string;      // Notas de laboratorio para impresión
  type?: 'Pigmento' | 'Reactivo';
  formulas: PantoneFormulaComponent[];
  createdAt?: any;
}

export interface StockItem {
  id?: string;
  name: string;       // Nombre de la tinta/base, ej: "Base Clear 001"
  type: string;       // Tipo de componente (Pigmento, Reactivo, Urea, Bicarbonato, etc.)
  category?: 'pigmento' | 'reactivo'; // Línea de trabajo / Sistema (Opcional o depreciado)
  quantity: number;   // Cantidad actual en gramos
  minRequired: number; // Cantidad mínima de seguridad en gramos
  hexColor?: string;   // Color visual representativo (opcional)
  lastUpdated?: any;
}

export interface DesignColor {
  pantoneCode: string;
  gramsPerPiece: number; previewUrl?: string;
}

export interface Design {
  id?: string;
  name: string;        // Nombre del diseño, ej: "Iron Man"
  imageUrl?: string;   // Imagen base64 del diseño
  frames?: number;     // Cantidad de marcos
  gramaje?: number;    // Gramaje de la tela (g/m²), ej: 280
  unitWeight?: number; // Peso por unidad / prenda en gramos (g), ej: 201.6
  widthCm?: number;    // Ancho en cm (ej. 60)
  heightCm?: number;   // Alto en cm (ej. 120)
  piezasPorGolpe?: number; // Piezas por golpe (ej. 3)
  areaPorToalla?: number;  // Área por toalla en m² (ej. 0.72)
  areaTotal?: number;      // Área total del golpe en m² (ej. 2.16)
  productType: 'Toallas' | 'Otros';
  lineType: 'pigmento' | 'reactivo';
  colors: DesignColor[]; // Colores requeridos y sus consumos
  createdAt?: any;
}

export interface BatchLog {
  id?: string;
  id_mezcla?: string;       // Identificador único del lote (ej. LOTE-20261015-01)
  orden_id?: string;        // El ID exacto de la orden de trabajo (ej. "A123")
  workOrderId?: string;     // Alias para compatibilidad de orden_id
  color_codigo?: string;    // El tono preparado ("A1", "A2", "A3" o Pantone code)
  fecha_hora_registro?: any;// Marca de tiempo exacta (timestamp con hora, minutos y segundos)
  estado?: 'completado' | 'consumido' | 'en_mezclado' | 'pendiente'; // Estado de la mezcla
  pantoneCode: string;
  pantoneHex: string;
  productType: 'Toallas' | 'Otros' | 'Otros';
  productReference?: string; // Referencia del producto, ej: "Toalla Jacquard Azul"
  lineType?: 'pigmento' | 'reactivo'; // Línea de trabajo / sistema
  quantity: number;      // Piezas a estampar
  totalGrammage: number; // Cantidad de mezcla a preparar en gramos (g)
  wasteGrams?: number;   // Tinta sobrante/merma registrada al finalizar el lote (g)
  operator: string;      // Nombre del operador de mezclado / prensista
  timestamp?: any;        // Fecha de preparación
  status: 'Completado' | 'En Mezclado' | 'Pendiente' | 'completado' | 'consumido';
  type?: 'preparacion' | 'consumo';
}

export interface WorkOrder {
  id?: string;
  // Puede ser una orden para un Pantone individual...
  pantoneCode?: string;
  pantoneHex?: string;
  targetGrammage?: number;
  
  // O puede ser para un Diseño multi-color...
  designId?: string;
  designName?: string;
  completedColors?: string[]; // Códigos de pantone ya pesados para este diseño
  completedFrames?: number[]; // Índices de marcos (colores) ya preparados; soporta pantones repetidos en un diseño
  preparedHistory?: Record<string, number[]>; // Historial de kgs preparados por cada pantone (pantoneCode -> [kg, kg...])

  productType: 'Toallas' | 'Otros' | 'Otros';
  productReference?: string;
  lineType?: 'pigmento' | 'reactivo';
  targetQuantity: number;
  assignedTo?: string; // Nombre del operario
  priority: 'Normal' | 'Urgente';
  status: 'Pendiente' | 'Preparando Tintas' | 'Tintas Listas' | 'Estampándose' | 'En Máquina' | 'Completada' | 'En Progreso' | 'Cancelada';
  orderDate?: string; // Fecha programada para la orden (YYYY-MM-DD)
  createdAt: any;
  completedAt?: any;
}

export interface TeamMember {
  id?: string;
  name: string;
  role: string;          // Rol en el taller, ej: "Prensista", "Auxiliar de Tono", etc.
  active: boolean;
}

export interface DailyProductionRecord {
  id?: string;
  date: string;          // Formato YYYY-MM-DD
  designName: string;    // Nombre del diseño (ej: "FRUTAS ANDU", "MINNIE MOUSE")
  shift: number;         // Turno (ej: 1, 2, 3)
  golpes?: number;       // Nº de golpes de máquina (ej: 828, 400)
  widthM: number;        // Medida 1 en metros (ej: 0.35, 0.60)
  heightM: number;       // Medida 2 en metros (ej: 0.60, 1.20)
  gramaje: number;       // Gramaje de la tela (ej: 300, 280 g/m²)
  process: 'PIGMENTO' | 'REACTIVO'; // Proceso de estampación
  areaM2: number;        // Área de la toalla en m² (widthM * heightM)
  unitWeightG: number;   // Peso de la unidad en gramos (areaM2 * gramaje)
  units: number;         // Unidades producidas (ej: 4140, 2400)
  kgDay: number;         // Kilos producidos en el día: (units * unitWeightG) / 1000
  notes?: string;
  workOrderId?: string;  // ID de la orden de trabajo origen
  status?: string;       // Estado de la orden (ej: 'Completada', 'En Progreso')
  createdAt?: any;
}

export interface SalidaInsumoRecord {
  id: string;
  date: string;          // Fecha de la salida (YYYY-MM-DD)
  periodStart?: string;  // Solo si el registro es un acumulado de un rango de fechas (date = último día)
  product: string;       // Nombre normalizado según inventario
  code: string;          // Nombre tal como aparece en el formulario de requisición
  grams: number;         // Cantidad en gramos
  line: 'pigmento' | 'reactivo';
  hex: string;
  source: string;        // Archivo Excel de origen
}

export interface DefectosEstampado {
  manchas: number;
  repise: number;
  faltaPintura: number;
  logosCorridos: number;
  penetracion: number;
  grasa: number;
  descases: number;
  quemadas: number;
  totalEstampado: number;
}

export interface SegundasRecord {
  id: string;
  fecha: string;               // YYYY-MM-DD
  fechaSerial?: number;        // Número serial de Excel
  revisadoras: string;         // Nombres de revisadoras
  cliente?: string;            // Cliente
  pedidoLinea?: string;        // # Pedido / Línea
  referencia: string;          // Referencia de tela (ML1002, C280T, etc.)
  dimensiones: string;         // Dimensiones (35*60-350, 60*120-280, etc.)
  diseno: string;              // Diseño textil (FRUTAS, SPIDERMAN, etc.)
  color?: string;              // Color o tipo (ej: EST)
  tecnica?: 'REACTIVO' | 'PIGMENTO'; // Técnica de estampación (Reactivo o Pigmento)
  cantTotalRevisada: number;   // Cantidad total de toallas revisadas
  cantBuena: number;           // Cantidad buena (primera calidad)
  pegas: number;               // Defecto pegas
  arreLaterales: number;       // Arreglo laterales
  pctLaterales: number;        // % Arreglo laterales
  arreCabeceras: number;       // Arreglo cabeceras
  pctCabeceras: number;        // % Arreglo cabeceras
  observaciones?: string;      // Observaciones
  defectosEstampado: DefectosEstampado;
  pctEstampado: number;        // % de defectos directos de estampado
  totalSegundas: number;       // pegas + arreLaterales + arreCabeceras + totalEstampado
  pctTotalSegundas: number;    // totalSegundas / cantTotalRevisada
}