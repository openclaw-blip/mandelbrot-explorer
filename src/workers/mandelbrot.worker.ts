// Mandelbrot Web Worker for high-performance computation

interface ComputeMessage {
  type: 'compute';
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  zoom: number;
  maxIterations: number;
  startRow: number;
  endRow: number;
  taskId: number;
}

interface ResultMessage {
  type: 'result';
  iterations: Int32Array;
  startRow: number;
  endRow: number;
  taskId: number;
}

self.onmessage = (e: MessageEvent<ComputeMessage>) => {
  const { type, width, height, centerX, centerY, zoom, maxIterations, startRow, endRow, taskId } = e.data;
  
  if (type !== 'compute') return;
  
  const rows = endRow - startRow;
  const iterations = new Int32Array(width * rows);
  
  const aspectRatio = width / height;
  const viewWidth = 4 / zoom;
  const viewHeight = viewWidth / aspectRatio;
  
  const minX = centerX - viewWidth / 2;
  const minY = centerY - viewHeight / 2;
  
  const dx = viewWidth / width;
  const dy = viewHeight / height;
  
  let idx = 0;
  
  for (let py = startRow; py < endRow; py++) {
    const y0 = minY + py * dy;
    
    for (let px = 0; px < width; px++) {
      const x0 = minX + px * dx;
      
      // Cardioid and bulb check for optimization
      const q = (x0 - 0.25) * (x0 - 0.25) + y0 * y0;
      if (q * (q + (x0 - 0.25)) <= 0.25 * y0 * y0) {
        iterations[idx++] = maxIterations;
        continue;
      }
      
      // Period-2 bulb check
      const x1 = x0 + 1;
      if (x1 * x1 + y0 * y0 <= 0.0625) {
        iterations[idx++] = maxIterations;
        continue;
      }
      
      // Main iteration loop with optimizations
      let x = 0;
      let y = 0;
      let x2 = 0;
      let y2 = 0;
      let iter = 0;
      
      // Use period checking for faster escape
      let xOld = 0;
      let yOld = 0;
      let period = 0;
      
      while (x2 + y2 <= 4 && iter < maxIterations) {
        y = 2 * x * y + y0;
        x = x2 - y2 + x0;
        x2 = x * x;
        y2 = y * y;
        iter++;
        
        // Period checking
        if (x === xOld && y === yOld) {
          iter = maxIterations;
          break;
        }
        
        period++;
        if (period > 20) {
          period = 0;
          xOld = x;
          yOld = y;
        }
      }
      
      iterations[idx++] = iter;
    }
  }
  
  const result: ResultMessage = {
    type: 'result',
    iterations,
    startRow,
    endRow,
    taskId
  };
  
  self.postMessage(result, { transfer: [iterations.buffer] });
};
