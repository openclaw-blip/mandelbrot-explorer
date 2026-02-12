import { useCallback, useEffect, useRef, useState } from 'react';
import { createColorLookup } from '../utils/colors';

interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
}

interface UseMandelbrotOptions {
  maxIterations?: number;
  workerCount?: number;
}

export function useMandelbrot(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseMandelbrotOptions = {}
) {
  const { maxIterations = 500, workerCount = navigator.hardwareConcurrency || 4 } = options;

  const [viewState, setViewState] = useState<ViewState>({
    centerX: -0.5,
    centerY: 0,
    zoom: 1,
  });

  const [isComputing, setIsComputing] = useState(false);
  
  const workersRef = useRef<Worker[]>([]);
  const taskIdRef = useRef(0);
  const pendingTasksRef = useRef<Map<number, { 
    received: number; 
    total: number; 
    imageData: ImageData;
    colorLookup: Uint8Array;
  }>>(new Map());
  const animationFrameRef = useRef<number>();
  const targetViewRef = useRef<ViewState | null>(null);
  const currentViewRef = useRef<ViewState>(viewState);

  // Initialize workers
  useEffect(() => {
    const workers: Worker[] = [];
    
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(
        new URL('../workers/mandelbrot.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      worker.onmessage = (e) => {
        const { type, iterations, startRow, endRow, taskId } = e.data;
        
        if (type !== 'result') return;
        
        const task = pendingTasksRef.current.get(taskId);
        if (!task) return;
        
        const { imageData, colorLookup } = task;
        const width = imageData.width;
        const data = imageData.data;
        
        // Apply colors to image data
        for (let row = startRow; row < endRow; row++) {
          for (let col = 0; col < width; col++) {
            const srcIdx = (row - startRow) * width + col;
            const dstIdx = (row * width + col) * 4;
            const iter = iterations[srcIdx];
            
            data[dstIdx] = colorLookup[iter * 3];
            data[dstIdx + 1] = colorLookup[iter * 3 + 1];
            data[dstIdx + 2] = colorLookup[iter * 3 + 2];
            data[dstIdx + 3] = 255;
          }
        }
        
        task.received++;
        
        // All chunks complete
        if (task.received === task.total) {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.putImageData(imageData, 0, 0);
            }
          }
          pendingTasksRef.current.delete(taskId);
          
          // Only set computing to false if this was the latest task
          if (taskId === taskIdRef.current - 1) {
            setIsComputing(false);
          }
        }
      };
      
      workers.push(worker);
    }
    
    workersRef.current = workers;
    
    return () => {
      workers.forEach(w => w.terminate());
    };
  }, [workerCount, canvasRef]);

  // Render function
  const render = useCallback((view: ViewState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    if (width === 0 || height === 0) return;
    
    setIsComputing(true);
    
    const taskId = taskIdRef.current++;
    const imageData = ctx.createImageData(width, height);
    const colorLookup = createColorLookup(maxIterations);
    
    const workers = workersRef.current;
    const chunksPerWorker = Math.ceil(height / workers.length);
    
    pendingTasksRef.current.set(taskId, {
      received: 0,
      total: workers.length,
      imageData,
      colorLookup
    });
    
    workers.forEach((worker, i) => {
      const startRow = i * chunksPerWorker;
      const endRow = Math.min((i + 1) * chunksPerWorker, height);
      
      if (startRow < height) {
        worker.postMessage({
          type: 'compute',
          width,
          height,
          centerX: view.centerX,
          centerY: view.centerY,
          zoom: view.zoom,
          maxIterations,
          startRow,
          endRow,
          taskId
        });
      }
    });
  }, [canvasRef, maxIterations]);

  // Animated transition
  const animateTo = useCallback((target: ViewState, duration: number = 300) => {
    targetViewRef.current = target;
    const startView = { ...currentViewRef.current };
    const startTime = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const currentView: ViewState = {
        centerX: startView.centerX + (target.centerX - startView.centerX) * eased,
        centerY: startView.centerY + (target.centerY - startView.centerY) * eased,
        zoom: startView.zoom * Math.pow(target.zoom / startView.zoom, eased),
      };
      
      currentViewRef.current = currentView;
      setViewState(currentView);
      render(currentView);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        targetViewRef.current = null;
      }
    };
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [render]);

  // Zoom at point
  const zoomAt = useCallback((screenX: number, screenY: number, zoomIn: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    
    const width = canvas.width;
    const height = canvas.height;
    const aspectRatio = width / height;
    
    const current = currentViewRef.current;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    // Convert screen coordinates to complex plane
    const realPart = current.centerX + (x / width - 0.5) * viewWidth;
    const imagPart = current.centerY + (y / height - 0.5) * viewHeight;
    
    const zoomFactor = zoomIn ? 2 : 0.5;
    const newZoom = current.zoom * zoomFactor;
    
    // Pan towards/away from click point
    const panFactor = zoomIn ? 0.5 : -0.5;
    const newCenterX = current.centerX + (realPart - current.centerX) * panFactor;
    const newCenterY = current.centerY + (imagPart - current.centerY) * panFactor;
    
    animateTo({
      centerX: newCenterX,
      centerY: newCenterY,
      zoom: newZoom,
    });
  }, [canvasRef, animateTo]);

  // Pan
  const pan = useCallback((deltaX: number, deltaY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const aspectRatio = width / height;
    
    const current = currentViewRef.current;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    const newView: ViewState = {
      centerX: current.centerX - (deltaX / width) * viewWidth,
      centerY: current.centerY - (deltaY / height) * viewHeight,
      zoom: current.zoom,
    };
    
    currentViewRef.current = newView;
    setViewState(newView);
    render(newView);
  }, [canvasRef, render]);

  // Reset view
  const reset = useCallback(() => {
    animateTo({
      centerX: -0.5,
      centerY: 0,
      zoom: 1,
    }, 500);
  }, [animateTo]);

  // Initial render
  useEffect(() => {
    render(viewState);
  }, []);

  // Handle resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    render(currentViewRef.current);
  }, [canvasRef, render]);

  return {
    viewState,
    isComputing,
    zoomAt,
    pan,
    reset,
    handleResize,
    render: () => render(currentViewRef.current),
  };
}
