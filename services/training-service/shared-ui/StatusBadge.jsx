export default function StatusBadge({ status }) {
  const raw = String(status || "unknown").toLowerCase();
  const normalized = raw.replace(/\s+/g, "_");
  const label = normalized.replace(/_/g, " ");

  const styles = {
    critical: "bg-red-500/15 text-red-200 border-red-500/30",
    high: "bg-red-500/15 text-red-200 border-red-500/30",
    medium: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    low: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    informational: "bg-slate-800 text-slate-300 border-slate-700",

    pending: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    requested: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    draft: "bg-slate-800 text-slate-300 border-slate-700",
    under_preparation: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
    quote_sent: "bg-red-500/15 text-red-200 border-red-500/30",
    quote_approved: "bg-red-500/15 text-red-200 border-red-500/30",
    payment_pending: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    unpaid: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    none: "bg-slate-800 text-slate-300 border-slate-700",

    approved: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    sent: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    triaged: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    assigned: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    scheduled: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    retesting: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    needs_info: "bg-purple-500/15 text-purple-200 border-purple-500/30",

    completed: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    delivered: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    paid: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    resolved: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    accepted: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    verified: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    payment_verified: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",

    rejected: "bg-red-500/15 text-red-200 border-red-500/30",
    canceled: "bg-red-500/15 text-red-200 border-red-500/30",
    inactive: "bg-red-500/15 text-red-200 border-red-500/30"
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        styles[normalized] || "bg-slate-800 text-slate-300 border-slate-700"
      ].join(" ")}
    >
      {label}
    </span>
  );
}
