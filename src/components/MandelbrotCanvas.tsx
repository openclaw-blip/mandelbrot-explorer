import { useRef, useEffect, useCallback, useState } from 'react';
import { useMandelbrot } from '../hooks/useMandelbrot';
import { InfoOverlay } from './InfoOverlay';
import { HelpOverlay } from './HelpOverlay';
import { LoadingIndicator } from './LoadingIndicator';

export function MandelbrotCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const { viewState, isComputing, zoomAt, pan, reset, handleResize } = useMandelbrot(canvasRef, {
    maxIterations: 500,
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reset]);

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
      }
      
      if (isDragging) {
        pan(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  }, [isDragging, pan]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging && dragStartRef.current) {
      // It was a click, not a drag
      const zoomIn = !e.shiftKey;
      zoomAt(e.clientX, e.clientY, zoomIn);
    }
    
    dragStartRef.current = null;
    setIsDragging(false);
  }, [isDragging, zoomAt]);

  const handleMouseLeave = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

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
      const zoomIn = e.deltaY < 0;
      zoomAt(e.clientX, e.clientY, zoomIn);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomAt]);

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
      <InfoOverlay
        centerX={viewState.centerX}
        centerY={viewState.centerY}
        zoom={viewState.zoom}
      />
      <HelpOverlay />
      <LoadingIndicator visible={isComputing} />
    </>
  );
}
