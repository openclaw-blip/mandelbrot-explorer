import { useState, useCallback, useRef, useEffect } from 'react';

interface VideoExportModalProps {
  currentX: number;
  currentY: number;
  currentZoom: number;
  onClose: () => void;
  onExport: (config: VideoExportConfig) => void;
}

export interface VideoExportConfig {
  startX: number;
  startY: number;
  startZoom: number;
  endX: number;
  endY: number;
  endZoom: number;
  duration: number;
  fps: number;
  width: number;
  height: number;
}

const RESOLUTION_PRESETS = [
  { label: '720P', width: 1280, height: 720 },
  { label: '1080P', width: 1920, height: 1080 },
  { label: '1440P', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 },
];

const FPS_OPTIONS = [24, 30, 60];
const DURATION_OPTIONS = [5, 10, 15, 30, 60];

export function VideoExportModal({ currentX, currentY, currentZoom, onClose, onExport }: VideoExportModalProps) {
  const [startX, setStartX] = useState(currentX);
  const [startY, setStartY] = useState(currentY);
  const [startZoom, setStartZoom] = useState(currentZoom);
  const [endX, setEndX] = useState(currentX);
  const [endY, setEndY] = useState(currentY);
  const [endZoom, setEndZoom] = useState(currentZoom * 100);
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState(30);
  const [resolution, setResolution] = useState(RESOLUTION_PRESETS[1]); // 1080p default
  
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleExport = useCallback(() => {
    onExport({
      startX,
      startY,
      startZoom,
      endX,
      endY,
      endZoom,
      duration,
      fps,
      width: resolution.width,
      height: resolution.height,
    });
  }, [startX, startY, startZoom, endX, endY, endZoom, duration, fps, resolution, onExport]);

  const handleUseCurrentAsStart = useCallback(() => {
    setStartX(currentX);
    setStartY(currentY);
    setStartZoom(currentZoom);
  }, [currentX, currentY, currentZoom]);

  const handleUseCurrentAsEnd = useCallback(() => {
    setEndX(currentX);
    setEndY(currentY);
    setEndZoom(currentZoom);
  }, [currentX, currentY, currentZoom]);

  const formatNumber = (n: number) => {
    if (Math.abs(n) < 0.0001 || Math.abs(n) >= 1000) {
      return n.toExponential(4);
    }
    return n.toFixed(6);
  };

  const formatZoom = (z: number) => {
    if (z >= 1e9) return z.toExponential(1) + '×';
    if (z >= 1e6) return (z / 1e6).toFixed(1) + 'M×';
    if (z >= 1e3) return (z / 1e3).toFixed(1) + 'K×';
    return z.toFixed(1) + '×';
  };

  const totalFrames = duration * fps;
  const zoomFactor = endZoom / startZoom;

  return (
    <div className="video-modal-backdrop" onClick={onClose}>
      <div className="video-modal" ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="video-modal-header">
          <h2>Export Video</h2>
        </div>

        <div className="video-modal-content">
          <div className="video-section">
            <div className="video-section-header">
              <span>Start Position</span>
              <button className="video-use-current" onClick={handleUseCurrentAsStart}>
                Use Current
              </button>
            </div>
            <div className="video-coords">
              <span>RE: {formatNumber(startX)}</span>
              <span>IM: {formatNumber(startY)}</span>
              <span>MAG: {formatZoom(startZoom)}</span>
            </div>
          </div>

          <div className="video-section">
            <div className="video-section-header">
              <span>End Position</span>
              <button className="video-use-current" onClick={handleUseCurrentAsEnd}>
                Use Current
              </button>
            </div>
            <div className="video-coords">
              <span>RE: {formatNumber(endX)}</span>
              <span>IM: {formatNumber(endY)}</span>
              <span>MAG: {formatZoom(endZoom)}</span>
            </div>
          </div>

          <div className="video-divider" />

          <div className="video-row">
            <span className="video-label">Duration</span>
            <div className="video-options">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  className={`video-option ${duration === d ? 'active' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <div className="video-row">
            <span className="video-label">Frame Rate</span>
            <div className="video-options">
              {FPS_OPTIONS.map(f => (
                <button
                  key={f}
                  className={`video-option ${fps === f ? 'active' : ''}`}
                  onClick={() => setFps(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="video-row">
            <span className="video-label">Resolution</span>
            <div className="video-options">
              {RESOLUTION_PRESETS.map(r => (
                <button
                  key={r.label}
                  className={`video-option ${resolution.label === r.label ? 'active' : ''}`}
                  onClick={() => setResolution(r)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="video-divider" />

          <div className="video-summary">
            <div className="video-summary-row">
              <span>Total Frames</span>
              <span>{totalFrames}</span>
            </div>
            <div className="video-summary-row">
              <span>Zoom Factor</span>
              <span>{formatZoom(zoomFactor)}</span>
            </div>
            <div className="video-summary-row">
              <span>Output</span>
              <span>{resolution.width}×{resolution.height} WebM</span>
            </div>
          </div>
        </div>

        <div className="video-modal-footer">
          <button className="video-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="video-export" onClick={handleExport}>
            Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}
