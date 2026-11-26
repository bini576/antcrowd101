import type { ReactNode } from 'react';
import { resolveBrandAsset } from '../assets';

type NavItem = {
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
};

export function Navbar({
  brand = 'AntCrowd',
  brandMark,
  brandWordmark,
  items = [],
  actions
}: {
  brand?: string;
  brandMark?: string;
  brandWordmark?: string;
  items?: NavItem[];
  actions?: ReactNode;
}) {
  const image = resolveBrandAsset(brandMark);
  const wordmark = resolveBrandAsset(brandWordmark);

  return (
    <header className="antui-navbar">
      <div className="antui-navbar-brand">
        {image ? (
          <div className="antui-navbar-brand-mark">
            <img alt="AntCrowd mark" className="antui-navbar-mark" src={image} />
          </div>
        ) : null}
        <div className="antui-navbar-brand-copy">
          {wordmark ? <img alt="AntCrowd" className="antui-navbar-wordmark" src={wordmark} /> : <span className="antui-navbar-brand-kicker">ANTCROWD</span>}
          <strong>{brand}</strong>
        </div>
      </div>
      <nav className="antui-navbar-nav">
        {items.map((item) =>
          item.href ? (
            <a aria-current={item.active ? 'page' : undefined} className={item.active ? 'is-active' : ''} href={item.href} key={item.label}>
              {item.label}
            </a>
          ) : (
            <button aria-current={item.active ? 'page' : undefined} className={item.active ? 'is-active' : ''} key={item.label} onClick={item.onClick} type="button">
              {item.label}
            </button>
          )
        )}
      </nav>
      {actions ? <div className="antui-navbar-actions">{actions}</div> : null}
    </header>
  );
}
