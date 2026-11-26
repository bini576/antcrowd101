import React from 'react';

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export default function AuthField({ label, hint, id, className = '', ...props }: AuthFieldProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <label className="block">
      <span className="auth-label">{label}</span>
      <input id={inputId} className={`auth-input ${className}`.trim()} {...props} />
      {hint ? <span className="mt-2 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
