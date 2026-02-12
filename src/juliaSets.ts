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

export interface MultibrotPreset {
  id: string;
  name: string;
  power: number;
}

export const multibrotPresets: MultibrotPreset[] = [
  { id: 'cubic', name: 'Cubic (z³)', power: 3 },
  { id: 'quartic', name: 'Quartic (z⁴)', power: 4 },
  { id: 'quintic', name: 'Quintic (z⁵)', power: 5 },
  { id: 'sextic', name: 'Sextic (z⁶)', power: 6 },
];

export function getJuliaPresetById(id: string): JuliaPreset | undefined {
  return juliaPresets.find(p => p.id === id);
}

export function getMultibrotPresetById(id: string): MultibrotPreset | undefined {
  return multibrotPresets.find(p => p.id === id);
}

export function fractalSetToUrlParams(set: FractalSet): Record<string, string> {
  if (set.type === 'mandelbrot') {
    return {};
  }
  if (set.type === 'burning-ship') {
    return { set: 'ship' };
  }
  if (set.type === 'tricorn') {
    return { set: 'tricorn' };
  }
  if (set.type === 'multibrot') {
    const preset = multibrotPresets.find(p => p.power === set.power);
    if (preset) {
      return { set: 'multi', p: preset.id };
    }
    return { set: 'multi', pow: String(set.power) };
  }
  if (set.type === 'julia') {
    // Find if it matches a preset
    const preset = juliaPresets.find(p => p.cr === set.cr && p.ci === set.ci);
    if (preset) {
      return { set: 'julia', j: preset.id };
    }
    // Custom Julia set
    return { set: 'julia', jr: String(set.cr), ji: String(set.ci) };
  }
  return {};
}

export function fractalSetFromUrlParams(params: URLSearchParams): FractalSet {
  const setType = params.get('set');
  
  if (setType === 'ship') {
    return { type: 'burning-ship' };
  }
  if (setType === 'tricorn') {
    return { type: 'tricorn' };
  }
  if (setType === 'multi') {
    const presetId = params.get('p');
    if (presetId) {
      const preset = getMultibrotPresetById(presetId);
      if (preset) {
        return { type: 'multibrot', power: preset.power };
      }
    }
    const pow = parseFloat(params.get('pow') || '3');
    return { type: 'multibrot', power: pow };
  }
  if (setType === 'julia') {
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
  
  return { type: 'mandelbrot' };
}
