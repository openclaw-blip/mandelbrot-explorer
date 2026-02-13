import { useState, useCallback, useEffect, useRef } from 'react';
import { ColorTheme } from '../colorThemes';
import { interestingLocations } from '../locations';
import { FractalSet } from '../hooks/useWebGLMandelbrot';
import { JuliaPreset, MultibrotPreset } from '../juliaSets';

type CopyState = 'idle' | 'success' | 'error';

interface SettingsMenuProps {
  themes: ColorTheme[];
  currentTheme: ColorTheme;
  onThemeChange: (theme: ColorTheme) => void;
  colorScale: 'log' | 'linear';
  onScaleChange: (scale: 'log' | 'linear') => void;
  showOrbit: boolean;
  onOrbitToggle: (show: boolean) => void;
  fractalSet: FractalSet;
  onFractalSetChange: (set: FractalSet) => void;
  juliaPresets: JuliaPreset[];
  multibrotPresets: MultibrotPreset[];
  onScreenshot: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  onNavigateTo: (x: number, y: number, zoom: number) => void;
}

function HelpModal({ onClose }: { onClose: () => void }) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="help-modal-backdrop" onClick={onClose}>
      <div className="help-modal" onClick={e => e.stopPropagation()}>
        <h2>Keyboard Shortcuts</h2>
        <div className="help-row">
          <span className="help-key">Click</span>
          <span className="help-action">Zoom in</span>
        </div>
        <div className="help-row">
          <span className="help-key">Shift + Click</span>
          <span className="help-action">Zoom out</span>
        </div>
        <div className="help-row">
          <span className="help-key">Right Click</span>
          <span className="help-action">Zoom out</span>
        </div>
        <div className="help-row">
          <span className="help-key">Scroll</span>
          <span className="help-action">Zoom in/out</span>
        </div>
        <div className="help-row">
          <span className="help-key">Drag</span>
          <span className="help-action">Pan</span>
        </div>
        <div className="help-row">
          <span className="help-key">R</span>
          <span className="help-action">Reset view</span>
        </div>
        <div className="help-row">
          <span className="help-key">F</span>
          <span className="help-action">Fullscreen</span>
        </div>
        <div className="help-row">
          <span className="help-key">↑ / ↓</span>
          <span className="help-action">Change theme</span>
        </div>
        <div className="help-row">
          <span className="help-key">← / →</span>
          <span className="help-action">Rotate palette</span>
        </div>
        <button className="help-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function SettingsMenu({ themes, currentTheme, onThemeChange, colorScale, onScaleChange, showOrbit, onOrbitToggle, fractalSet, onFractalSetChange, juliaPresets, multibrotPresets, onScreenshot, onReset, onFullscreen, onNavigateTo }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click - delay listener to avoid catching the opening click
  useEffect(() => {
    if (!isOpen) {
      setShowThemes(false);
      setShowLocations(false);
      setShowSets(false);
      return;
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowThemes(false);
      }
    };

    // Delay adding listener to next frame so we don't catch the opening click
    const id = requestAnimationFrame(() => {
      document.addEventListener('click', handleClickOutside);
    });
    
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('success');
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopyState('success');
      } catch {
        setCopyState('error');
      }
    }

    setTimeout(() => {
      setCopyState('idle');
      setIsOpen(false);
    }, 800);
  }, []);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  const handleThemeSelect = useCallback((theme: ColorTheme) => {
    onThemeChange(theme);
    setShowThemes(false);
    setIsOpen(false);
  }, [onThemeChange]);

  // Generate a preview gradient for a theme
  const getThemePreview = (theme: ColorTheme) => {
    const stops = theme.colors.slice(0, 4).map((c, i) => {
      const percent = (i / 3) * 100;
      return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}) ${percent}%`;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  };

  return (
    <div className="settings-menu" ref={menuRef}>
      <button 
        className={`settings-toggle ${isOpen ? 'open' : ''}`}
        onClick={toggleMenu}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        aria-label="Settings"
      >
        ≡
      </button>
      
      {isOpen && (
        <div 
          className="settings-dropdown"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <button 
            className={`settings-item ${copyState}`}
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLink();
            }}
          >
            <span className="settings-label">
              {copyState === 'success' ? '> Copied' : copyState === 'error' ? '> Failed' : 'Copy Link'}
            </span>
          </button>
          
          <button 
            className="settings-item"
            onClick={(e) => {
              e.stopPropagation();
              onScreenshot();
              setIsOpen(false);
            }}
          >
            <span className="settings-label">Export Image</span>
          </button>
          
          <button 
            className="settings-item"
            onClick={(e) => {
              e.stopPropagation();
              onFullscreen();
              setIsOpen(false);
            }}
          >
            <span className="settings-label">Fullscreen</span>
          </button>
          
          <button 
            className="settings-item"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
              setIsOpen(false);
            }}
          >
            <span className="settings-label">Reset View</span>
          </button>
          
          <div className="settings-divider" />
          
          <div className="submenu-container">
          <button 
            className={`settings-item ${showSets ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowSets(!showSets);
              setShowLocations(false);
              setShowThemes(false);
            }}
          >
            <span className="settings-label">Fractal Set</span>
            <span className="settings-arrow">{showSets ? '−' : '+'}</span>
          </button>
          
          {showSets && (
            <div className="theme-list">
              <button
                className={`theme-item ${fractalSet.type === 'mandelbrot' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFractalSetChange({ type: 'mandelbrot' });
                  setShowSets(false);
                  setIsOpen(false);
                }}
              >
                <span className="theme-name">Mandelbrot</span>
                {fractalSet.type === 'mandelbrot' && <span className="theme-check">{'>'}</span>}
              </button>
              <button
                className={`theme-item ${fractalSet.type === 'burning-ship' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFractalSetChange({ type: 'burning-ship' });
                  setShowSets(false);
                  setIsOpen(false);
                }}
              >
                <span className="theme-name">Burning Ship</span>
                {fractalSet.type === 'burning-ship' && <span className="theme-check">{'>'}</span>}
              </button>
              <button
                className={`theme-item ${fractalSet.type === 'tricorn' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFractalSetChange({ type: 'tricorn' });
                  setShowSets(false);
                  setIsOpen(false);
                }}
              >
                <span className="theme-name">Tricorn</span>
                {fractalSet.type === 'tricorn' && <span className="theme-check">{'>'}</span>}
              </button>
              <div className="theme-divider" />
              <div className="theme-section-label">Multibrot (z^n + c)</div>
              {multibrotPresets.map(preset => {
                const isActive = fractalSet.type === 'multibrot' && fractalSet.power === preset.power;
                return (
                  <button
                    key={preset.id}
                    className={`theme-item ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFractalSetChange({ type: 'multibrot', power: preset.power });
                      setShowSets(false);
                      setIsOpen(false);
                    }}
                  >
                    <span className="theme-name">{preset.name}</span>
                    {isActive && <span className="theme-check">{'>'}</span>}
                  </button>
                );
              })}
              <div className="theme-divider" />
              <div className="theme-section-label">Julia Sets</div>
              {juliaPresets.map(preset => {
                const isActive = fractalSet.type === 'julia' && 
                  fractalSet.cr === preset.cr && fractalSet.ci === preset.ci;
                return (
                  <button
                    key={preset.id}
                    className={`theme-item ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFractalSetChange({ type: 'julia', cr: preset.cr, ci: preset.ci });
                      setShowSets(false);
                      setIsOpen(false);
                    }}
                  >
                    <span className="theme-name">{preset.name}</span>
                    {isActive && <span className="theme-check">{'>'}</span>}
                  </button>
                );
              })}
            </div>
          )}
          </div>
          
          <div className="submenu-container">
          <button 
            className={`settings-item ${showLocations ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowLocations(!showLocations);
              setShowSets(false);
              setShowThemes(false);
            }}
          >
            <span className="settings-label">Locations</span>
            <span className="settings-arrow">{showLocations ? '−' : '+'}</span>
          </button>
          
          {showLocations && (
            <div className="theme-list">
              {interestingLocations
                .filter(loc => loc.set === fractalSet.type)
                .map(loc => (
                  <button
                    key={loc.id}
                    className="theme-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateTo(loc.x, loc.y, loc.zoom);
                      setShowLocations(false);
                      setIsOpen(false);
                    }}
                  >
                    <span className="theme-name">{loc.name}</span>
                  </button>
                ))}
              {interestingLocations.filter(loc => loc.set === fractalSet.type).length === 0 && (
                <div className="theme-empty">No preset locations</div>
              )}
            </div>
          )}
          </div>
          
          <div className="submenu-container">
          <button 
            className={`settings-item ${showThemes ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowThemes(!showThemes);
              setShowLocations(false);
              setShowSets(false);
            }}
          >
            <span className="settings-label">Palette</span>
            <span className="settings-arrow">{showThemes ? '−' : '+'}</span>
          </button>
          
          {showThemes && (
            <div className="theme-list">
              {themes.map(theme => (
                <button
                  key={theme.id}
                  className={`theme-item ${theme.id === currentTheme.id ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleThemeSelect(theme);
                  }}
                >
                  <span 
                    className="theme-preview" 
                    style={{ background: getThemePreview(theme) }}
                  />
                  <span className="theme-name">{theme.name}</span>
                  {theme.id === currentTheme.id && <span className="theme-check">{'>'}</span>}
                </button>
              ))}
            </div>
          )}
          </div>
          
          <button 
            className="settings-item"
            onClick={(e) => {
              e.stopPropagation();
              onScaleChange(colorScale === 'log' ? 'linear' : 'log');
            }}
          >
            <span className="settings-label">Scale [{colorScale === 'log' ? 'LOG' : 'LIN'}]</span>
          </button>
          
          <button 
            className="settings-item"
            onClick={(e) => {
              e.stopPropagation();
              onOrbitToggle(!showOrbit);
            }}
          >
            <span className="settings-label">Orbit [{showOrbit ? 'ON' : 'OFF'}]</span>
          </button>
          
          <div className="settings-divider" />
          
          <button 
            className="settings-item"
            onClick={(e) => {
              e.stopPropagation();
              setShowHelp(true);
              setIsOpen(false);
            }}
          >
            <span className="settings-label">Controls</span>
          </button>
        </div>
      )}
      
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
