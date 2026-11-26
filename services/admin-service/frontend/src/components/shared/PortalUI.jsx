const statusToneMap = {
  draft: "neutral",
  new: "neutral",
  submitted: "neutral",
  pending: "warning",
  "in_retest": "warning",
  retesting: "warning",
  "needs_info": "warning",
  active: "success",
  approved: "success",
  accepted: "success",
  assigned: "success",
  closed: "neutral",
  declined: "danger",
  rejected: "danger",
  resolved: "success",
  paid: "success",
  unread: "accent",
  read: "neutral",
};

const severityToneMap = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "info",
  info: "info",
};

const iconMap = {
  inbox: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v8.63a1.75 1.75 0 0 1-1.75 1.75h-3.4a1 1 0 0 0-.9.56l-.35.7a.7.7 0 0 1-.62.39h-1.96a.7.7 0 0 1-.62-.39l-.35-.7a1 1 0 0 0-.9-.56h-3.4A1.75 1.75 0 0 1 4 14.38V5.75Z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 5.75 6v5.2c0 4.15 2.55 7.9 6.25 9.3 3.7-1.4 6.25-5.15 6.25-9.3V6L12 3.5Zm-1.1 10.9-2.2-2.2 1.05-1.05 1.15 1.15 3.35-3.35 1.05 1.05-4.4 4.4Z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l3.43 3.42 1.04-1.04-3.42-3.43A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2Zm6.25 11.25.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Zm-12.5 1.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.25 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm5.5 0a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM4 18.25c0-2.05 2.33-3.75 5.25-3.75s5.25 1.7 5.25 3.75V20H4v-1.75Zm11.5 1.75v-1.25c0-.78-.22-1.5-.63-2.15 2.27.18 4.13 1.53 4.13 3.4V20h-3.5Z" />
    </svg>
  ),
};

export function formatPortalLabel(value) {
  if (!value) return "Unknown";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function SeverityBadge({ severity, small = false }) {
  const normalized = String(severity || "informational").toLowerCase();
  const tone = severityToneMap[normalized] || "info";
  return (
    <span className={`pill tone-${tone}${small ? " small" : ""}`}>
      {formatPortalLabel(normalized)}
    </span>
  );
}

export function StatusBadge({ status, small = false }) {
  const normalized = String(status || "unknown").toLowerCase();
  const tone = statusToneMap[normalized] || "neutral";
  return (
    <span className={`pill tone-${tone}${small ? " small" : ""}`}>
      {formatPortalLabel(normalized)}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon = "spark",
  compact = false,
  action = null,
}) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <div className="empty-state-art">{iconMap[icon] || iconMap.spark}</div>
      <div className="empty-state-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
