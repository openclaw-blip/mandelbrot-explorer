export function HelpOverlay() {
  return (
    <div className="help-overlay">
      <div className="help-row">
        <span className="help-key">Click</span>
        <span className="help-action">Zoom in</span>
      </div>
      <div className="help-row">
        <span className="help-key">Right-click</span>
        <span className="help-action">Zoom out</span>
      </div>
      <div className="help-row">
        <span className="help-key">Shift + Click</span>
        <span className="help-action">Zoom out</span>
      </div>
      <div className="help-row">
        <span className="help-key">Drag</span>
        <span className="help-action">Pan</span>
      </div>
      <div className="help-row">
        <span className="help-key">R</span>
        <span className="help-action">Reset view</span>
      </div>
    </div>
  );
}
