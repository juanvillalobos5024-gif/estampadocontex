import { PantoneColor } from '../types';

/**
 * Lógica compartida de "Computer Vision": separación de marcos por color
 * y sugerencia automática de Pantone. Usada por ImageAnalyzer y DesignManager.
 */

export interface AnalyzedColor {
  hex: string;
  rgb: [number, number, number];
  pixelCount: number;
  percentage: number;
  areaM2: number;
  previewUrl: string;
  closestPantoneId?: string;
  closestPantoneCode?: string;
  closestPantoneName?: string;
}

export interface AnalyzeOptions {
  widthCm: number;
  heightCm: number;
  piezasPorGolpe: number;
  tolerance?: number;          // Distancia RGB para fusionar tonos (default 30)
  minCoverage?: number;        // % mínimo de cobertura para considerar un marco (default 1.5)
  includeWhitePadding?: boolean; // Suma el blanco de fondo al color dominante (default true)
}

export const MAX_ANALYSIS_DIM = 800;
export const PANTONE_MATCH_MAX_DISTANCE = 80;

export const colorDistance = (c1: [number, number, number], c2: [number, number, number]) =>
  Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );

export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();

export const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
};

/** Gramos de tinta estimados para un área (m²) dado el volumen teórico (cm³/m²). */
export const calculateInkGrams = (areaM2: number, volumenTeorico: number = 15) => {
  const k_trans = 0.85;
  const rho = 1.05;
  const gramos = (areaM2 * 10000) * (volumenTeorico / 10000) * k_trans * rho;
  return gramos * 1.10;
};

/** Dibuja una imagen en un canvas reduciéndola a MAX_ANALYSIS_DIM para analizarla rápido. */
export function drawImageToCanvas(src: string, canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('No se pudo obtener el contexto del canvas'));

      let scale = 1;
      if (img.width > MAX_ANALYSIS_DIM || img.height > MAX_ANALYSIS_DIM) {
        scale = Math.min(MAX_ANALYSIS_DIM / img.width, MAX_ANALYSIS_DIM / img.height);
      }
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para analizar'));
    img.src = src;
  });
}

/** Analiza los píxeles de un canvas ya dibujado y devuelve los marcos (grupos de color) detectados. */
export function analyzeCanvasColors(
  canvas: HTMLCanvasElement,
  pantones: PantoneColor[],
  options: AnalyzeOptions
): AnalyzedColor[] {
  const {
    widthCm,
    heightCm,
    piezasPorGolpe,
    tolerance = 30,
    minCoverage = 1.5,
    includeWhitePadding = true
  } = options;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const totalPixels = canvas.width * canvas.height;
  const totalAreaM2 = (widthCm / 100) * (heightCm / 100) * piezasPorGolpe;

  const colorGroups: { rgb: [number, number, number]; count: number }[] = [];
  let whitePixelsCount = 0;

  const step = 4;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 50) continue;
    if (r > 240 && g > 240 && b > 240) {
      if (includeWhitePadding) whitePixelsCount++;
      continue;
    }

    const pixelColor: [number, number, number] = [r, g, b];

    let foundGroup = false;
    for (let j = 0; j < colorGroups.length; j++) {
      if (colorDistance(colorGroups[j].rgb, pixelColor) < tolerance) {
        colorGroups[j].count++;
        colorGroups[j].rgb[0] = Math.round((colorGroups[j].rgb[0] * colorGroups[j].count + r) / (colorGroups[j].count + 1));
        colorGroups[j].rgb[1] = Math.round((colorGroups[j].rgb[1] * colorGroups[j].count + g) / (colorGroups[j].count + 1));
        colorGroups[j].rgb[2] = Math.round((colorGroups[j].rgb[2] * colorGroups[j].count + b) / (colorGroups[j].count + 1));
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      colorGroups.push({ rgb: pixelColor, count: 1 });
    }
  }

  colorGroups.sort((a, b) => b.count - a.count);

  if (includeWhitePadding && whitePixelsCount > 0 && colorGroups.length > 0) {
    colorGroups[0].count += whitePixelsCount;
  }

  const mainGroup = colorGroups[0];
  const minPixelsThreshold = totalPixels * (minCoverage / 100);
  const validGroups = colorGroups.filter(group => group.count >= minPixelsThreshold);

  return validGroups.map(group => {
    const percentage = (group.count / totalPixels) * 100;

    // Fotolito aislado del marco
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d')!;
    const tImageData = tCtx.createImageData(canvas.width, canvas.height);

    const isMainGroup = group === mainGroup;

    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const isWhite = r > 240 && g > 240 && b > 240;

      if (a >= 50 && (colorDistance(group.rgb, [r, g, b]) < tolerance || (includeWhitePadding && isWhite && isMainGroup))) {
        tImageData.data[i] = r;
        tImageData.data[i + 1] = g;
        tImageData.data[i + 2] = b;
        tImageData.data[i + 3] = 255;
      } else {
        tImageData.data[i + 3] = 0;
      }
    }
    tCtx.putImageData(tImageData, 0, 0);
    const previewUrl = tempCanvas.toDataURL();

    // Pantone más cercano del catálogo
    let closestPantoneId: string | undefined;
    let closestPantoneCode: string | undefined;
    let closestPantoneName: string | undefined;
    let minDistance = Infinity;

    pantones.forEach(p => {
      if (!p.hex) return;
      const dist = colorDistance(group.rgb, hexToRgb(p.hex));
      if (dist < minDistance && dist < PANTONE_MATCH_MAX_DISTANCE) {
        minDistance = dist;
        closestPantoneId = p.id;
        closestPantoneCode = p.code;
        closestPantoneName = `${p.code} - ${p.name}`;
      }
    });

    return {
      hex: rgbToHex(group.rgb[0], group.rgb[1], group.rgb[2]),
      rgb: group.rgb,
      pixelCount: group.count,
      percentage,
      areaM2: totalAreaM2 * (percentage / 100),
      previewUrl,
      closestPantoneId,
      closestPantoneCode,
      closestPantoneName
    };
  });
}

/**
 * Atajo todo-en-uno: carga la imagen (URL o data-URL) en un canvas fuera de pantalla,
 * la analiza y devuelve los marcos detectados. Cede el hilo antes de procesar
 * para que la UI pueda pintar el estado "Analizando...".
 */
export async function analyzeImageSource(
  src: string,
  pantones: PantoneColor[],
  options: AnalyzeOptions
): Promise<AnalyzedColor[]> {
  const canvas = document.createElement('canvas');
  await drawImageToCanvas(src, canvas);
  await new Promise(resolve => setTimeout(resolve, 50));
  return analyzeCanvasColors(canvas, pantones, options);
}
