import React from 'react';
import { Link } from 'react-router-dom';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  asideTitle: string;
  asideBody: string;
  highlights: string[];
  topLinkLabel: string;
  topLinkTo: string;
  topLinkPrompt: string;
  children: React.ReactNode;
};

export default function AuthShell({
  eyebrow,
  title,
  description,
  asideTitle,
  asideBody,
  highlights,
  topLinkLabel,
  topLinkPrompt,
  topLinkTo,
  children
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.22),_transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.12),_transparent_50%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col gap-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <section className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#0f172a_0%,#172554_55%,#1d4ed8_100%)] p-8 text-white shadow-panel sm:p-10">
          <div className="absolute -right-20 top-10 h-52 w-52 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="absolute -left-8 bottom-0 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200">
                {eyebrow}
              </div>
              <h1 className="mt-6 max-w-xl font-space text-4xl font-bold leading-tight sm:text-5xl">{asideTitle}</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">{asideBody}</p>
            </div>

            <div className="mt-10 space-y-4">
              {highlights.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-brand-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-card flex flex-col justify-between p-6 sm:p-8">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
                <h2 className="mt-3 font-space text-3xl font-bold tracking-tight text-ink">{title}</h2>
              </div>
              <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 sm:block">
                Trusted access
              </div>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
            <div className="mt-8">{children}</div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-600">
            {topLinkPrompt}{' '}
            <Link className="font-semibold text-brand-600 transition hover:text-brand-700" to={topLinkTo}>
              {topLinkLabel}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
