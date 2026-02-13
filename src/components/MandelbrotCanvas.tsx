import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useWebGLMandelbrot, FractalSet } from '../hooks/useWebGLMandelbrot';
import { InfoOverlay } from './InfoOverlay';
import { LoadingIndicator } from './LoadingIndicator';
import { SettingsMenu } from './SettingsMenu';
import { Minimap } from './Minimap';
import { OrbitOverlay } from './OrbitOverlay';
import { VideoExportModal, VideoExportConfig } from './VideoExportModal';
import { VideoRecorder } from './VideoRecorder';
import { ColorTheme, colorThemes, defaultTheme, getThemeById } from '../colorThemes';
import { juliaPresets, multibrotPresets, fractalSetFromUrlParams, fractalSetToUrlParams } from '../juliaSets';

// Read theme from URL hash
function getThemeFromUrl(): ColorTheme {
  const hash = window.location.hash.slice(1);
  if (!hash) return defaultTheme;
  const params = new URLSearchParams(hash);
  const themeId = params.get('t');
  return themeId ? getThemeById(themeId) : defaultTheme;
}

// Read scale from URL hash (defaults to linear)
function getScaleFromUrl(): 'log' | 'linear' {
  const hash = window.location.hash.slice(1);
  if (!hash) return 'linear';
  const params = new URLSearchParams(hash);
  const scale = params.get('scale');
  return scale === 'log' ? 'log' : 'linear';
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

// Update scale in URL hash (preserving other params)
function updateScaleInUrl(scale: 'log' | 'linear') {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  if (scale === 'linear') {
    params.delete('scale');
  } else {
    params.set('scale', 'log');
  }
  const newHash = params.toString();
  window.history.replaceState(null, '', newHash ? `#${newHash}` : window.location.pathname);
}

// Read orbit toggle from URL hash (defaults to off)
function getOrbitFromUrl(): boolean {
  const hash = window.location.hash.slice(1);
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  return params.get('orbit') === '1';
}

// Update orbit in URL hash
function updateOrbitInUrl(show: boolean) {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  if (show) {
    params.set('orbit', '1');
  } else {
    params.delete('orbit');
  }
  const newHash = params.toString();
  window.history.replaceState(null, '', newHash ? `#${newHash}` : window.location.pathname);
}

// Read fractal set from URL hash
function getFractalSetFromUrl(): FractalSet {
  const hash = window.location.hash.slice(1);
  if (!hash) return { type: 'mandelbrot' };
  const params = new URLSearchParams(hash);
  return fractalSetFromUrlParams(params);
}

// Update fractal set in URL hash (preserving other params)
function updateFractalSetInUrl(set: FractalSet) {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  // Clear old set params
  params.delete('set');
  params.delete('j');
  params.delete('jr');
  params.delete('ji');
  // Add new params
  const newParams = fractalSetToUrlParams(set);
  for (const [key, value] of Object.entries(newParams)) {
    params.set(key, value);
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
  const [colorScale, setColorScale] = useState<'log' | 'linear'>(() => getScaleFromUrl());
  const [fractalSet, setFractalSet] = useState<FractalSet>(() => getFractalSetFromUrl());
  const [showOrbit, setShowOrbit] = useState(() => getOrbitFromUrl());
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoConfig, setVideoConfig] = useState<VideoExportConfig | null>(null);
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

  // Update URL when scale changes
  const handleScaleChange = useCallback((newScale: 'log' | 'linear') => {
    setColorScale(newScale);
    updateScaleInUrl(newScale);
  }, []);

  // Update URL when orbit toggle changes
  const handleOrbitToggle = useCallback((show: boolean) => {
    setShowOrbit(show);
    updateOrbitInUrl(show);
  }, []);

  // Video export handlers
  const handleOpenVideoExport = useCallback(() => {
    setShowVideoModal(true);
  }, []);

  const handleStartVideoExport = useCallback((config: VideoExportConfig) => {
    setShowVideoModal(false);
    setVideoConfig(config);
  }, []);

  const handleVideoComplete = useCallback(() => {
    setVideoConfig(null);
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

  const { viewState, isComputing, zoomAt, zoomAtInstant, pan, reset, setCenter, navigateTo, handleResize, startDrag, stopDrag, renderAt } = useWebGLMandelbrot(canvasRef, {
    maxIterations: 1000,
    theme: rotatedTheme,
    colorScale,
    fractalSet,
  });

  // Update URL when fractal set changes and reset view
  const handleFractalSetChange = useCallback((newSet: FractalSet) => {
    setFractalSet(newSet);
    updateFractalSetInUrl(newSet);
    // Reset view to show entire set with appropriate center
    // Mandelbrot: (-0.5, 0), Burning Ship: (-0.4, -0.5), others: (0, 0)
    let centerX = 0, centerY = 0;
    if (newSet.type === 'mandelbrot') {
      centerX = -0.5;
    } else if (newSet.type === 'burning-ship') {
      centerX = -0.4;
      centerY = -0.5;
    }
    navigateTo(centerX, centerY, 1);
  }, [navigateTo]);

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
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        // Calculate zoom factor relative to previous distance, not start
        const zoomFactor = dist / touchStartDist;
        touchStartDist = dist; // Update for next move event
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
  }, [zoomAtInstant, zoomAt, pan, startDrag, stopDrag]);

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
        {showOrbit && (
          <OrbitOverlay
            centerX={viewState.centerX}
            centerY={viewState.centerY}
            zoom={viewState.zoom}
            fractalSet={fractalSet}
            containerRef={containerRef}
          />
        )}
      </div>
      <Minimap
        centerX={viewState.centerX}
        centerY={viewState.centerY}
        zoom={viewState.zoom}
        theme={rotatedTheme}
        fractalSet={fractalSet}
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
        colorScale={colorScale}
        onScaleChange={handleScaleChange}
        showOrbit={showOrbit}
        onOrbitToggle={handleOrbitToggle}
        fractalSet={fractalSet}
        onFractalSetChange={handleFractalSetChange}
        juliaPresets={juliaPresets}
        multibrotPresets={multibrotPresets}
        onScreenshot={handleScreenshot}
        onVideoExport={handleOpenVideoExport}
        onReset={reset}
        onFullscreen={toggleFullscreen}
        onNavigateTo={navigateTo}
      />
      <LoadingIndicator visible={isComputing} />
      
      {showVideoModal && (
        <VideoExportModal
          currentX={viewState.centerX}
          currentY={viewState.centerY}
          currentZoom={viewState.zoom}
          onClose={() => setShowVideoModal(false)}
          onExport={handleStartVideoExport}
        />
      )}
      
      {videoConfig && (
        <VideoRecorder
          config={videoConfig}
          canvasRef={canvasRef}
          onRenderFrame={renderAt}
          onComplete={handleVideoComplete}
          onCancel={handleVideoComplete}
        />
      )}
    </>
  );
}
