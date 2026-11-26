import { useNavigate } from "react-router-dom";
import { clearSession, getStoredUser } from "@shared-session/session";

function isAbsoluteUrl(value) {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

export default function PortalNavbar({
  title,
  exitLabel = "Logout",
  roleLabel,
  fallbackEmail,
  redirectTo = "/login",
  notificationCount = 0,
  onNotificationClick
}) {
  const navigate = useNavigate();
  const user = getStoredUser();

  async function handleExit() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
    clearSession();
    const mainAppLoginUrl = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "") + "/login";
    window.location.href = mainAppLoginUrl;
  }

  return (
    <header className="relative overflow-hidden mb-6 rounded-[1.75rem] border border-slate-800 bg-slate-950/72 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur md:p-5">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mt-2">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-xl font-black text-amber-400">
            A
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-space text-xl font-black text-amber-400">AntCrowd</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Unified Service Module
              </span>
            </div>
            <h1 className="font-space text-2xl font-bold text-white md:text-3xl mt-1">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 font-semibold text-slate-300">
                {user?.email || fallbackEmail || "user"}
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/12 px-2.5 py-1 font-semibold text-amber-300">
                role: {roleLabel || user?.role || "unknown"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNotificationClick}
            className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            aria-label="View notifications"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3.75a4.75 4.75 0 0 0-4.75 4.75v1.1c0 1.1-.36 2.17-1.02 3.05L4.7 14.7a1 1 0 0 0 .8 1.6h13a1 1 0 0 0 .8-1.6l-1.53-2.05a5.08 5.08 0 0 1-1.02-3.05V8.5A4.75 4.75 0 0 0 12 3.75Zm0 17a2.5 2.5 0 0 0 2.33-1.6H9.67A2.5 2.5 0 0 0 12 20.75Z" />
            </svg>
            <span>Alerts</span>
            {notificationCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex h-10 min-w-32 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          >
            {exitLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
