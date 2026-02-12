import { useRef, useEffect, useCallback, useState } from 'react';
import { FractalSet } from '../hooks/useWebGLMandelbrot';

interface OrbitOverlayProps {
  centerX: number;
  centerY: number;
  zoom: number;
  fractalSet: FractalSet;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// Complex power for Multibrot
function cpow(zr: number, zi: number, n: number): [number, number] {
  const r = Math.sqrt(zr * zr + zi * zi);
  if (r === 0) return [0, 0];
  const theta = Math.atan2(zi, zr);
  const rn = Math.pow(r, n);
  return [rn * Math.cos(n * theta), rn * Math.sin(n * theta)];
}

function computeOrbit(
  cx: number,
  cy: number,
  fractalSet: FractalSet,
  maxIterations: number = 100
): { zr: number; zi: number; escaped: boolean; iteration: number }[] {
  const orbit: { zr: number; zi: number; escaped: boolean; iteration: number }[] = [];
  
  let zr: number, zi: number, cr: number, ci: number;
  
  // Set up initial values based on fractal type
  if (fractalSet.type === 'julia') {
    zr = cx;
    zi = cy;
    cr = fractalSet.cr;
    ci = fractalSet.ci;
  } else {
    zr = 0;
    zi = 0;
    cr = cx;
    ci = cy;
  }
  
  // Add starting point
  orbit.push({ zr, zi, escaped: false, iteration: 0 });
  
  for (let i = 0; i < maxIterations; i++) {
    const mag2 = zr * zr + zi * zi;
    const escaped = mag2 > 4;
    
    if (escaped) {
      orbit[orbit.length - 1].escaped = true;
      break;
    }
    
    let newZr: number, newZi: number;
    
    if (fractalSet.type === 'mandelbrot' || fractalSet.type === 'julia') {
      newZr = zr * zr - zi * zi + cr;
      newZi = 2 * zr * zi + ci;
    } else if (fractalSet.type === 'burning-ship') {
      const ax = Math.abs(zr);
      const ay = Math.abs(zi);
      newZr = ax * ax - ay * ay + cr;
      newZi = 2 * ax * ay + ci;
    } else if (fractalSet.type === 'tricorn') {
      const conjZi = -zi;
      newZr = zr * zr - conjZi * conjZi + cr;
      newZi = 2 * zr * conjZi + ci;
    } else if (fractalSet.type === 'multibrot') {
      const [pr, pi] = cpow(zr, zi, fractalSet.power);
      newZr = pr + cr;
      newZi = pi + ci;
    } else {
      newZr = zr * zr - zi * zi + cr;
      newZi = 2 * zr * zi + ci;
    }
    
    zr = newZr;
    zi = newZi;
    
    orbit.push({ zr, zi, escaped: false, iteration: i + 1 });
    
    // Stop if we've clearly escaped
    if (zr * zr + zi * zi > 1000) {
      orbit[orbit.length - 1].escaped = true;
      break;
    }
  }
  
  return orbit;
}

export function OrbitOverlay({ centerX, centerY, zoom, fractalSet, containerRef }: OrbitOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const animationRef = useRef<number | null>(null);
  const orbitIndexRef = useRef(0);
  const orbitRef = useRef<{ zr: number; zi: number; escaped: boolean; iteration: number }[]>([]);
  
  // Convert complex coordinate to screen position
  const complexToScreen = useCallback((zr: number, zi: number): { x: number; y: number } | null => {
    const container = containerRef.current;
    if (!container) return null;
    
    const rect = container.getBoundingClientRect();
    const aspectRatio = rect.width / rect.height;
    const viewWidth = 4 / zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    const x = ((zr - centerX) / viewWidth + 0.5) * rect.width;
    const y = (0.5 - (zi - centerY) / viewHeight) * rect.height;
    
    return { x, y };
  }, [centerX, centerY, zoom, containerRef]);
  
  // Convert screen position to complex coordinate
  const screenToComplex = useCallback((screenX: number, screenY: number): { cr: number; ci: number } => {
    const container = containerRef.current;
    if (!container) return { cr: 0, ci: 0 };
    
    const rect = container.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    
    const aspectRatio = rect.width / rect.height;
    const viewWidth = 4 / zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    const cr = centerX + (x / rect.width - 0.5) * viewWidth;
    const ci = centerY + (0.5 - y / rect.height) * viewHeight;
    
    return { cr, ci };
  }, [centerX, centerY, zoom, containerRef]);
  
  // Handle mouse move
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseLeave = () => {
      setMousePos(null);
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef]);
  
  // Compute and animate orbit
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Update canvas size
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
    
    if (!mousePos) {
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    // Compute orbit for current mouse position
    const { cr, ci } = screenToComplex(mousePos.x, mousePos.y);
    const orbit = computeOrbit(cr, ci, fractalSet, 150);
    orbitRef.current = orbit;
    orbitIndexRef.current = 0;
    
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      const orbit = orbitRef.current;
      const maxIndex = Math.min(orbitIndexRef.current + 1, orbit.length);
      
      if (maxIndex < 2) {
        orbitIndexRef.current++;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      // Draw orbit path
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      
      let firstPoint = true;
      for (let i = 0; i < maxIndex; i++) {
        const point = orbit[i];
        const screenPos = complexToScreen(point.zr, point.zi);
        if (!screenPos) continue;
        
        // Skip points that are way off screen
        if (screenPos.x < -500 || screenPos.x > rect.width + 500 ||
            screenPos.y < -500 || screenPos.y > rect.height + 500) {
          firstPoint = true;
          continue;
        }
        
        if (firstPoint) {
          ctx.moveTo(screenPos.x, screenPos.y);
          firstPoint = false;
        } else {
          ctx.lineTo(screenPos.x, screenPos.y);
        }
      }
      ctx.stroke();
      
      // Draw orbit points
      for (let i = 0; i < maxIndex; i++) {
        const point = orbit[i];
        const screenPos = complexToScreen(point.zr, point.zi);
        if (!screenPos) continue;
        
        if (screenPos.x < -50 || screenPos.x > rect.width + 50 ||
            screenPos.y < -50 || screenPos.y > rect.height + 50) {
          continue;
        }
        
        const alpha = 0.3 + (i / maxIndex) * 0.7;
        const size = i === maxIndex - 1 ? 6 : 4;
        
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        
        if (i === 0) {
          // Starting point - cyan
          ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
        } else if (point.escaped) {
          // Escaped - red/orange
          ctx.fillStyle = `rgba(255, 100, 50, ${alpha})`;
        } else {
          // In set - white/blue
          ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
        }
        ctx.fill();
        
        // Highlight the latest point
        if (i === maxIndex - 1) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      
      // Draw c point (the mouse position / starting c value)
      const cScreen = complexToScreen(cr, ci);
      if (cScreen && cScreen.x >= 0 && cScreen.x <= rect.width && cScreen.y >= 0 && cScreen.y <= rect.height) {
        ctx.beginPath();
        ctx.arc(cScreen.x, cScreen.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Cross in center
        ctx.beginPath();
        ctx.moveTo(cScreen.x - 4, cScreen.y);
        ctx.lineTo(cScreen.x + 4, cScreen.y);
        ctx.moveTo(cScreen.x, cScreen.y - 4);
        ctx.lineTo(cScreen.x, cScreen.y + 4);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      
      // Continue animation if not complete
      if (orbitIndexRef.current < orbit.length - 1) {
        orbitIndexRef.current += 2; // Speed up animation
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mousePos, centerX, centerY, zoom, fractalSet, complexToScreen, screenToComplex, containerRef]);
  
  return (
    <canvas
      ref={canvasRef}
      className="orbit-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
}
