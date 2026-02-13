import { useEffect, useRef, useState, useCallback } from 'react';
import { VideoExportConfig } from './VideoExportModal';

interface VideoRecorderProps {
  config: VideoExportConfig;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onRenderFrame: (centerX: number, centerY: number, zoom: number) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export function VideoRecorder({ config, canvasRef, onRenderFrame, onComplete, onCancel }: VideoRecorderProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'preparing' | 'recording' | 'encoding' | 'complete' | 'error'>('preparing');
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas) {
      setError('Canvas not available');
      setStatus('error');
      return;
    }

    // Store original size
    originalSizeRef.current = {
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    };

    // Create recording canvas at target resolution
    const recordingCanvas = document.createElement('canvas');
    recordingCanvas.width = config.width;
    recordingCanvas.height = config.height;
    recordingCanvasRef.current = recordingCanvas;

    // Set up MediaRecorder
    const stream = recordingCanvas.captureStream(config.fps);
    
    // Check for codec support
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    
    let mimeType = mimeTypes.find(mt => MediaRecorder.isTypeSupported(mt));
    if (!mimeType) {
      setError('No supported video codec found');
      setStatus('error');
      return;
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 20000000, // 20 Mbps for quality
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      if (cancelledRef.current) {
        // Restore original size
        if (originalSizeRef.current && sourceCanvas) {
          sourceCanvas.width = originalSizeRef.current.width;
          sourceCanvas.height = originalSizeRef.current.height;
        }
        return;
      }
      
      setStatus('encoding');
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fractal-zoom-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Restore original size
      if (originalSizeRef.current && sourceCanvas) {
        sourceCanvas.width = originalSizeRef.current.width;
        sourceCanvas.height = originalSizeRef.current.height;
      }
      
      setStatus('complete');
      setTimeout(onComplete, 1000);
    };

    // Resize source canvas to target resolution
    sourceCanvas.width = config.width;
    sourceCanvas.height = config.height;

    // Start recording
    setStatus('recording');
    mediaRecorder.start();

    const totalFrames = config.duration * config.fps;
    const frameInterval = 1000 / config.fps;
    let frame = 0;
    let lastFrameTime = 0;

    const renderFrame = (timestamp: number) => {
      if (cancelledRef.current) {
        mediaRecorder.stop();
        return;
      }

      // Throttle to target fps
      if (timestamp - lastFrameTime < frameInterval * 0.9) {
        requestAnimationFrame(renderFrame);
        return;
      }
      lastFrameTime = timestamp;

      const t = frame / totalFrames;
      
      // Interpolate position (linear for x/y, exponential for zoom)
      const currentX = config.startX + (config.endX - config.startX) * t;
      const currentY = config.startY + (config.endY - config.startY) * t;
      const currentZoom = config.startZoom * Math.pow(config.endZoom / config.startZoom, t);

      // Render using the main app's renderer
      onRenderFrame(currentX, currentY, currentZoom);

      // Copy to recording canvas
      const ctx = recordingCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(sourceCanvas, 0, 0);
      }

      setProgress((frame / totalFrames) * 100);
      frame++;

      if (frame <= totalFrames) {
        requestAnimationFrame(renderFrame);
      } else {
        mediaRecorder.stop();
      }
    };

    // Start the render loop
    requestAnimationFrame(renderFrame);

    return () => {
      cancelledRef.current = true;
      // Restore original size
      if (originalSizeRef.current && sourceCanvas) {
        sourceCanvas.width = originalSizeRef.current.width;
        sourceCanvas.height = originalSizeRef.current.height;
      }
    };
  }, [config, canvasRef, onRenderFrame, onComplete]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    onCancel();
  }, [onCancel]);

  return (
    <div className="video-recorder-backdrop">
      <div className="video-recorder">
        <div className="video-recorder-preview">
          <canvas 
            ref={el => {
              if (recordingCanvasRef.current && el) {
                const ctx = el.getContext('2d');
                if (ctx && recordingCanvasRef.current) {
                  el.width = recordingCanvasRef.current.width;
                  el.height = recordingCanvasRef.current.height;
                }
              }
            }}
            className="video-recorder-canvas"
            style={{
              maxWidth: '100%',
              maxHeight: '60vh',
            }}
          />
        </div>
        
        <div className="video-recorder-info">
          <div className="video-recorder-status">
            {status === 'preparing' && 'INITIALIZING...'}
            {status === 'recording' && `RECORDING ${progress.toFixed(0)}%`}
            {status === 'encoding' && 'ENCODING...'}
            {status === 'complete' && 'COMPLETE - DOWNLOADING'}
            {status === 'error' && `ERROR: ${error}`}
          </div>
          
          <div className="video-recorder-progress">
            <div 
              className="video-recorder-progress-bar" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="video-recorder-details">
            {config.width}×{config.height} | {config.fps}fps | {config.duration}s
          </div>
          
          {(status === 'recording' || status === 'preparing') && (
            <button className="video-recorder-cancel" onClick={handleCancel}>
              Cancel Recording
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
