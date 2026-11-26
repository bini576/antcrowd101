import type { ReactNode } from 'react';

export function StatWidget({
  label,
  value,
  detail,
  tone = 'neutral',
  icon
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning';
  icon?: ReactNode;
}) {
  return (
    <article className={['antui-stat', `antui-stat-${tone}`].join(' ')}>
      <div className="antui-stat-top">
        <span>{label}</span>
        {icon ? <div className="antui-stat-icon">{icon}</div> : null}
      </div>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
}
