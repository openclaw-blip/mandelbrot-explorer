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
  {
    id: 'synthwave',
    name: 'Synthwave',
    colors: [
      [0.1, 0.0, 0.2],      // Deep purple
      [0.4, 0.0, 0.6],      // Purple
      [0.8, 0.0, 0.5],      // Hot magenta
      [1.0, 0.2, 0.4],      // Neon pink
      [1.0, 0.5, 0.2],      // Orange
      [1.0, 0.8, 0.3],      // Golden
      [0.6, 0.2, 0.8],      // Violet
      [0.2, 0.0, 0.4],      // Dark purple
    ],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    colors: [
      [0.0, 0.1, 0.15],     // Night sky
      [0.0, 0.5, 0.3],      // Deep green
      [0.1, 0.9, 0.5],      // Bright green
      [0.3, 1.0, 0.7],      // Mint
      [0.5, 0.8, 1.0],      // Ice blue
      [0.6, 0.4, 0.9],      // Violet
      [0.4, 0.2, 0.6],      // Purple
      [0.1, 0.3, 0.4],      // Dark teal
    ],
  },
  {
    id: 'toxic',
    name: 'Toxic',
    colors: [
      [0.0, 0.05, 0.0],     // Near black
      [0.1, 0.3, 0.0],      // Dark green
      [0.3, 0.6, 0.0],      // Slime green
      [0.6, 1.0, 0.0],      // Lime
      [0.9, 1.0, 0.2],      // Yellow-green
      [1.0, 0.9, 0.0],      // Yellow
      [0.7, 0.5, 0.0],      // Mustard
      [0.2, 0.4, 0.0],      // Olive
    ],
  },
  {
    id: 'sakura',
    name: 'Sakura',
    colors: [
      [1.0, 0.98, 0.98],    // White
      [1.0, 0.9, 0.92],     // Pale pink
      [1.0, 0.75, 0.8],     // Light pink
      [0.95, 0.55, 0.65],   // Pink
      [0.85, 0.4, 0.55],    // Rose
      [0.7, 0.3, 0.45],     // Deep rose
      [0.9, 0.7, 0.75],     // Dusty pink
      [1.0, 0.85, 0.88],    // Blush
    ],
  },
  {
    id: 'noir',
    name: 'Noir',
    colors: [
      [1.0, 1.0, 1.0],      // White
      [0.85, 0.85, 0.85],   // Light grey
      [0.65, 0.65, 0.65],   // Medium grey
      [0.45, 0.45, 0.45],   // Grey
      [0.3, 0.3, 0.3],      // Dark grey
      [0.15, 0.15, 0.15],   // Charcoal
      [0.5, 0.5, 0.5],      // Mid grey
      [0.75, 0.75, 0.75],   // Silver
    ],
  },
];

export const defaultTheme = colorThemes[0];

export function getThemeById(id: string): ColorTheme {
  return colorThemes.find(t => t.id === id) || defaultTheme;
}
