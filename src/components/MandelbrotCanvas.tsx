import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useWebGLMandelbrot } from '../hooks/useWebGLMandelbrot';
import { InfoOverlay } from './InfoOverlay';
import { LoadingIndicator } from './LoadingIndicator';
import { SettingsMenu } from './SettingsMenu';
import { Minimap } from './Minimap';
import { ColorTheme, colorThemes, defaultTheme, getThemeById } from '../colorThemes';

// Read theme from URL hash
function getThemeFromUrl(): ColorTheme {
  const hash = window.location.hash.slice(1);
  if (!hash) return defaultTheme;
  const params = new URLSearchParams(hash);
  const themeId = params.get('t');
  return themeId ? getThemeById(themeId) : defaultTheme;
}

// Update theme in URL hash (preserving other params)
function updateThemeInUrl(themeId: string) {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  if (themeId === defaultTheme.id) {
    params.delete('t');
  } else {
    params.set('t', themeId);
  }
  const newHash = params.toString();
  window.history.replaceState(null, '', newHash ? `#${newHash}` : window.location.pathname);
}

export function MandelbrotCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<ColorTheme>(() => getThemeFromUrl());
  const [colorOffset, setColorOffset] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Apply color offset to rotate palette
  const rotatedTheme = useMemo((): ColorTheme => {
    if (colorOffset === 0) return theme;
    const len = theme.colors.length;
    const offset = ((colorOffset % len) + len) % len;
    return {
      ...theme,
      colors: [...theme.colors.slice(offset), ...theme.colors.slice(0, offset)] as ColorTheme['colors'],
    };
  }, [theme, colorOffset]);
  
  // Update URL when theme changes
  const handleThemeChange = useCallback((newTheme: ColorTheme) => {
    setTheme(newTheme);
    updateThemeInUrl(newTheme.id);
  }, []);

  // Screenshot export
  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mandelbrot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  const { viewState, isComputing, zoomAt, zoomAtInstant, pan, reset, setCenter, navigateTo, handleResize, startDrag, stopDrag } = useWebGLMandelbrot(canvasRef, {
    maxIterations: 1000,
    theme: rotatedTheme,
  });

  // Handle resize
  useEffect(() => {
    handleResize();
    
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [handleResize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        reset();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = colorThemes.findIndex(t => t.id === theme.id);
        const newIndex = e.key === 'ArrowUp' 
          ? (currentIndex - 1 + colorThemes.length) % colorThemes.length
          : (currentIndex + 1) % colorThemes.length;
        handleThemeChange(colorThemes[newIndex]);
        setColorOffset(0); // Reset offset when changing themes
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setColorOffset(prev => e.key === 'ArrowLeft' ? prev - 1 : prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reset, theme, handleThemeChange]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStartRef.current) {
      const deltaX = dragStartRef.current.x - e.clientX;
      const deltaY = dragStartRef.current.y - e.clientY;
      
      if (!isDragging && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        setIsDragging(true);
        startDrag();
      }
      
      if (isDragging) {
        pan(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  }, [isDragging, pan, startDrag]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging && dragStartRef.current) {
      // It was a click, not a drag
      const zoomIn = !e.shiftKey;
      zoomAt(e.clientX, e.clientY, zoomIn);
    }
    
    if (isDragging) {
      stopDrag();
    }
    dragStartRef.current = null;
    setIsDragging(false);
  }, [isDragging, zoomAt, stopDrag]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      stopDrag();
    }
    dragStartRef.current = null;
    setIsDragging(false);
  }, [isDragging, stopDrag]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, false);
  }, [zoomAt]);

  // Wheel zoom - use native listener with passive: false to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Use instant zoom with continuous factor based on scroll amount
      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAtInstant(e.clientX, e.clientY, zoomFactor);
    };

    // Touch handling
    let touchStartDist = 0;
    let touchStartZoom = 1;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isTouchDragging = false;
    let lastTapTime = 0;

    const getTouchDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        isTouchDragging = false;
        
        // Double tap detection
        const now = Date.now();
        if (now - lastTapTime < 300) {
          e.preventDefault();
          zoomAt(touch.clientX, touch.clientY, true);
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
      } else if (e.touches.length === 2) {
        e.preventDefault();
        touchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
        touchStartZoom = viewState.zoom;
        startDrag();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && !touchStartDist) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;
        
        if (!isTouchDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          isTouchDragging = true;
          startDrag();
        }
        
        if (isTouchDragging) {
          e.preventDefault();
          pan(dx, dy);
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
        }
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        const scale = dist / touchStartDist;
        const newZoom = touchStartZoom * scale;
        const zoomFactor = newZoom / viewState.zoom;
        zoomAtInstant(center.x, center.y, zoomFactor);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (isTouchDragging) {
          stopDrag();
        }
        isTouchDragging = false;
        touchStartDist = 0;
      } else if (e.touches.length === 1) {
        // Went from 2 fingers to 1
        touchStartDist = 0;
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        stopDrag();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoomAtInstant, zoomAt, pan, startDrag, stopDrag, viewState.zoom]);

  return (
    <>
      <div
        ref={containerRef}
        className={`canvas-container ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      >
        <canvas ref={canvasRef} className="mandelbrot-canvas" />
      </div>
      <Minimap
        centerX={viewState.centerX}
        centerY={viewState.centerY}
        zoom={viewState.zoom}
        theme={rotatedTheme}
        onNavigate={setCenter}
      />
      <InfoOverlay
        centerX={viewState.centerX}
        centerY={viewState.centerY}
        zoom={viewState.zoom}
      />
      <SettingsMenu 
        themes={colorThemes}
        currentTheme={theme}
        onThemeChange={handleThemeChange}
        onScreenshot={handleScreenshot}
        onReset={reset}
        onFullscreen={toggleFullscreen}
        onNavigateTo={navigateTo}
      />
      <LoadingIndicator visible={isComputing} />
    </>
  );
}
