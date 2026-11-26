import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="antui-empty">
      <div className="antui-empty-icon" />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="antui-empty-action">{action}</div> : null}
    </div>
  );
}
