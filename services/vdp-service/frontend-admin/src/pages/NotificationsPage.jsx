import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, StatusBadge, Toast, formatDateTime } from "../components/AdminUI";
import { listOrgNotifications, markOrgNotificationRead } from "../services/api";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listOrgNotifications();
      setItems(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(notificationId) {
    setError("");
    setSavingId(notificationId);
    try {
      await markOrgNotificationRead(notificationId);
      const now = new Date().toISOString();
      setItems((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read_at: item.read_at || now } : item)));
      setToast("Notification marked as read.");
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to mark notification as read");
    } finally {
      setSavingId(null);
    }
  }

  async function markAllAsRead() {
    const unread = items.filter((item) => !item.read_at && !item.readAt);
    if (unread.length === 0) return;
    setSavingId("all");
    try {
      await Promise.all(unread.map((item) => markOrgNotificationRead(item.id)));
      const now = new Date().toISOString();
      setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || now })));
      setToast("All notifications marked as read.");
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to mark all notifications as read");
    } finally {
      setSavingId(null);
    }
  }

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at && !item.readAt).length, [items]);

  return (
    <section className="section">
      <Toast message={toast} />
      <div className="section-header">
        <div>
          <h2>Notifications</h2>
          <p className="muted">Stay on top of new report activity, SLA pressure, and workflow updates without losing track of unread alerts.</p>
        </div>
        <div className="badge-row">
          <StatusBadge status={unreadCount > 0 ? "unread" : "read"} />
          <button className="btn secondary" type="button" onClick={markAllAsRead} disabled={savingId === "all" || unreadCount === 0}>
            {savingId === "all" ? "Updating..." : "Mark All As Read"}
          </button>
        </div>
      </div>

      {loading ? <LoadingCard label="Loading notifications..." /> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          description="Report triage alerts, status changes, and SLA reminders will show up here once your VDP starts receiving activity."
        />
      ) : null}

      <div className="notification-list">
        {items.map((item) => (
          <article key={item.id} className={`card notification-card ${item.read_at || item.readAt ? "" : "notification-card-unread"}`}>
            <div className="notification-copy">
              <div className="badge-row">
                <strong>{item.title}</strong>
                <StatusBadge status={item.read_at || item.readAt ? "read" : "unread"} />
              </div>
              <p>{item.message}</p>
              <span className="card-meta">{formatDateTime(item.created_at || item.createdAt)}</span>
            </div>
            {!item.read_at && !item.readAt ? (
              <button className="btn secondary" type="button" disabled={savingId === item.id} onClick={() => markRead(item.id)}>
                {savingId === item.id ? "Saving..." : "Mark As Read"}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
