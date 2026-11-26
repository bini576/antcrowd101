import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminCtfProgress, fetchAntcrowdCtfState, JUICE_SHOP_URL, submitAntcrowdCtfFlag, USES_BUILTIN_LAB_TARGET } from "./api";
import "./juice-shop.css";

const initialDraft = {
  challenge_id: "",
  submitted_flag: "",
};

const DIFFICULTY_ORDER = { Easy: 1, Medium: 2, Hard: 3, Expert: 4 };

export default function JuiceShopPage({ currentUser, role }) {
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [ctfState, setCtfState] = useState(null);
  const [adminProgress, setAdminProgress] = useState(null);

  const isAdmin = role === "platform_admin";
  const isResearcher = role === "researcher";

  useEffect(() => {
    loadState();
    if (isAdmin) {
      loadAdminProgress();
    }
  }, [currentUser, isAdmin]);

  const challengeLevels = useMemo(() => {
    const raw = ctfState?.progress?.levels ?? [];
    return [...raw].sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 99) - (DIFFICULTY_ORDER[b.difficulty] ?? 99));
  }, [ctfState]);

  const activeChallenge = useMemo(
    () => challengeLevels.find((challenge) => challenge.id === draft.challenge_id) ?? challengeLevels[0],
    [challengeLevels, draft.challenge_id],
  );

  useEffect(() => {
    if (!draft.challenge_id && challengeLevels.length) {
      setDraft((current) => ({ ...current, challenge_id: challengeLevels[0].id }));
    }
  }, [challengeLevels, draft.challenge_id]);

  async function loadState() {
    try {
      const response = await fetchAntcrowdCtfState(currentUser);
      setCtfState(response);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Could not load AntCrowd Web Security Lab progress.");
    }
  }

  async function loadAdminProgress() {
    try {
      const data = await fetchAdminCtfProgress();
      setAdminProgress(data);
    } catch {
      // Non-critical — admin progress panel will be empty
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isResearcher || !ctfState?.joined) return;
    setBusy(true);
    setResult("");
    setError("");
    try {
      const response = await submitAntcrowdCtfFlag({
        username: currentUser,
        challenge_id: draft.challenge_id,
        submitted_flag: draft.submitted_flag,
      });
      setResult(response.message);
      setDraft((current) => ({ ...current, submitted_flag: "" }));
      await loadState();
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Could not submit flag.");
    } finally {
      setBusy(false);
    }
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  return (
    <section className="juice-layout">
      <header className="juice-header-card">
        <div className="juice-brand-row">
          <div>
            <p className="juice-eyebrow">AntCrowd Web Security Lab</p>
            <h1>AntCrowd Web Security Lab</h1>
          </div>
        </div>
        <p>
          Launch the AntCrowd Web Security Lab in a new tab, solve the seven tracked levels, and submit each flag here. AntCrowd keeps persistent score, progress, and notifications in sync across your workspace.
        </p>
        {USES_BUILTIN_LAB_TARGET ? (
          <p style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: "0.75rem", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.05)", color: "#f59e0b", fontSize: "0.8rem" }}>
            Fallback lab mode is active. Set <code>VITE_JUICE_SHOP_URL</code> to point to a running Web Security Lab instance, or start the stack with Docker Compose to use the full target.
          </p>
        ) : null}
        <div className="juice-header-actions">
          <a href={JUICE_SHOP_URL} target="_blank" rel="noreferrer" className="juice-launch-btn">
            Launch Web Security Lab
          </a>
          <Link to="/" className="juice-secondary-btn">
            Back To Workspace
          </Link>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="juice-frame-card">
          <p className="juice-kicker">Progress</p>
          <h2>{ctfState?.progress?.solvedCount ?? 0} / {ctfState?.progress?.totalLevels ?? 7} levels solved</h2>
          <p>{ctfState?.progress?.pointsEarned ?? 0} / {ctfState?.progress?.totalPoints ?? 1900} points earned</p>
        </div>
        <div className="juice-frame-card">
          <p className="juice-kicker">Program</p>
          <h2>{ctfState?.program?.title ?? "AntCrowd Web Security Lab"}</h2>
          <p>{ctfState?.program?.summary}</p>
        </div>
        <div className="juice-frame-card">
          <p className="juice-kicker">Researchers Joined</p>
          <h2>{ctfState?.program?.participantCount ?? 0}</h2>
          <p>{ctfState?.program?.participants?.join(", ") || "No participants yet."}</p>
        </div>
      </div>

      {/* Not-joined gate */}
      {!ctfState?.joined && isResearcher ? (
        <section className="juice-frame-card">
          <p className="juice-kicker">Join Required</p>
          <h2>Join the challenge from the dashboard first</h2>
          <p>The AntCrowd Web Security Lab only unlocks flag persistence after you click Join Challenge in the Challenge workspace.</p>
          <Link to="/" className="juice-secondary-btn" style={{ marginTop: "1rem", display: "inline-block" }}>
            Return To Dashboard
          </Link>
        </section>
      ) : null}

      {/* ── RESEARCHER VIEW ── */}
      {isResearcher ? (
        <div className="juice-main-grid">
          {/* Left: Level list */}
          <article className="juice-frame-card">
            <div className="juice-section-heading">
              <div>
                <p className="juice-kicker">Live Levels</p>
                <h2>Challenge Briefing</h2>
              </div>
              <span className="juice-count-badge">{challengeLevels.length} tracked levels</span>
            </div>
            <div className="juice-level-list">
              {challengeLevels.map((challenge, idx) => (
                <button
                  key={challenge.id}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, challenge_id: challenge.id }))}
                  className={`juice-level-card ${challenge.id === draft.challenge_id ? "juice-level-card-active" : ""}`}
                >
                  <div className="juice-level-meta">
                    <span>#{idx + 1}</span>
                    <span>{challenge.difficulty}</span>
                    <span>{challenge.points} pts</span>
                    {challenge.solved ? <span className="solved-badge">✓ Solved</span> : null}
                  </div>
                  <h3>{challenge.title}</h3>
                  <p>{challenge.description}</p>
                </button>
              ))}
            </div>
            {activeChallenge ? (
              <div className="juice-brief-card">
                <p className="juice-kicker">Guide</p>
                <h3>{activeChallenge.title}</h3>
                <p style={{ whiteSpace: "pre-line", marginTop: "0.6rem" }}>{activeChallenge.startingPoint}</p>
                <ol className="juice-steps">
                  <li>Launch the AntCrowd Web Security Lab in a new tab using the button above.</li>
                  <li>Work through the selected level and capture the flag.</li>
                  <li>Return here to submit the flag and persist your points.</li>
                </ol>
              </div>
            ) : null}
          </article>

          {/* Right: Submit card */}
          <aside className="juice-submit-card">
            <h2>Submit Level Flag</h2>
            <p className="juice-submit-copy">Each accepted flag updates your persistent points and level progress immediately.</p>
            <form onSubmit={handleSubmit} className="juice-form">
              <label>
                Challenge Level
                <select value={draft.challenge_id} onChange={(event) => setDraft((current) => ({ ...current, challenge_id: event.target.value }))}>
                  {challengeLevels.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>{challenge.title}</option>
                  ))}
                </select>
              </label>
              <label>
                Flag
                <input
                  type="text"
                  value={draft.submitted_flag}
                  onChange={(event) => setDraft((current) => ({ ...current, submitted_flag: event.target.value }))}
                  placeholder="ctf{...}"
                  required
                />
              </label>
              {activeChallenge ? (
                <div className="juice-submit-details">
                  <span>{activeChallenge.difficulty}</span>
                  <span>{activeChallenge.points} pts</span>
                </div>
              ) : null}
              <button type="submit" disabled={busy || !ctfState?.joined}>
                {busy ? "Validating..." : "Submit Flag"}
              </button>
            </form>
            {result ? <p className="juice-result-ok">✓ {result}</p> : null}
            {error ? <p className="juice-result-error">{error}</p> : null}
          </aside>
        </div>
      ) : null}

      {/* ── PLATFORM ADMIN VIEW ── */}
      {isAdmin ? (
        <div className="juice-admin-panel">
          <div className="juice-frame-card">
            <div className="juice-section-heading">
              <div>
                <p className="juice-kicker">Admin</p>
                <h2>Researcher Progress Tracker</h2>
              </div>
              <a href={JUICE_SHOP_URL} target="_blank" rel="noreferrer" className="juice-launch-btn" style={{ fontSize: "0.78rem", padding: "0.5rem 1rem" }}>
                Launch Web Security Lab ↗
              </a>
            </div>

            {/* Summary row */}
            <div className="juice-admin-summary" style={{ marginTop: "1.25rem" }}>
              <div className="juice-admin-stat">
                <div className="stat-val">{adminProgress?.totalResearchers ?? "—"}</div>
                <div className="stat-lbl">Researchers Joined</div>
              </div>
              <div className="juice-admin-stat">
                <div className="stat-val">{adminProgress?.totalFlags ?? "—"}</div>
                <div className="stat-lbl">Flags Submitted</div>
              </div>
              <div className="juice-admin-stat">
                <div className="stat-val">{adminProgress?.totalPoints ?? "—"}</div>
                <div className="stat-lbl">Total Points Awarded</div>
              </div>
            </div>

            {/* Per-researcher table */}
            <div className="juice-admin-table-wrap" style={{ marginTop: "1.5rem" }}>
              {(adminProgress?.researchers ?? []).length > 0 ? (
                <table className="juice-admin-table">
                  <thead>
                    <tr>
                      <th>Researcher</th>
                      <th>Levels Completed</th>
                      <th>Points</th>
                      <th>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminProgress.researchers.map((row) => (
                      <tr key={row.username}>
                        <td>{row.username}</td>
                        <td>{row.levelsCompleted}/{row.totalLevels}</td>
                        <td className="pts-cell">{row.totalPoints}</td>
                        <td style={{ color: "#64748b", fontSize: "0.8rem" }}>{formatDate(row.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: "#64748b", fontSize: "0.875rem", padding: "1rem 0" }}>
                  No researchers have joined the Web Security Lab yet.
                </p>
              )}
            </div>
          </div>

          {/* Level overview for admin */}
          <div className="juice-frame-card">
            <p className="juice-kicker">Lab Structure</p>
            <h2>7-Level Challenge Map</h2>
            <div className="juice-level-list">
              {challengeLevels.map((challenge, idx) => (
                <div key={challenge.id} className="juice-level-card" style={{ cursor: "default" }}>
                  <div className="juice-level-meta">
                    <span>#{idx + 1}</span>
                    <span>{challenge.difficulty}</span>
                    <span>{challenge.points} pts</span>
                  </div>
                  <h3>{challenge.title}</h3>
                  <p>{challenge.description}</p>
                </div>
              ))}
              {challengeLevels.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Loading levels…</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
