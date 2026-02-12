import { useState, useCallback, useEffect, useRef } from 'react';

type CopyState = 'idle' | 'success' | 'error';

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click - delay listener to avoid catching the opening click
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
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
        </div>
      )}
    </div>
  );
}
