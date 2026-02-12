import { useState, useCallback, useEffect, useRef } from 'react';
import { ColorTheme } from '../colorThemes';

type CopyState = 'idle' | 'success' | 'error';

interface SettingsMenuProps {
  themes: ColorTheme[];
  currentTheme: ColorTheme;
  onThemeChange: (theme: ColorTheme) => void;
}

export function SettingsMenu({ themes, currentTheme, onThemeChange }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click - delay listener to avoid catching the opening click
  useEffect(() => {
    if (!isOpen) {
      setShowThemes(false);
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
        ⚙
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
            <span className="settings-icon">
              {copyState === 'success' ? '✓' : copyState === 'error' ? '✗' : '🔗'}
            </span>
            <span className="settings-label">
              {copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Failed' : 'Copy link'}
            </span>
          </button>
          
          <div className="settings-divider" />
          
          <button 
            className={`settings-item ${showThemes ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowThemes(!showThemes);
            }}
          >
            <span className="settings-icon">🎨</span>
            <span className="settings-label">Colors</span>
            <span className="settings-arrow">{showThemes ? '▼' : '▶'}</span>
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
                  {theme.id === currentTheme.id && <span className="theme-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
