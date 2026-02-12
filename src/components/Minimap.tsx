import { useRef, useEffect, useMemo } from 'react';
import { ColorTheme } from '../colorThemes';
import { FractalSet } from '../hooks/useWebGLMandelbrot';

interface MinimapProps {
  centerX: number;
  centerY: number;
  zoom: number;
  theme: ColorTheme;
  fractalSet: FractalSet;
  onNavigate: (x: number, y: number) => void;
}

const MINIMAP_WIDTH = 120;
const MINIMAP_HEIGHT = 80;
const MIN_VIEWPORT_PERCENT = 15; // Minimum viewport size as % of minimap

// Complex power for Multibrot
function cpow(zr: number, zi: number, n: number): [number, number] {
  const r = Math.sqrt(zr * zr + zi * zi);
  if (r === 0) return [0, 0];
  const theta = Math.atan2(zi, zr);
  const rn = Math.pow(r, n);
  return [rn * Math.cos(n * theta), rn * Math.sin(n * theta)];
}

// Simple CPU renderer for minimap
function renderMinimap(
  canvas: HTMLCanvasElement,
  theme: ColorTheme,
  centerX: number,
  centerY: number,
  minimapZoom: number,
  fractalSet: FractalSet
) {
  // More iterations needed at higher zoom to see detail
  const maxIterations = Math.min(150 + Math.floor(Math.log10(minimapZoom + 1) * 50), 500);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const aspectRatio = width / height;
  const viewWidth = 4 / minimapZoom;
  const viewHeight = viewWidth / aspectRatio;
  const minX = centerX - viewWidth / 2;
  const minY = centerY - viewHeight / 2;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const pixelX = minX + (px / width) * viewWidth;
      const pixelY = minY + ((height - py - 1) / height) * viewHeight;

      let x: number, y: number, cx: number, cy: number;
      
      // Set up initial values based on fractal type
      if (fractalSet.type === 'julia') {
        x = pixelX;
        y = pixelY;
        cx = fractalSet.cr;
        cy = fractalSet.ci;
      } else {
        x = 0;
        y = 0;
        cx = pixelX;
        cy = pixelY;
      }

      let iteration = 0;

      while (x * x + y * y <= 4 && iteration < maxIterations) {
        let xTemp: number, yTemp: number;
        
        if (fractalSet.type === 'mandelbrot' || fractalSet.type === 'julia') {
          // z² + c
          xTemp = x * x - y * y + cx;
          yTemp = 2 * x * y + cy;
        } else if (fractalSet.type === 'burning-ship') {
          // (|Re(z)| + i|Im(z)|)² + c
          const ax = Math.abs(x);
          const ay = Math.abs(y);
          xTemp = ax * ax - ay * ay + cx;
          yTemp = 2 * ax * ay + cy;
        } else if (fractalSet.type === 'tricorn') {
          // conj(z)² + c
          const zr = x;
          const zi = -y; // conjugate
          xTemp = zr * zr - zi * zi + cx;
          yTemp = 2 * zr * zi + cy;
        } else if (fractalSet.type === 'multibrot') {
          // z^power + c
          const [pr, pi] = cpow(x, y, fractalSet.power);
          xTemp = pr + cx;
          yTemp = pi + cy;
        } else {
          xTemp = x * x - y * y + cx;
          yTemp = 2 * x * y + cy;
        }
        
        x = xTemp;
        y = yTemp;
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

export function Minimap({ centerX, centerY, zoom, theme, fractalSet, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate adaptive minimap zoom - zoom in enough to keep viewport rectangle visible
  const minimapState = useMemo(() => {
    const minimapAspect = MINIMAP_WIDTH / MINIMAP_HEIGHT;
    
    // Start with a base zoom that shows the full set
    const baseZoom = 0.8;
    
    // Calculate what the viewport size would be at base zoom
    const baseViewWidth = 4 / baseZoom;
    const currentViewWidth = 4 / zoom;
    const viewportPercent = (currentViewWidth / baseViewWidth) * 100;
    
    // Default center depends on fractal type
    let defaultCenterX = 0;
    let defaultCenterY = 0;
    if (fractalSet.type === 'mandelbrot') {
      defaultCenterX = -0.5;
    } else if (fractalSet.type === 'burning-ship') {
      defaultCenterX = -0.4;
      defaultCenterY = -0.5;
    }
    
    // If viewport would be too small, zoom in the minimap
    let minimapZoom = baseZoom;
    let minimapCenterX = defaultCenterX;
    let minimapCenterY = defaultCenterY;
    
    if (viewportPercent < MIN_VIEWPORT_PERCENT) {
      // Zoom minimap so viewport is MIN_VIEWPORT_PERCENT of minimap
      minimapZoom = zoom * (MIN_VIEWPORT_PERCENT / 100);
      minimapCenterX = centerX;
      minimapCenterY = centerY;
    }
    
    // Calculate viewport rectangle
    const minimapViewWidth = 4 / minimapZoom;
    const minimapViewHeight = minimapViewWidth / minimapAspect;
    const currentViewHeight = currentViewWidth / minimapAspect;
    
    const rectWidth = (currentViewWidth / minimapViewWidth) * 100;
    const rectHeight = (currentViewHeight / minimapViewHeight) * 100;
    
    const offsetX = centerX - minimapCenterX;
    const offsetY = centerY - minimapCenterY;
    
    const rectX = 50 + (offsetX / minimapViewWidth) * 100;
    const rectY = 50 - (offsetY / minimapViewHeight) * 100;
    
    return {
      minimapZoom,
      minimapCenterX,
      minimapCenterY,
      viewport: {
        left: `${rectX - rectWidth / 2}%`,
        top: `${rectY - rectHeight / 2}%`,
        width: `${Math.max(rectWidth, 3)}%`,
        height: `${Math.max(rectHeight, 3)}%`,
        visible: rectWidth < 95 && rectHeight < 95,
      }
    };
  }, [centerX, centerY, zoom, fractalSet]);

  // Render minimap when theme, fractal set, or minimap view changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { minimapCenterX, minimapCenterY, minimapZoom } = minimapState;
    
    canvas.width = MINIMAP_WIDTH * 2;
    canvas.height = MINIMAP_HEIGHT * 2;
    renderMinimap(canvas, theme, minimapCenterX, minimapCenterY, minimapZoom, fractalSet);
  }, [theme, minimapState, fractalSet]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;  // 0-1
    const clickY = (e.clientY - rect.top) / rect.height;  // 0-1
    
    // Convert to complex plane coordinates
    const { minimapCenterX, minimapCenterY, minimapZoom } = minimapState;
    const minimapAspect = MINIMAP_WIDTH / MINIMAP_HEIGHT;
    const minimapViewWidth = 4 / minimapZoom;
    const minimapViewHeight = minimapViewWidth / minimapAspect;
    
    const newCenterX = minimapCenterX + (clickX - 0.5) * minimapViewWidth;
    const newCenterY = minimapCenterY - (clickY - 0.5) * minimapViewHeight; // Flip Y
    
    onNavigate(newCenterX, newCenterY);
  };

  return (
    <div 
      className="minimap" 
      ref={containerRef}
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <canvas 
        ref={canvasRef} 
        className="minimap-canvas"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      />
      {minimapState.viewport.visible && (
        <div 
          className="minimap-viewport"
          style={{
            left: minimapState.viewport.left,
            top: minimapState.viewport.top,
            width: minimapState.viewport.width,
            height: minimapState.viewport.height,
          }}
        />
      )}
    </div>
  );
}
