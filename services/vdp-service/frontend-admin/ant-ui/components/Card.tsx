import type { ReactNode } from 'react';

export function Card({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = ''
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={['antui-card', className].filter(Boolean).join(' ')}>
      {eyebrow || title || actions ? (
        <header className="antui-card-header">
          <div>
            {eyebrow ? <p className="antui-card-eyebrow">{eyebrow}</p> : null}
            {title ? <h3 className="antui-card-title">{title}</h3> : null}
            {description ? <p className="antui-card-description">{description}</p> : null}
          </div>
          {actions ? <div className="antui-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="antui-card-body">{children}</div>
    </section>
  );
}
