export default function LoginPage({ loginForm, setLoginForm, login, error }) {
  return (
    <div className="page auth-page">
      <section className="auth-grid">
        <article className="auth-hero">
          <p className="hero-tag">AntCrowd Secure Access</p>
          <h1>Platform Admin Login</h1>
          <p>
            Sign in to the unified admin console and manage pentesting, VDP, and training
            operations from one secure control plane.
          </p>
          <div className="visual-card">Use platform-admin credentials provisioned by AntCrowd.</div>
          <div className="visual-card">All admin actions are tracked for audit visibility.</div>
        </article>

        <article className="auth-card">
          <h2>Sign In</h2>
          <p className="muted">Use `platform-admin@antcrowd.local` / `Antcrowd123!`.</p>
          <input
            placeholder="Work email"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Enter your password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button onClick={login}>Sign In</button>
          {error && <div className="notice error">{error}</div>}
        </article>
      </section>
    </div>
  );
}
