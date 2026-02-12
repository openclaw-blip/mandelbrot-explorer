export interface ColorTheme {
  id: string;
  name: string;
  colors: [number, number, number][]; // RGB 0-1
}

export const colorThemes: ColorTheme[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: [
      [1.0, 0.0, 1.0],      // Hot pink
      [0.0, 1.0, 1.0],      // Cyan
      [0.616, 0.0, 1.0],    // Purple
      [0.0, 0.4, 1.0],      // Electric blue
      [1.0, 0.0, 0.5],      // Hot pink variant
      [0.0, 0.784, 1.0],    // Light cyan
      [0.784, 0.0, 1.0],    // Light purple
      [0.0, 0.588, 1.0],    // Sky blue
    ],
  },
  {
    id: 'frost',
    name: 'Frost',
    colors: [
      [0.85, 0.9, 0.95],    // Ice white
      [0.6, 0.75, 0.85],    // Pale blue
      [0.4, 0.55, 0.7],     // Steel blue
      [0.25, 0.4, 0.55],    // Slate
      [0.15, 0.25, 0.4],    // Deep slate
      [0.3, 0.5, 0.65],     // Muted blue
      [0.5, 0.65, 0.8],     // Light steel
      [0.7, 0.8, 0.9],      // Pale grey-blue
    ],
  },
  {
    id: 'fire',
    name: 'Inferno',
    colors: [
      [1.0, 1.0, 0.9],      // White hot
      [1.0, 0.95, 0.4],     // Yellow
      [1.0, 0.7, 0.0],      // Orange
      [1.0, 0.4, 0.0],      // Deep orange
      [0.9, 0.15, 0.0],     // Red-orange
      [0.6, 0.0, 0.0],      // Deep red
      [0.3, 0.0, 0.0],      // Dark red
      [0.1, 0.0, 0.0],      // Near black
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: [
      [0.9, 0.98, 1.0],     // Seafoam white
      [0.4, 0.85, 0.9],     // Turquoise
      [0.0, 0.7, 0.8],      // Teal
      [0.0, 0.5, 0.7],      // Ocean blue
      [0.0, 0.35, 0.6],     // Deep sea
      [0.0, 0.2, 0.4],      // Abyss
      [0.1, 0.5, 0.5],      // Sea green
      [0.3, 0.75, 0.7],     // Aquamarine
    ],
  },
  {
    id: 'classic',
    name: 'Classic',
    colors: [
      [0.0, 0.0, 0.5],      // Navy
      [0.0, 0.0, 1.0],      // Blue
      [0.0, 0.5, 1.0],      // Sky blue
      [0.0, 1.0, 1.0],      // Cyan
      [0.0, 1.0, 0.5],      // Spring green
      [0.0, 1.0, 0.0],      // Green
      [0.5, 1.0, 0.0],      // Yellow-green
      [1.0, 1.0, 0.0],      // Yellow
    ],
  },
];

export const defaultTheme = colorThemes[0];

export function getThemeById(id: string): ColorTheme {
  return colorThemes.find(t => t.id === id) || defaultTheme;
}
