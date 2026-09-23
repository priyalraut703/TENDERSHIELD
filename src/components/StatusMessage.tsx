import type { ReactNode } from 'react';

export type StatusTone = 'info' | 'success' | 'error' | 'muted';

const TONE_STYLE: Record<StatusTone, string> = {
  info: 'ts-status ts-status-info',
  success: 'ts-status ts-status-success',
  error: 'ts-status ts-status-error',
  muted: 'ts-status ts-status-muted',
};

export function StatusMessage({ tone = 'info', children }: { tone?: StatusTone; children: ReactNode }) {
  return <div className={TONE_STYLE[tone]}>{children}</div>;
}

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="ts-banner ts-banner-error" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="ts-banner-dismiss" onClick={onDismiss} aria-label="Dismiss error">
          ×
        </button>
      )}
    </div>
  );
}