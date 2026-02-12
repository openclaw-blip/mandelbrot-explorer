import { useState, useCallback, useEffect, useRef } from 'react';

type CopyState = 'idle' | 'success' | 'error';

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  return (
    <div className="settings-menu" ref={menuRef}>
      <button 
        className={`settings-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Settings"
      >
        ⚙
      </button>
      
      {isOpen && (
        <div className="settings-dropdown">
          <button 
            className={`settings-item ${copyState}`}
            onClick={handleCopyLink}
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
