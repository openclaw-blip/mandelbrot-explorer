interface InfoOverlayProps {
  centerX: number;
  centerY: number;
  zoom: number;
}

export function InfoOverlay({ centerX, centerY, zoom }: InfoOverlayProps) {
  const formatNumber = (n: number) => {
    if (Math.abs(n) < 0.0001 || Math.abs(n) >= 1000) {
      return n.toExponential(6);
    }
    return n.toFixed(8);
  };

  const formatZoom = (z: number) => {
    if (z >= 1e9) return z.toExponential(1) + '×';
    if (z >= 1e6) return (z / 1e6).toFixed(1) + 'M×';
    if (z >= 1e3) return (z / 1e3).toFixed(1) + 'K×';
    return z.toFixed(1) + '×';
  };

  const sign = centerY >= 0 ? '+' : '';

  return (
    <div className="info-overlay">
      <span className="info-item"><span className="info-label">r</span>{formatNumber(centerX)}</span>
      <span className="info-item"><span className="info-label">i</span>{sign}{formatNumber(centerY)}</span>
      <span className="info-item"><span className="info-label">z</span>{formatZoom(zoom)}</span>
    </div>
  );
}
