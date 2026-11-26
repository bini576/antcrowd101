import type { ReactNode } from 'react';
import { resolveBrandAsset } from '../assets';

type SidebarItem = {
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
};

export function Sidebar({
  title,
  description,
  items = [],
  footer,
  brandMark,
  brandWordmark
}: {
  title: string;
  description?: string;
  items?: SidebarItem[];
  footer?: ReactNode;
  brandMark?: string;
  brandWordmark?: string;
}) {
  const image = resolveBrandAsset(brandMark);
  const wordmark = resolveBrandAsset(brandWordmark);

  return (
    <div className="antui-sidebar">
      <div className="antui-sidebar-brand">
        {image ? (
          <div className="antui-sidebar-brand-mark">
            <img alt="AntCrowd mark" className="antui-sidebar-mark" src={image} />
          </div>
        ) : null}
        <div className="antui-sidebar-brand-copy">
          {wordmark ? <img alt="AntCrowd" className="antui-sidebar-wordmark" src={wordmark} /> : <span>ANTCROWD</span>}
          <strong>{title}</strong>
        </div>
      </div>
      {description ? <p className="antui-sidebar-description">{description}</p> : null}
      <nav className="antui-sidebar-nav">
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
      {footer ? <div className="antui-sidebar-footer">{footer}</div> : null}
    </div>
  );
}
