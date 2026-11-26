import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { bootstrap, login } from "@shared-api/auth";
import { clearSession, storeSession } from "@shared-session/session";

function parseLoginError(err) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join("; ") || "Login failed";
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  return "Login failed";
}

export default function PortalLogin({
  expectedRole,
  successPath,
  title,
  description
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    async function tryBootstrap() {
      try {
        const data = await bootstrap();
        if (data.authenticated && data.user) {
          if (expectedRole && data.user.role !== expectedRole) {
            setError(`Unauthorized: Expected role '${expectedRole}'`);
            clearSession();
            setBootstrapping(false);
            return;
          }
          storeSession(data.token, data.user);
          navigate(successPath, { replace: true });
        }
      } catch (err) {
        // ignore
      } finally {
        setBootstrapping(false);
      }
    }
    tryBootstrap();
  }, [expectedRole, navigate, successPath]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email || !password) return;

    setError("");
    setSubmitting(true);

    try {
      const data = await login(email, password);
      if (expectedRole && data.user.role !== expectedRole) {
        setError(`Unauthorized: Expected role '${expectedRole}'`);
        clearSession();
        return;
      }
      storeSession(data.token, data.user);
      navigate(successPath, { replace: true });
    } catch (err) {
      setError(parseLoginError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
      <section className="grid w-full gap-6 md:grid-cols-2">
        <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[radial-gradient(circle_at_88%_0%,rgba(245,158,11,0.18),transparent_24%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#0b1220_100%)] p-6 text-white shadow-[0_24px_70px_rgba(2,6,23,0.42)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />
          <div className="flex items-center gap-2 mt-2">
            <span className="font-space text-lg font-black text-amber-400">AntCrowd</span>
            <span className="h-3 w-px bg-slate-800" />
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Secure Access</span>
          </div>
          <h1 className="mt-6 font-space text-3xl font-bold leading-tight">{title}</h1>
          <p className="mt-4 text-sm text-slate-200">
            Access your dedicated workspace with the account provisioned for your role. Activity is
            logged and protected under AntCrowd secure session controls.
          </p>
          <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-100">
            <p className="font-semibold">Tips</p>
            <p className="mt-1 text-slate-200">Use your assigned email and temporary password, then rotate credentials after first login.</p>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />
          <h2 className="font-space text-2xl font-bold text-white mt-2">Sign In</h2>
          <p className="mt-2 text-sm text-slate-300">{description}</p>

          {bootstrapping ? (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200">
              Checking for an active AntCrowd session...
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200">
              {error}
            </p>
          )}
        </article>
      </section>
    </main>
  );
}
