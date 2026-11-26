export function LoadingState({ label = 'Loading workspace...' }: { label?: string }) {
  return (
    <div className="antui-loading" aria-live="polite">
      <div className="antui-loading-line antui-loading-line-lg" />
      <div className="antui-loading-line" />
      <div className="antui-loading-line" />
      <p>{label}</p>
    </div>
  );
}
