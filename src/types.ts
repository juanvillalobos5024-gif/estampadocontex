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
  formulas: PantoneFormulaComponent[];
  createdAt?: any;
}

export interface StockItem {
  id?: string;
  name: string;       // Nombre de la tinta/base, ej: "Base Clear 001"
  type: 'base' | 'pigmento' | 'aditivo' | 'colorante_reactivo' | 'pasta'; // Tipo de componente
  category?: 'serigrafia' | 'reactivo'; // Línea de trabajo / Sistema
  quantity: number;   // Cantidad actual en gramos
  minRequired: number; // Cantidad mínima de seguridad en gramos
  lastUpdated?: any;
}

export interface BatchLog {
  id?: string;
  pantoneCode: string;
  pantoneHex: string;
  productType: 'Toallas' | 'Hamacas' | 'Otros';
  quantity: number;      // Piezas a estampar
  totalGrammage: number; // Cantidad de mezcla a preparar en gramos (g)
  operator: string;      // Nombre del operador de mezclado / prensista
  timestamp: any;        // Fecha de preparación
  status: 'Completado' | 'En Mezclado' | 'Pendiente';
}

export interface TeamMember {
  id?: string;
  name: string;
  role: string;          // Rol en el taller, ej: "Prensista", "Auxiliar de Tono", etc.
  active: boolean;
}
