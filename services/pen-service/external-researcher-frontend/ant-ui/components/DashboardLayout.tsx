import type { ReactNode } from 'react';

export function DashboardLayout({
  sidebar,
  navbar,
  children,
  className = ''
}: {
  sidebar?: ReactNode;
  navbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="antui-app">
      <div className={['antui-shell', sidebar ? 'antui-shell-with-sidebar' : 'antui-shell-full', className].filter(Boolean).join(' ')}>
        {sidebar ? <aside className="antui-sidebar-shell">{sidebar}</aside> : null}
        <div className="antui-main-shell">
          {navbar ? <div className="antui-navbar-shell">{navbar}</div> : null}
          <main className="antui-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
