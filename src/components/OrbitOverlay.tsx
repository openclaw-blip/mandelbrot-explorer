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
    
    if (zr * zr + zi * zi > 100) {
      orbit[orbit.length - 1].escaped = true;
      break;
    }
  }
  
  return orbit;
}

const INSET_SIZE = 160;
const INSET_PADDING = 12;

export function OrbitOverlay({ centerX, centerY, zoom, fractalSet, containerRef }: OrbitOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const animationRef = useRef<number | null>(null);
  const orbitIndexRef = useRef(0);
  const orbitRef = useRef<{ zr: number; zi: number; escaped: boolean; iteration: number }[]>([]);
  
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
  
  // Compute and animate orbit in inset window
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = INSET_SIZE * dpr;
    canvas.height = INSET_SIZE * dpr;
    ctx.scale(dpr, dpr);
    
    if (!mousePos) {
      ctx.clearRect(0, 0, INSET_SIZE, INSET_SIZE);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    // Compute orbit for current mouse position
    const { cr, ci } = screenToComplex(mousePos.x, mousePos.y);
    const orbit = computeOrbit(cr, ci, fractalSet, 100);
    orbitRef.current = orbit;
    orbitIndexRef.current = 0;
    
    // Calculate bounds to fit orbit in view
    const getBounds = () => {
      let minR = -2.5, maxR = 1.5, minI = -2, maxI = 2;
      
      // Include c point
      minR = Math.min(minR, cr - 0.5);
      maxR = Math.max(maxR, cr + 0.5);
      minI = Math.min(minI, ci - 0.5);
      maxI = Math.max(maxI, ci + 0.5);
      
      // Include orbit points (clamped)
      for (const p of orbit) {
        if (Math.abs(p.zr) < 10 && Math.abs(p.zi) < 10) {
          minR = Math.min(minR, p.zr - 0.2);
          maxR = Math.max(maxR, p.zr + 0.2);
          minI = Math.min(minI, p.zi - 0.2);
          maxI = Math.max(maxI, p.zi + 0.2);
        }
      }
      
      // Make square
      const rangeR = maxR - minR;
      const rangeI = maxI - minI;
      const range = Math.max(rangeR, rangeI);
      const centerR = (minR + maxR) / 2;
      const centerI = (minI + maxI) / 2;
      
      return {
        minR: centerR - range / 2,
        maxR: centerR + range / 2,
        minI: centerI - range / 2,
        maxI: centerI + range / 2,
      };
    };
    
    const bounds = getBounds();
    
    // Convert complex to inset screen coords
    const toScreen = (zr: number, zi: number) => {
      const x = ((zr - bounds.minR) / (bounds.maxR - bounds.minR)) * INSET_SIZE;
      const y = ((bounds.maxI - zi) / (bounds.maxI - bounds.minI)) * INSET_SIZE;
      return { x, y };
    };
    
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, INSET_SIZE, INSET_SIZE);
      
      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, INSET_SIZE, INSET_SIZE);
      
      // Draw escape circle (|z| = 2)
      const center = toScreen(0, 0);
      const edge = toScreen(2, 0);
      const radius = edge.x - center.x;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw axes
      const origin = toScreen(0, 0);
      ctx.beginPath();
      ctx.moveTo(0, origin.y);
      ctx.lineTo(INSET_SIZE, origin.y);
      ctx.moveTo(origin.x, 0);
      ctx.lineTo(origin.x, INSET_SIZE);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      const orbit = orbitRef.current;
      const maxIndex = Math.min(orbitIndexRef.current + 1, orbit.length);
      
      // Draw orbit path
      if (maxIndex >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.7)';
        ctx.lineWidth = 1.5;
        
        const first = toScreen(orbit[0].zr, orbit[0].zi);
        ctx.moveTo(first.x, first.y);
        
        for (let i = 1; i < maxIndex; i++) {
          const point = orbit[i];
          const pos = toScreen(point.zr, point.zi);
          ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
      }
      
      // Draw orbit points
      for (let i = 0; i < maxIndex; i++) {
        const point = orbit[i];
        const pos = toScreen(point.zr, point.zi);
        
        const alpha = 0.4 + (i / Math.max(maxIndex, 1)) * 0.6;
        const size = i === maxIndex - 1 ? 5 : 3;
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        
        if (i === 0) {
          ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
        } else if (point.escaped) {
          ctx.fillStyle = `rgba(255, 100, 50, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
        }
        ctx.fill();
        
        if (i === maxIndex - 1) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      
      // Draw c point (yellow)
      const cPos = toScreen(cr, ci);
      ctx.beginPath();
      ctx.arc(cPos.x, cPos.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 220, 0, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`c = ${cr.toFixed(3)} + ${ci.toFixed(3)}i`, 6, 14);
      ctx.fillText(`iter: ${maxIndex - 1}`, 6, 26);
      
      // Continue animation
      if (orbitIndexRef.current < orbit.length - 1) {
        orbitIndexRef.current += 1;
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mousePos, centerX, centerY, zoom, fractalSet, screenToComplex, containerRef]);
  
  if (!mousePos) return null;
  
  return (
    <canvas
      ref={canvasRef}
      className="orbit-inset"
      style={{
        position: 'absolute',
        bottom: INSET_PADDING,
        right: INSET_PADDING,
        width: INSET_SIZE,
        height: INSET_SIZE,
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        pointerEvents: 'none',
        zIndex: 150,
      }}
    />
  );
}
