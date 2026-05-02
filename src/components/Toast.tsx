import { useEffect } from 'react';

interface Props {
  message: string;
  variant?: 'success' | 'info' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, variant = 'info', onClose, duration = 4000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div className={`toast toast--${variant}`} role="status">
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="閉じる">
        ✕
      </button>
    </div>
  );
}
