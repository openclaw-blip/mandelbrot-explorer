// Cyberpunk color palette
const COLORS = [
  { r: 255, g: 0, b: 255 },    // Hot pink #ff00ff
  { r: 0, g: 255, b: 255 },    // Cyan #00ffff
  { r: 157, g: 0, b: 255 },    // Purple #9d00ff
  { r: 0, g: 102, b: 255 },    // Electric blue #0066ff
  { r: 255, g: 0, b: 128 },    // Hot pink variant
  { r: 0, g: 200, b: 255 },    // Light cyan
  { r: 200, g: 0, b: 255 },    // Light purple
  { r: 0, g: 150, b: 255 },    // Sky blue
];

export function getColor(iteration: number, maxIterations: number): [number, number, number] {
  if (iteration === maxIterations) {
    return [0, 0, 0]; // Black for points in the set
  }

  // Smooth coloring using escape time algorithm with continuous potential
  // Guard against log2 edge cases when iteration is very low
  const logVal = Math.max(1, iteration + 1);
  const innerLog = Math.log2(logVal);
  const smoothed = iteration + 1 - (innerLog > 0 ? Math.log2(innerLog) : 0);
  
  // Create smooth gradient through color palette
  const colorScale = Math.abs((smoothed / maxIterations) * (COLORS.length - 1) * 4);
  const colorIndex = Math.floor(colorScale) % COLORS.length;
  const nextColorIndex = (colorIndex + 1) % COLORS.length;
  const t = colorScale - Math.floor(colorScale);
  
  // Smooth interpolation between colors
  const c1 = COLORS[colorIndex];
  const c2 = COLORS[nextColorIndex];
  
  // Safety check in case of edge cases
  if (!c1 || !c2) {
    return [255, 0, 255]; // Fallback to hot pink
  }
  
  // Use cosine interpolation for smoother gradients
  const factor = (1 - Math.cos(t * Math.PI)) / 2;
  
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  
  return [r, g, b];
}

export function createColorLookup(maxIterations: number): Uint8Array {
  const lookup = new Uint8Array((maxIterations + 1) * 3);
  
  for (let i = 0; i <= maxIterations; i++) {
    const [r, g, b] = getColor(i, maxIterations);
    lookup[i * 3] = r;
    lookup[i * 3 + 1] = g;
    lookup[i * 3 + 2] = b;
  }
  
  return lookup;
}
