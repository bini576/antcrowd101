import type { ReactNode } from 'react';

export function FormField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="antui-field">
      <span className="antui-field-label">{label}</span>
      {hint ? <span className="antui-field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="antui-form-section">
      <header>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="antui-form-grid">{children}</div>
    </section>
  );
}
