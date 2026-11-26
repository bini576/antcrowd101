import { useMemo, useState } from "react";

const LAB_LEVELS = [
  {
    id: "lab-auth-bypass",
    title: "Level 1: Login Bypass Warmup",
    category: "Authentication",
    difficulty: "Easy",
    points: 100,
    flag: "ctf{antcrowd_auth_bypass}",
    summary: "Probe the login flow and look for places where user input is trusted too early.",
  },
  {
    id: "lab-hidden-routes",
    title: "Level 2: Hidden Routes Trail",
    category: "Information Disclosure",
    difficulty: "Easy",
    points: 150,
    flag: "ctf{antcrowd_hidden_routes}",
    summary: "Treat the client app like an API surface. Hidden panels often leave breadcrumbs in route names and tooling views.",
  },
  {
    id: "lab-token-tamper",
    title: "Level 3: Token Tampering",
    category: "Session Management",
    difficulty: "Medium",
    points: 200,
    flag: "ctf{antcrowd_token_tamper}",
    summary: "Inspect how the app trusts token claims. If the token becomes editable, what changes suddenly unlock?",
  },
  {
    id: "lab-order-chaos",
    title: "Level 4: Business Logic Abuse",
    category: "Business Logic",
    difficulty: "Medium",
    points: 250,
    flag: "ctf{antcrowd_logic_abuse}",
    summary: "Shopping flows break in interesting ways when you mix quantity edge cases with stacked discount behavior.",
  },
  {
    id: "lab-admin-surface",
    title: "Level 5: Admin Surface Discovery",
    category: "Access Control",
    difficulty: "Hard",
    points: 350,
    flag: "ctf{antcrowd_admin_surface}",
    summary: "Once you hold elevated claims, look for neglected maintenance actions and forgotten internal panels.",
  },
  {
    id: "lab-data-vault",
    title: "Level 6: Sensitive Data Vault",
    category: "Data Exposure",
    difficulty: "Hard",
    points: 500,
    flag: "ctf{antcrowd_data_vault}",
    summary: "The final vault falls when enumeration, privilege, and injection-style probing line up in the right order.",
  },
];

const INITIAL_TOKEN = JSON.stringify(
  {
    sub: "researcher",
    role: "user",
    trust: "low",
    scope: ["catalog", "basket"],
  },
  null,
  2,
);

export default function AntcrowdLabTarget() {
  const [activeLevel, setActiveLevel] = useState(LAB_LEVELS[0].id);
  const [email, setEmail] = useState("researcher@antcrowd.local");
  const [password, setPassword] = useState("");
  const [routeProbe, setRouteProbe] = useState("/#/catalog");
  const [tokenDraft, setTokenDraft] = useState(INITIAL_TOKEN);
  const [coupon, setCoupon] = useState("WELCOME10");
  const [quantity, setQuantity] = useState("1");
  const [vaultQuery, setVaultQuery] = useState("orders");
  const [revealed, setRevealed] = useState([]);

  const parsedToken = useMemo(() => {
    try {
      return JSON.parse(tokenDraft);
    } catch {
      return null;
    }
  }, [tokenDraft]);

  const tokenElevated = Boolean(
    parsedToken && (String(parsedToken.role || "").toLowerCase() === "admin" || String(parsedToken.trust || "").toLowerCase() === "high"),
  );

  const currentLevel = LAB_LEVELS.find((level) => level.id === activeLevel) ?? LAB_LEVELS[0];

  function reveal(levelId) {
    setActiveLevel(levelId);
    setRevealed((current) => (current.includes(levelId) ? current : [...current, levelId]));
  }

  function solved(levelId) {
    return revealed.includes(levelId);
  }

  function levelById(levelId) {
    return LAB_LEVELS.find((level) => level.id === levelId);
  }

  function handleLoginBypass(event) {
    event.preventDefault();
    const probe = `${email} ${password}`.toLowerCase();
    if (probe.includes("'") || probe.includes("or 1=1") || probe.includes("admin@")) {
      reveal("lab-auth-bypass");
    }
  }

  function handleRouteProbe(event) {
    event.preventDefault();
    const probe = routeProbe.toLowerCase();
    if (probe.includes("support") || probe.includes("hidden") || probe.includes("debug/routes") || probe.includes(".well-known")) {
      reveal("lab-hidden-routes");
    }
  }

  function handleTokenReview(event) {
    event.preventDefault();
    if (tokenElevated) {
      reveal("lab-token-tamper");
    }
  }

  function handleCheckout(event) {
    event.preventDefault();
    const qty = Number(quantity);
    const normalizedCoupon = coupon.trim().toUpperCase();
    if ((normalizedCoupon === "BASKET-RACE" && qty === 0) || (normalizedCoupon === "STACK-FREESHIP" && qty < 0)) {
      reveal("lab-order-chaos");
    }
  }

  function handleAdminSurface(event) {
    event.preventDefault();
    if (tokenElevated) {
      reveal("lab-admin-surface");
    }
  }

  function handleVaultQuery(event) {
    event.preventDefault();
    const probe = vaultQuery.toLowerCase();
    if (tokenElevated && (probe.includes("union") || probe.includes("vault") || probe.includes("backup") || probe.includes("sqlite_master"))) {
      reveal("lab-data-vault");
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(200,16,46,0.08),_transparent_42%),linear-gradient(180deg,_#fffaf7_0%,_#fffdfb_42%,_#f9f1ea_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-[#eaded4] bg-white/90 p-6 shadow-[0_24px_80px_rgba(166,124,93,0.12)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#A67C5D]">AntCrowd Built-In Lab Target</p>
              <h1 className="mt-2 font-serif text-4xl text-slate-950">AntCrowd Web Security Lab</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
                This local target replaces the external Juice Shop container when you run the challenge frontend without Docker access. Work through the six
                guided exercises, recover each flag, and submit it back in the AntCrowd CTF workspace.
              </p>
            </div>
            <div className="rounded-3xl border border-[#e8d3c5] bg-[#fff7f1] px-5 py-4 text-sm leading-6 text-[#7b5437]">
              Use the challenge list to switch levels. Solved flags stay visible in this tab only, so record them in the CTF page after you discover them.
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {LAB_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => setActiveLevel(level.id)}
              className={`rounded-[1.6rem] border px-4 py-4 text-left transition ${
                level.id === activeLevel
                  ? "border-[#C8102E] bg-[#fff3f5] shadow-[0_18px_48px_rgba(200,16,46,0.12)]"
                  : "border-[#eaded4] bg-white/90 hover:border-[#d8b59b]"
              }`}
            >
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A67C5D]">
                <span>{level.category}</span>
                <span>{level.difficulty}</span>
              </div>
              <h2 className="mt-3 font-serif text-xl text-slate-950">{level.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{level.points} pts</p>
              {solved(level.id) ? <p className="mt-3 text-sm font-semibold text-[#C8102E]">Flag recovered</p> : null}
            </button>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <article className="rounded-[2rem] border border-[#eaded4] bg-white p-6 shadow-[0_24px_70px_rgba(166,124,93,0.1)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A67C5D]">{currentLevel.category}</p>
            <h2 className="mt-2 font-serif text-3xl text-slate-950">{currentLevel.title}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">{currentLevel.summary}</p>

            <div className="mt-6 grid gap-6">
              <section className="rounded-[1.6rem] border border-[#efe3da] bg-[#fffaf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C5D]">Level 1</p>
                    <h3 className="mt-1 font-semibold text-slate-950">Login console</h3>
                  </div>
                  {solved("lab-auth-bypass") ? <FlagBadge level={levelById("lab-auth-bypass")} /> : null}
                </div>
                <form onSubmit={handleLoginBypass} className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Email
                    <input className="rounded-2xl border border-[#d8c1af] bg-white px-4 py-3" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Password
                    <input className="rounded-2xl border border-[#d8c1af] bg-white px-4 py-3" value={password} onChange={(event) => setPassword(event.target.value)} />
                  </label>
                  <button type="submit" className="w-fit rounded-full bg-[#C8102E] px-5 py-3 text-sm font-semibold text-white">
                    Test Login
                  </button>
                </form>
                <HintText>Hint: trusted input often leaves traces like `' OR 1=1` or alternate admin identifiers.</HintText>
              </section>

              <section className="rounded-[1.6rem] border border-[#efe3da] bg-[#fffaf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C5D]">Level 2</p>
                    <h3 className="mt-1 font-semibold text-slate-950">Route reconnaissance</h3>
                  </div>
                  {solved("lab-hidden-routes") ? <FlagBadge level={levelById("lab-hidden-routes")} /> : null}
                </div>
                <form onSubmit={handleRouteProbe} className="mt-4 grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Probe path
                    <input className="rounded-2xl border border-[#d8c1af] bg-white px-4 py-3" value={routeProbe} onChange={(event) => setRouteProbe(event.target.value)} />
                  </label>
                  <button type="submit" className="w-fit rounded-full border border-[#C8102E] px-5 py-3 text-sm font-semibold text-[#C8102E]">
                    Inspect Path
                  </button>
                </form>
                <HintText>Hint: debug and support paths are easy to forget in client bundles and hidden route registries.</HintText>
              </section>

              <section className="rounded-[1.6rem] border border-[#efe3da] bg-[#fffaf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C5D]">Level 3</p>
                    <h3 className="mt-1 font-semibold text-slate-950">Editable token payload</h3>
                  </div>
                  {solved("lab-token-tamper") ? <FlagBadge level={levelById("lab-token-tamper")} /> : null}
                </div>
                <form onSubmit={handleTokenReview} className="mt-4 grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Session token payload
                    <textarea
                      rows="9"
                      className="rounded-[1.4rem] border border-[#d8c1af] bg-white px-4 py-3 font-mono text-sm"
                      value={tokenDraft}
                      onChange={(event) => setTokenDraft(event.target.value)}
                    />
                  </label>
                  <button type="submit" className="w-fit rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                    Re-parse Token
                  </button>
                </form>
                <HintText>Hint: changing `role` or `trust` often unlocks functionality long before a signature is checked.</HintText>
              </section>

              <section className="rounded-[1.6rem] border border-[#efe3da] bg-[#fffaf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C5D]">Level 4</p>
                    <h3 className="mt-1 font-semibold text-slate-950">Checkout edge cases</h3>
                  </div>
                  {solved("lab-order-chaos") ? <FlagBadge level={levelById("lab-order-chaos")} /> : null}
                </div>
                <form onSubmit={handleCheckout} className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Quantity
                    <input className="rounded-2xl border border-[#d8c1af] bg-white px-4 py-3" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Coupon
                    <input className="rounded-2xl border border-[#d8c1af] bg-white px-4 py-3" value={coupon} onChange={(event) => setCoupon(event.target.value)} />
                  </label>
                  <button type="submit" className="w-fit rounded-full border border-[#C8102E] px-5 py-3 text-sm font-semibold text-[#C8102E]">
                    Checkout
                  </button>
                </form>
                <HintText>Hint: try combinations that create impossible totals or skip the expected sequence of valid cart states.</HintText>
              </section>

              <section className="rounded-[1.6rem] border border-[#efe3da] bg-[#fffaf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C5D]">Level 5</p>
                    <h3 className="mt-1 font-semibold text-slate-950">Maintenance panel</h3>
                  </div>
                  {solved("lab-admin-surface") ? <FlagBadge level={levelById("lab-admin-surface")} /> : null}
                </div>
                <form onSubmit={handleAdminSurface} className="mt-4 grid gap-3">
                  <div className="rounded-[1.4rem] border border-[#d8c1af] bg-white px-4 py-4 text-sm leading-7 text-slate-700">
                    Internal route snapshot: <code className="rounded bg-[#fff2f4] px-2 py-1 text-[#8b1e2d]">/#/administration/maintenance/export-users</code>
                  </div>
                  <button type="submit" disabled={!tokenElevated} className="w-fit rounded-full bg-[#C8102E] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    Open Maintenance Export
                  </button>
                </form>
                <HintText>Hint: this route does nothing unless the token editor already elevated your trust model.</HintText>
              </section>

              <section className="rounded-[1.6rem] border border-[#efe3da] bg-[#fffaf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C5D]">Level 6</p>
                    <h3 className="mt-1 font-semibold text-slate-950">Vault search console</h3>
                  </div>
                  {solved("lab-data-vault") ? <FlagBadge level={levelById("lab-data-vault")} /> : null}
                </div>
                <form onSubmit={handleVaultQuery} className="mt-4 grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Query
                    <input className="rounded-2xl border border-[#d8c1af] bg-white px-4 py-3 font-mono text-sm" value={vaultQuery} onChange={(event) => setVaultQuery(event.target.value)} />
                  </label>
                  <button type="submit" className="w-fit rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                    Search Vault
                  </button>
                </form>
                <HintText>Hint: once you hold admin claims, enumeration payloads like `vault`, `backup`, or `UNION` become very interesting.</HintText>
              </section>
            </div>
          </article>

          <aside className="grid gap-6">
            <section className="rounded-[2rem] border border-[#eaded4] bg-white p-6 shadow-[0_24px_70px_rgba(166,124,93,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A67C5D]">Current Brief</p>
              <h2 className="mt-2 font-serif text-3xl text-slate-950">{currentLevel.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-700">{currentLevel.summary}</p>
              <div className="mt-5 grid gap-3 rounded-[1.5rem] border border-[#efe3da] bg-[#fffaf8] p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Category</span>
                  <strong>{currentLevel.category}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Difficulty</span>
                  <strong>{currentLevel.difficulty}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reward</span>
                  <strong>{currentLevel.points} points</strong>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#eaded4] bg-white p-6 shadow-[0_24px_70px_rgba(166,124,93,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A67C5D]">Recovered Flags</p>
              <div className="mt-4 grid gap-3">
                {revealed.length ? (
                  revealed.map((levelId) => {
                    const level = levelById(levelId);
                    return (
                      <div key={levelId} className="rounded-[1.4rem] border border-[#e8cfd1] bg-[#fff3f5] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C5D]">{level.title}</p>
                        <code className="mt-2 block break-all text-sm font-semibold text-[#8b1e2d]">{level.flag}</code>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-[1.4rem] border border-dashed border-[#d7b7a3] bg-[#fffaf8] p-4 text-sm text-slate-600">
                    No flags recovered yet. Work through the target exercises and reveal them one by one.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#eaded4] bg-white p-6 shadow-[0_24px_70px_rgba(166,124,93,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A67C5D]">Local Mode</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Docker Compose can still point this page at the real branded Juice Shop target on port <code>3003</code>. On pure localhost runs, this built-in
                lab keeps the CTF accessible without needing Docker.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function FlagBadge({ level }) {
  return (
    <span className="rounded-full border border-[#e7bfc5] bg-[#fff0f3] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#8b1e2d]">
      {level.flag}
    </span>
  );
}

function HintText({ children }) {
  return <p className="mt-4 text-sm leading-7 text-slate-600">{children}</p>;
}
