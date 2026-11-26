import { resolveBrandAsset } from '../assets';

function initials(name?: string) {
  if (!name) return 'AC';
  const parts = name.split(' ').filter(Boolean);
  const value = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
  return value || 'AC';
}

export function Avatar({
  name,
  src,
  size = 'md',
  className = ''
}: {
  name?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const image = resolveBrandAsset(src);

  return (
    <span className={['antui-avatar', `antui-avatar-${size}`, className].filter(Boolean).join(' ')}>
      {image ? <img alt={name || 'Avatar'} src={image} /> : <span>{initials(name)}</span>}
    </span>
  );
}
