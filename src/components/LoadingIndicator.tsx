interface LoadingIndicatorProps {
  visible: boolean;
}

export function LoadingIndicator({ visible }: LoadingIndicatorProps) {
  return (
    <div className={`loading-indicator ${visible ? 'visible' : ''}`}>
      <div className="spinner" />
      <span>Computing...</span>
    </div>
  );
}
