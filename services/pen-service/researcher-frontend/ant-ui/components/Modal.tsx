import type { ReactNode } from 'react';

export function Modal({
  open,
  title,
  children,
  footer,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="antui-modal-backdrop" onClick={onClose} role="presentation">
      <div className="antui-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="antui-modal-header">
          <h3>{title}</h3>
          <button className="antui-link-button" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="antui-modal-body">{children}</div>
        {footer ? <footer className="antui-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
