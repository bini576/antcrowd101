import Button from './Button';

type HeroProps = {
  title: string;
  subtitle: string;
  onAction?: () => void;
};

export default function Hero({ title, subtitle, onAction }: HeroProps) {
  return (
    <section style={{ padding: '2rem', background: '#f8fafc', borderRadius: '12px' }}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <Button label="Start Free Trial" onClick={onAction} />
    </section>
  );
}
