const iconMap = {
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="m12 2 1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2Zm6.25 11.25.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Zm-12.5 1.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v8.63a1.75 1.75 0 0 1-1.75 1.75h-3.4a1 1 0 0 0-.9.56l-.35.7a.7.7 0 0 1-.62.39h-1.96a.7.7 0 0 1-.62-.39l-.35-.7a1 1 0 0 0-.9-.56h-3.4A1.75 1.75 0 0 1 4 14.38V5.75Z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M12 3.5 5.75 6v5.2c0 4.15 2.55 7.9 6.25 9.3 3.7-1.4 6.25-5.15 6.25-9.3V6L12 3.5Zm-1.1 10.9-2.2-2.2 1.05-1.05 1.15 1.15 3.35-3.35 1.05 1.05-4.4 4.4Z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M9.25 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm5.5 0a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM4 18.25c0-2.05 2.33-3.75 5.25-3.75s5.25 1.7 5.25 3.75V20H4v-1.75Zm11.5 1.75v-1.25c0-.78-.22-1.5-.63-2.15 2.27.18 4.13 1.53 4.13 3.4V20h-3.5Z" />
    </svg>
  ),
};

export default function EmptyState({ title, description, icon = "spark", action = null, compact = false }) {
  return (
    <div
      className={[
        "rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-slate-300",
        compact ? "p-4" : "p-5"
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
          {iconMap[icon] || iconMap.spark}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-sm text-slate-400">{description}</p>
          {action}
        </div>
      </div>
    </div>
  );
}
