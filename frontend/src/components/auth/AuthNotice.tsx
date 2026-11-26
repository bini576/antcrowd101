import React from 'react';

type AuthNoticeProps = {
  tone?: 'info' | 'success' | 'error';
  children: React.ReactNode;
};

const toneClasses: Record<NonNullable<AuthNoticeProps['tone']>, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800'
};

export default function AuthNotice({ tone = 'info', children }: AuthNoticeProps) {
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses[tone]}`}>{children}</div>;
}
