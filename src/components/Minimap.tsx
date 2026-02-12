import { useRef, useEffect, useMemo } from 'react';
import { ColorTheme } from '../colorThemes';

interface MinimapProps {
  centerX: number;
  centerY: number;
  zoom: number;
  theme: ColorTheme;
}

// The minimap shows this fixed view of the Mandelbrot set
const MINIMAP_CENTER_X = -0.5;
const MINIMAP_CENTER_Y = 0;
const MINIMAP_ZOOM = 0.8;
const MINIMAP_WIDTH = 120;
const MINIMAP_HEIGHT = 80;

// Simple CPU renderer for minimap (doesn't need to be fast, renders once per theme change)
function renderMinimap(
  canvas: HTMLCanvasElement,
  theme: ColorTheme,
  maxIterations: number = 100
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const aspectRatio = width / height;
  const viewWidth = 4 / MINIMAP_ZOOM;
  const viewHeight = viewWidth / aspectRatio;
  const minX = MINIMAP_CENTER_X - viewWidth / 2;
  const minY = MINIMAP_CENTER_Y - viewHeight / 2;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const x0 = minX + (px / width) * viewWidth;
      const y0 = minY + ((height - py - 1) / height) * viewHeight;

      let x = 0, y = 0;
      let iteration = 0;

      while (x * x + y * y <= 4 && iteration < maxIterations) {
        const xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iteration++;
      }

      const idx = (py * width + px) * 4;

      if (iteration === maxIterations) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      } else {
        // Color from theme
        const t = iteration / maxIterations;
        const scaledT = t * 4;
        const colorIdx = Math.floor(scaledT) % 8;
        const nextIdx = (colorIdx + 1) % 8;
        const factor = scaledT - Math.floor(scaledT);

        const c1 = theme.colors[colorIdx];
        const c2 = theme.colors[nextIdx];

        const r = Math.round((c1[0] + (c2[0] - c1[0]) * factor) * 255);
        const g = Math.round((c1[1] + (c2[1] - c1[1]) * factor) * 255);
        const b = Math.round((c1[2] + (c2[2] - c1[2]) * factor) * 255);

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function Minimap({ centerX, centerY, zoom, theme }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render minimap when theme changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = MINIMAP_WIDTH * 2; // 2x for retina
    canvas.height = MINIMAP_HEIGHT * 2;
    renderMinimap(canvas, theme);
  }, [theme]);

  // Calculate viewport rectangle position and size
  const viewportRect = useMemo(() => {
    const minimapAspect = MINIMAP_WIDTH / MINIMAP_HEIGHT;
    const minimapViewWidth = 4 / MINIMAP_ZOOM;
    const minimapViewHeight = minimapViewWidth / minimapAspect;
    
    // Current view dimensions in complex plane
    const currentViewWidth = 4 / zoom;
    const currentViewHeight = currentViewWidth / minimapAspect;
    
    // Rectangle dimensions as percentage of minimap
    const rectWidth = (currentViewWidth / minimapViewWidth) * 100;
    const rectHeight = (currentViewHeight / minimapViewHeight) * 100;
    
    // Rectangle position (center of view relative to minimap)
    const offsetX = centerX - MINIMAP_CENTER_X;
    const offsetY = centerY - MINIMAP_CENTER_Y;
    
    const rectX = 50 + (offsetX / minimapViewWidth) * 100;
    const rectY = 50 - (offsetY / minimapViewHeight) * 100; // Flip Y
    
    return {
      left: `${rectX - rectWidth / 2}%`,
      top: `${rectY - rectHeight / 2}%`,
      width: `${Math.max(rectWidth, 2)}%`,
      height: `${Math.max(rectHeight, 2)}%`,
      visible: rectWidth < 100 && rectHeight < 100,
    };
  }, [centerX, centerY, zoom]);

  return (
    <div className="minimap">
      <canvas 
        ref={canvasRef} 
        className="minimap-canvas"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      />
      {viewportRect.visible && (
        <div 
          className="minimap-viewport"
          style={{
            left: viewportRect.left,
            top: viewportRect.top,
            width: viewportRect.width,
            height: viewportRect.height,
          }}
        />
      )}
    </div>
  );
}
