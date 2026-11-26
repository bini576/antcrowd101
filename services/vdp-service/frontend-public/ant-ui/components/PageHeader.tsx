import type { ReactNode } from 'react';
import { resolveBrandAsset } from '../assets';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  aside,
  image,
  imageAlt = '',
  className = ''
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  image?: string;
  imageAlt?: string;
  className?: string;
}) {
  const media = resolveBrandAsset(image);

  return (
    <section className={['antui-page-header', className].filter(Boolean).join(' ')}>
      <div className="antui-page-header-copy">
        {eyebrow ? <p className="antui-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{description}</p>
        {actions ? <div className="antui-page-header-actions">{actions}</div> : null}
      </div>
      <div className="antui-page-header-side">
        {media ? <img alt={imageAlt} className="antui-page-header-image" src={media} /> : null}
        {aside ? <div className="antui-page-header-panel">{aside}</div> : null}
      </div>
    </section>
  );
}
