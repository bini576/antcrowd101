import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function Badge({
  children,
  tone = 'neutral',
  className = ''
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return <span className={['antui-badge', `antui-badge-${tone}`, className].filter(Boolean).join(' ')}>{children}</span>;
}
