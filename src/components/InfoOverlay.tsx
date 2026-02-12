interface InfoOverlayProps {
  centerX: number;
  centerY: number;
  zoom: number;
}

export function InfoOverlay({ centerX, centerY, zoom }: InfoOverlayProps) {
  const formatNumber = (n: number, precision: number = 12) => {
    if (Math.abs(n) < 0.0001 || Math.abs(n) >= 10000) {
      return n.toExponential(precision);
    }
    return n.toFixed(precision);
  };

  const formatZoom = (z: number) => {
    if (z >= 1000000) {
      return z.toExponential(2) + 'x';
    }
    if (z >= 1000) {
      return (z / 1000).toFixed(1) + 'Kx';
    }
    return z.toFixed(1) + 'x';
  };

  return (
    <div className="info-overlay">
      <div className="info-row">
        <span className="info-label">Real</span>
        <span className="info-value real">{formatNumber(centerX)}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Imag</span>
        <span className="info-value imag">{formatNumber(centerY)}i</span>
      </div>
      <div className="info-row">
        <span className="info-label">Zoom</span>
        <span className="info-value zoom">{formatZoom(zoom)}</span>
      </div>
    </div>
  );
}
