import { useState, useCallback } from 'react';

type CopyState = 'idle' | 'success' | 'error';

export function ShareButton() {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('success');
    } catch {
      // Fallback for older browsers
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

    // Reset after 1.5s
    setTimeout(() => setCopyState('idle'), 1500);
  }, []);

  const getIcon = () => {
    switch (copyState) {
      case 'success': return '✓';
      case 'error': return '✗';
      default: return '🔗';
    }
  };

  const getTooltip = () => {
    switch (copyState) {
      case 'success': return 'Copied!';
      case 'error': return 'Failed - copy from address bar';
      default: return 'Copy link';
    }
  };

  return (
    <button
      className={`share-button ${copyState}`}
      onClick={handleCopy}
      title={getTooltip()}
      aria-label={getTooltip()}
    >
      <span className="share-icon">{getIcon()}</span>
      {copyState !== 'idle' && (
        <span className="share-label">{getTooltip()}</span>
      )}
    </button>
  );
}
