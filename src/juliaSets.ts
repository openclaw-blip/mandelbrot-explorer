import { FractalSet } from './hooks/useWebGLMandelbrot';

export interface JuliaPreset {
  id: string;
  name: string;
  cr: number;
  ci: number;
}

export const juliaPresets: JuliaPreset[] = [
  { id: 'dendrite', name: 'Dendrite', cr: 0, ci: 1 },
  { id: 'rabbit', name: 'Douady Rabbit', cr: -0.123, ci: 0.745 },
  { id: 'siegel', name: 'Siegel Disk', cr: -0.391, ci: -0.587 },
  { id: 'dragon', name: 'Dragon', cr: -0.8, ci: 0.156 },
  { id: 'spiral', name: 'Spiral', cr: -0.75, ci: 0.11 },
  { id: 'galaxy', name: 'Galaxy', cr: -0.4, ci: 0.6 },
  { id: 'lightning', name: 'Lightning', cr: -0.70176, ci: -0.3842 },
  { id: 'snowflake', name: 'Snowflake', cr: -0.1, ci: 0.651 },
];

export function getJuliaPresetById(id: string): JuliaPreset | undefined {
  return juliaPresets.find(p => p.id === id);
}

export function fractalSetToUrlParams(set: FractalSet): Record<string, string> {
  if (set.type === 'mandelbrot') {
    return {};
  }
  // Find if it matches a preset
  const preset = juliaPresets.find(p => p.cr === set.cr && p.ci === set.ci);
  if (preset) {
    return { set: 'julia', j: preset.id };
  }
  // Custom Julia set
  return { set: 'julia', jr: String(set.cr), ji: String(set.ci) };
}

export function fractalSetFromUrlParams(params: URLSearchParams): FractalSet {
  const setType = params.get('set');
  if (setType !== 'julia') {
    return { type: 'mandelbrot' };
  }
  
  // Check for preset
  const presetId = params.get('j');
  if (presetId) {
    const preset = getJuliaPresetById(presetId);
    if (preset) {
      return { type: 'julia', cr: preset.cr, ci: preset.ci };
    }
  }
  
  // Custom Julia
  const jr = parseFloat(params.get('jr') || '0');
  const ji = parseFloat(params.get('ji') || '0');
  return { type: 'julia', cr: jr, ci: ji };
}
