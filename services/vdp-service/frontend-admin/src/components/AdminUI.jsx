const severityToneMap = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "info",
  info: "info",
};

const statusToneMap = {
  active: "success",
  accepted: "success",
  resolved: "success",
  published: "success",
  triaged: "accent",
  retesting: "warning",
  needs_info: "warning",
  draft: "neutral",
  inactive: "neutral",
  paused: "neutral",
  new: "neutral",
  rejected: "danger",
  duplicate: "danger",
  informative: "neutral",
  not_applicable: "neutral",
  unread: "accent",
  read: "neutral",
};

const iconMap = {
  shield: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.75 5.5 6.5v4.9c0 4.32 2.63 8.18 6.5 9.62 3.87-1.44 6.5-5.3 6.5-9.62V6.5L12 3.75Zm-.95 11.15-2.3-2.3 1.05-1.05 1.25 1.25 3.55-3.55 1.05 1.05-4.6 4.6Z" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.75a4.75 4.75 0 0 0-4.75 4.75v1.1c0 1.1-.36 2.17-1.02 3.05L4.7 14.7a1 1 0 0 0 .8 1.6h13a1 1 0 0 0 .8-1.6l-1.53-2.05a5.08 5.08 0 0 1-1.02-3.05V8.5A4.75 4.75 0 0 0 12 3.75Zm0 17a2.5 2.5 0 0 0 2.33-1.6H9.67A2.5 2.5 0 0 0 12 20.75Z" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.75 6.5a1.75 1.75 0 0 1 1.75-1.75h4.05c.46 0 .9.18 1.23.51l1.01 1.01c.33.33.77.51 1.23.51h5.48a1.75 1.75 0 0 1 1.75 1.75v7a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2v-9Z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.75 19.25h14.5v1.5H3.25V4.75h1.5v14.5Zm3-2.75h-1.5v-5h1.5v5Zm5 0h-1.5V8.25h1.5V16.5Zm5 0h-1.5V5.75h1.5V16.5Z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l3.43 3.42 1.04-1.04-3.42-3.43A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm-6.25 13c0-2.62 2.8-4.75 6.25-4.75s6.25 2.13 6.25 4.75V19H5.75v-1.75Z" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2Zm6.25 11.25.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Zm-12.5 1.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
    </svg>
  ),
};

export function formatLabel(value) {
  if (!value) return "Unknown";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

export function SeverityBadge({ severity }) {
  const normalized = String(severity || "info").toLowerCase();
  return <span className={`tone-pill tone-${severityToneMap[normalized] || "info"}`}>{formatLabel(normalized)}</span>;
}

export function StatusBadge({ status }) {
  const normalized = String(status || "unknown").toLowerCase();
  return <span className={`tone-pill tone-${statusToneMap[normalized] || "neutral"}`}>{formatLabel(normalized)}</span>;
}

export function SLABadge({ overdue = false, label }) {
  return (
    <span className={`tone-pill ${overdue ? "tone-danger" : "tone-success"}`}>
      {label || (overdue ? "Overdue" : "On Time")}
    </span>
  );
}

export function EmptyState({ title, description, icon = "spark", action = null, compact = false }) {
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

export function Toast({ message, tone = "success" }) {
  if (!message) return null;
  return <div className={`toast toast-${tone}`}>{message}</div>;
}

export function LoadingCard({ label = "Loading workspace..." }) {
  return (
    <div className="card loading-card" aria-live="polite">
      <div className="loading-line loading-line-lg" />
      <div className="loading-line" />
      <div className="loading-line" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function FieldHint({ title, children }) {
  return (
    <p className="field-hint">
      {title ? <strong>{title}: </strong> : null}
      {children}
    </p>
  );
}

export function HelpTooltip({ text }) {
  return (
    <span className="help-tooltip" tabIndex={0} aria-label={text}>
      ?
      <span className="help-tooltip-bubble">{text}</span>
    </span>
  );
}

export function Modal({ open, title, subtitle, children, footer, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-shell" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn icon-btn secondary" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function NotificationBell({ count = 0, onClick }) {
  return (
    <button type="button" className="bell-btn" onClick={onClick} aria-label="Open notifications">
      <span className="bell-btn-icon">{iconMap.bell}</span>
      <span>Notifications</span>
      {count > 0 ? <span className="bell-count">{count > 99 ? "99+" : count}</span> : null}
    </button>
  );
}

export function MiniBarList({ items = [], formatter = (value) => value }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="mini-bar-list">
      {items.map((item) => (
        <div key={item.label} className="mini-bar-row">
          <div className="mini-bar-copy">
            <span>{item.label}</span>
            <strong>{formatter(item.value)}</strong>
          </div>
          <div className="mini-bar-track">
            <div className={`mini-bar-fill ${item.tone || ""}`} style={{ width: `${(Number(item.value || 0) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
